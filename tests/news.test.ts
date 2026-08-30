import { describe, expect, it } from "vitest";
import {
  assertNewsProgressionAllowed,
  canAdvanceAfterNews,
  commitNewsSelections,
  readNewsArticle,
  selectNewsForDay,
  validateNewsCatalog,
} from "../src/engine";
import type { NewsArticle } from "../src/domain";
import { makeState, alwaysTrue } from "./fixtures/state";

const article = (
  overrides: Partial<NewsArticle> & Pick<NewsArticle, "id" | "day" | "role">,
): NewsArticle => {
  const { id, day, role, ...optionalOverrides } = overrides;
  return {
    id,
    day,
    role,
    notificationHeadline: `通知 ${id}`,
    headline: `見出し ${id}`,
    body: `本文 ${id}`,
    conditions: alwaysTrue,
    priority: 0,
    effectsOnRead: [],
    isFallback: false,
    ...optionalOverrides,
  };
};

function dayOneCatalog(): NewsArticle[] {
  return [
    article({ id: "direct-high", day: 1, role: "direct", priority: 10, exclusiveGroup: "shared" }),
    article({ id: "direct-fallback", day: 1, role: "direct", isFallback: true }),
    article({ id: "trend-conflict", day: 1, role: "trend", priority: 20, exclusiveGroup: "shared" }),
    article({ id: "trend-fallback", day: 1, role: "trend", isFallback: true }),
    article({ id: "local-fallback", day: 1, role: "local", isFallback: true, priority: 1 }),
  ];
}

describe("news selection and reading", () => {
  it("fills direct/trend/discrepancy exactly once and permits local on day 1", () => {
    const selections = selectNewsForDay(1, dayOneCatalog(), makeState());

    expect(selections).toEqual([
      { day: 1, slot: "direct", newsId: "direct-high" },
      { day: 1, slot: "trend", newsId: "trend-fallback" },
      { day: 1, slot: "discrepancy", newsId: "local-fallback" },
    ]);
    expect(new Set(selections.map((selection) => selection.newsId)).size).toBe(3);
    expect(new Set(selections.map((selection) => selection.slot)).size).toBe(3);
  });

  it("filters already seen news, conditions and exclusive groups before selecting", () => {
    const catalog = [
      ...dayOneCatalog(),
      article({
        id: "direct-disabled",
        day: 1,
        role: "direct",
        priority: 30,
        conditions: { flag: { id: "not-set" } },
      }),
    ];
    const selections = selectNewsForDay(1, catalog, makeState({ seenNews: ["direct-high"] }));

    expect(selections[0].newsId).toBe("direct-fallback");
    expect(selections[1].newsId).toBe("trend-conflict");
  });

  it("commits all three selections atomically and rejects duplicates or rereads", () => {
    const state = makeState();
    const selections = selectNewsForDay(1, dayOneCatalog(), state);
    const committed = commitNewsSelections(state, selections);

    expect(committed.seenNews).toEqual(["direct-high", "trend-fallback", "local-fallback"]);
    expect(committed.newsSelections).toEqual(selections);
    expect(() => commitNewsSelections(state, [selections[0], selections[0], selections[2]])).toThrow(
      /Duplicate/,
    );
    expect(() => commitNewsSelections(committed, selections)).toThrow(/already seen/);
  });

  it("applies effectsOnRead only on the first read", () => {
    const catalog = dayOneCatalog().map((item) =>
      item.id === "direct-high"
        ? { ...item, effectsOnRead: [{ kind: "add" as const, target: "awareness" as const, amount: 1 }] }
        : item,
    );
    const initial = makeState();
    const selections = selectNewsForDay(1, catalog, initial);
    const state = commitNewsSelections(initial, selections);
    const news = catalog.find((item) => item.id === "direct-high");
    if (!news) {
      throw new Error("fixture article is missing");
    }
    const first = readNewsArticle(state, news);
    const second = readNewsArticle(first.state, news);

    expect(first.applied).toBe(true);
    expect(first.state.awareness).toBe(1);
    expect(first.state.readNews).toEqual(["direct-high"]);
    expect(second.applied).toBe(false);
    expect(second.state.awareness).toBe(1);
    expect(second.state).toBe(first.state);
  });

  it("allows progression only after zero, one, two, then all three reads", () => {
    const catalog = dayOneCatalog().map((item, index) =>
      index < 3
        ? {
            ...item,
            effectsOnRead: [{ kind: "add" as const, target: "awareness" as const, amount: 1 }],
          }
        : item,
    );
    const initial = makeState();
    const selections = selectNewsForDay(1, catalog, initial);
    let state = commitNewsSelections(initial, selections);
    const selectedArticles = selections.map((selection) => {
      const selected = catalog.find((item) => item.id === selection.newsId);
      if (!selected) {
        throw new Error(`missing fixture article ${selection.newsId}`);
      }
      return selected;
    });

    expect(canAdvanceAfterNews(state)).toBe(false);
    expect(() => assertNewsProgressionAllowed(state)).toThrow(/all three/);

    state = readNewsArticle(state, selectedArticles[0]).state;
    expect(canAdvanceAfterNews(state)).toBe(false);
    state = readNewsArticle(state, selectedArticles[1]).state;
    expect(canAdvanceAfterNews(state)).toBe(false);
    expect(() => assertNewsProgressionAllowed(state)).toThrow(/all three/);

    state = readNewsArticle(state, selectedArticles[2]).state;
    expect(canAdvanceAfterNews(state)).toBe(true);
    expect(() => assertNewsProgressionAllowed(state)).not.toThrow();
  });

  it("rejects an unselected article without applying effects", () => {
    const initial = makeState();
    const selections = selectNewsForDay(1, dayOneCatalog(), initial);
    const state = commitNewsSelections(initial, selections);
    const unselected = article({
      id: "unselected",
      day: 1,
      role: "direct",
      effectsOnRead: [{ kind: "add", target: "awareness", amount: 99 }],
    });

    expect(() => readNewsArticle(state, unselected)).toThrow(/not selected/);
    expect(state.awareness).toBe(0);
    expect(state.readNews).toEqual([]);
  });

  it("requires one unconditional fallback for each daily slot", () => {
    expect(() => validateNewsCatalog(dayOneCatalog().filter((item) => item.id !== "direct-fallback"), [1])).toThrow(
      /direct/,
    );
    expect(() =>
      validateNewsCatalog(
        [...dayOneCatalog(), article({ id: "local-day-2", day: 2, role: "local", isFallback: true })],
        [2],
      ),
    ).toThrow(/missing fallback/);
  });

  it("validates duplicate customer-state writes in effectsOnRead at catalog startup", () => {
    const invalid = article({
      id: "invalid-news-effect",
      day: 1,
      role: "direct",
      effectsOnRead: [
        { kind: "setCustomerState", customerId: "hotaru", state: "remembered" },
        { kind: "setCustomerState", customerId: "hotaru", state: "sealed" },
      ],
    });

    expect(() => validateNewsCatalog([...dayOneCatalog(), invalid], [1])).toThrow(/hotaru/);
  });
});
