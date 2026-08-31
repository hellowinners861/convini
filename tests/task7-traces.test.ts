import { describe, expect, it } from "vitest";
import type {
  Condition,
  EndingDefinition,
  Effect,
  GameState,
  NewsArticle,
} from "../src/domain";
import { applyEffects, determineEnding, evaluateCondition, getNumericReference, selectNewsForDay } from "../src/engine";
import type { ConditionOptions } from "../src/engine/conditions";
import type { ConditionTrace } from "../src/debug/contracts";
import { traceCondition } from "../src/debug/traces/conditions";
import { traceEffects } from "../src/debug/traces/effects";
import { traceEndingResolution } from "../src/debug/traces/endings";
import { traceNewsSelection } from "../src/debug/traces/news";
import { makeState } from "./fixtures/state";

function expectDeepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value as Record<string, unknown>).forEach(expectDeepFreeze);
}

function expectTraceParity(
  condition: Condition,
  state: GameState,
  trace: ConditionTrace,
  options: ConditionOptions = {},
): void {
  expect(trace.result).toBe(evaluateCondition(condition, state, options));

  if ("all" in condition) {
    expect(trace.kind).toBe("all");
    if (trace.kind !== "all") {
      throw new Error("Expected an all trace.");
    }
    expect(trace.children).toHaveLength(condition.all.length);
    condition.all.forEach((child, index) =>
      expectTraceParity(child, state, trace.children[index]!, options),
    );
    return;
  }

  if ("any" in condition) {
    expect(trace.kind).toBe("any");
    if (trace.kind !== "any") {
      throw new Error("Expected an any trace.");
    }
    expect(trace.children).toHaveLength(condition.any.length);
    condition.any.forEach((child, index) =>
      expectTraceParity(child, state, trace.children[index]!, options),
    );
    return;
  }

  if ("not" in condition) {
    expect(trace.kind).toBe("not");
    if (trace.kind !== "not") {
      throw new Error("Expected a not trace.");
    }
    expectTraceParity(condition.not, state, trace.child, options);
  }
}

function debugArticle(
  overrides: Partial<NewsArticle> & Pick<NewsArticle, "id" | "day" | "role">,
): NewsArticle {
  const { id, day, role, ...optionalOverrides } = overrides;
  return {
    id,
    day,
    role,
    notificationHeadline: `通知 ${id}`,
    headline: `見出し ${id}`,
    body: `本文 ${id}`,
    conditions: { true: true },
    priority: 0,
    effectsOnRead: [],
    isFallback: false,
    ...optionalOverrides,
  };
}

describe("Task 7 condition traces", () => {
  it("traverses composite all/any/not conditions with complete deterministic evidence", () => {
    const condition: Condition = {
      all: [
        { flag: { id: "ready" } },
        {
          any: [
            { flag: { id: "missing" } },
            { not: { flag: { id: "missing" } } },
            { true: true },
          ],
        },
        { not: { flag: { id: "ready" } } },
      ],
    };
    const state = makeState({ flags: ["ready"] });
    const conditionBefore = JSON.stringify(condition);
    const stateBefore = JSON.stringify(state);

    const first = traceCondition(condition, state);
    const second = traceCondition(condition, state);

    expect(first).toEqual(second);
    expectTraceParity(condition, state, first);
    expectDeepFreeze(first);
    expect(first.kind).toBe("all");
    if (first.kind !== "all") {
      throw new Error("Expected an all trace.");
    }
    expect(first.matchedIndexes).toEqual([0, 1]);
    expect(first.failedIndexes).toEqual([2]);
    expect(first.children[1]?.kind).toBe("any");
    if (first.children[1]?.kind !== "any") {
      throw new Error("Expected an any trace.");
    }
    expect(first.children[1].matchedIndexes).toEqual([1, 2]);
    expect(first.children[1].failedIndexes).toEqual([0]);
    expect(JSON.stringify(condition)).toBe(conditionBefore);
    expect(JSON.stringify(state)).toBe(stateBefore);
  });

  it("records raw and derived numeric references for all six operators with parity", () => {
    const state = makeState({
      day: 3,
      world: { undead: 7, machine: 5, cosmic: 4, spirit: 1 },
      stability: -2,
      awareness: 2,
      managerTrust: 3,
      revenue: { total: 40, today: 12, dailyTarget: 20 },
    });
    const cases = [
      ["world.undead", "eq", 7],
      ["stability", "neq", -1],
      ["leadingValue", "gt", 6],
      ["secondValue", "gte", 5],
      ["axisDifference", "lt", 3],
      ["strongAxisCount", "lte", 3],
    ] as const;

    cases.forEach(([reference, operator, expected]) => {
      const condition: Condition = {
        numeric: { reference, operator, value: expected },
      };
      const trace = traceCondition(condition, state);

      expectTraceParity(condition, state, trace);
      expectDeepFreeze(trace);
      expect(trace.kind).toBe("numeric");
      if (trace.kind !== "numeric") {
        throw new Error("Expected a numeric trace.");
      }
      expect(trace.ref).toBe(reference);
      expect(trace.op).toBe(operator);
      expect(trace.expected).toBe(expected);
      expect(trace.actual).toBe(getNumericReference(state, reference));
    });
  });

  it("captures flag, customer, seen-news, and read-news evidence including negatives and null", () => {
    const state = makeState({
      flags: ["ready"],
      customerStates: { alice: "happy" },
      seenNews: ["news-seen"],
      readNews: ["news-read"],
    });
    const conditions: Condition[] = [
      { flag: { id: "ready" } },
      { flag: { id: "missing", present: false } },
      { flag: { id: "ready", present: false } },
      { customerState: { customerId: "alice", state: "happy" } },
      { customerState: { customerId: "missing", state: "happy" } },
      { seenNews: { id: "news-seen" } },
      { seenNews: { id: "news-missing", present: false } },
      { readNews: { id: "news-read" } },
      { readNews: { id: "news-missing", present: false } },
    ];

    conditions.forEach((condition) => {
      const trace = traceCondition(condition, state);
      expectTraceParity(condition, state, trace);

      if ("flag" in condition) {
        expect(trace.kind).toBe("flag");
        if (trace.kind !== "flag") {
          throw new Error("Expected a flag trace.");
        }
        expect(trace.flag).toBe(condition.flag.id);
        expect(trace.expected).toBe(condition.flag.present ?? true);
        expect(trace.actual).toBe(state.flags.includes(condition.flag.id));
      } else if ("customerState" in condition) {
        expect(trace.kind).toBe("customer-state");
        if (trace.kind !== "customer-state") {
          throw new Error("Expected a customer-state trace.");
        }
        expect(trace.customerId).toBe(condition.customerState.customerId);
        expect(trace.expected).toBe(condition.customerState.state);
        expect(trace.actual).toBe(
          state.customerStates[condition.customerState.customerId] ?? null,
        );
      } else if ("seenNews" in condition) {
        expect(trace.kind).toBe("seen-news");
        if (trace.kind !== "seen-news") {
          throw new Error("Expected a seen-news trace.");
        }
        expect(trace.newsId).toBe(condition.seenNews.id);
        expect(trace.actual).toBe(state.seenNews.includes(condition.seenNews.id));
      } else if ("readNews" in condition) {
        expect(trace.kind).toBe("read-news");
        if (trace.kind !== "read-news") {
          throw new Error("Expected a read-news trace.");
        }
        expect(trace.newsId).toBe(condition.readNews.id);
        expect(trace.actual).toBe(state.readNews.includes(condition.readNews.id));
      } else {
        throw new Error("Expected a known condition trace.");
      }

      expectDeepFreeze(trace);
    });
  });

  it("preserves leading-axis ranking and tie-break evidence with engine parity", () => {
    const condition: Condition = { leadingAxis: { axis: "cosmic" } };
    const state = makeState({
      world: { undead: 4, machine: 4, cosmic: 4, spirit: 4 },
    });
    const conditionBefore = JSON.stringify(condition);
    const stateBefore = JSON.stringify(state);

    const withoutTieBreaker = traceCondition(condition, state);
    const withTieBreaker = traceCondition(condition, state, { tieBreakerAxis: "cosmic" });

    expectTraceParity(condition, state, withoutTieBreaker);
    expectTraceParity(condition, state, withTieBreaker, { tieBreakerAxis: "cosmic" });
    expectDeepFreeze(withoutTieBreaker);
    expectDeepFreeze(withTieBreaker);
    expect(withoutTieBreaker.kind).toBe("leading-axis");
    expect(withTieBreaker.kind).toBe("leading-axis");
    if (withoutTieBreaker.kind !== "leading-axis" || withTieBreaker.kind !== "leading-axis") {
      throw new Error("Expected leading-axis traces.");
    }
    expect(withoutTieBreaker.tieBreakerAxis).toBeNull();
    expect(withoutTieBreaker.actual).toBe("undead");
    expect(withoutTieBreaker.ranking.map((entry) => entry.axis)).toEqual([
      "undead",
      "machine",
      "cosmic",
      "spirit",
    ]);
    expect(withTieBreaker.tieBreakerAxis).toBe("cosmic");
    expect(withTieBreaker.actual).toBe("cosmic");
    expect(withTieBreaker.ranking.map((entry) => entry.axis)).toEqual([
      "cosmic",
      "undead",
      "machine",
      "spirit",
    ]);
    expect(withTieBreaker.ranking.map((entry) => entry.value)).toEqual([4, 4, 4, 4]);
    expect(JSON.stringify(condition)).toBe(conditionBefore);
    expect(JSON.stringify(state)).toBe(stateBefore);
  });
});

describe("Task 7 selection and effect traces", () => {
  it("traces sequential news selection, all catalog candidates, and all exclusion codes", () => {
    const catalog: NewsArticle[] = [
      debugArticle({
        id: "selected-direct",
        day: 1,
        role: "direct",
        priority: 50,
        exclusiveGroup: "shared",
      }),
      debugArticle({ id: "direct-low", day: 1, role: "direct", priority: 1 }),
      debugArticle({ id: "seen-direct", day: 1, role: "direct", priority: 70 }),
      debugArticle({
        id: "failed-direct",
        day: 1,
        role: "direct",
        priority: 60,
        conditions: { flag: { id: "missing" } },
      }),
      debugArticle({ id: "direct-fallback", day: 1, role: "direct", isFallback: true }),
      debugArticle({
        id: "conflict-trend",
        day: 1,
        role: "trend",
        priority: 100,
        exclusiveGroup: "shared",
      }),
      debugArticle({ id: "selected-trend", day: 1, role: "trend", priority: 20 }),
      debugArticle({ id: "trend-fallback", day: 1, role: "trend", isFallback: true }),
      debugArticle({ id: "selected-discrepancy", day: 1, role: "discrepancy", priority: 10 }),
      debugArticle({ id: "local-low", day: 1, role: "local", priority: 2 }),
      debugArticle({ id: "local-fallback", day: 1, role: "local", isFallback: true }),
      debugArticle({ id: "wrong-day", day: 2, role: "direct", priority: 999 }),
      debugArticle({ id: "wrong-role", day: 1, role: "local", priority: 3 }),
    ];
    const state = makeState({ seenNews: ["seen-direct"] });
    const catalogBefore = JSON.stringify(catalog);
    const stateBefore = JSON.stringify(state);

    const selections = selectNewsForDay(1, catalog, state);
    const trace = traceNewsSelection(1, catalog, state);

    expect(trace.selections).toEqual(selections);
    expect(trace.slots.map((slot) => slot.slot)).toEqual([
      "direct",
      "trend",
      "discrepancy",
    ]);
    expect(trace.slots[2]?.allowedRoles).toEqual(["discrepancy", "local"]);
    expect(trace.slots).toHaveLength(3);
    expect(trace.slots.every((slot) => slot.candidates.length === catalog.length)).toBe(true);
    expect(
      trace.slots.flatMap((slot) =>
        slot.candidates.map((candidate) => candidate.exclusionCode),
      ),
    ).toEqual(
      expect.arrayContaining([
        "wrong-day",
        "role-not-allowed",
        "already-seen",
        "exclusive-conflict",
        "condition-failed",
        "lower-priority",
      ]),
    );
    expect(trace.slots[0]?.selectedId).toBe("selected-direct");
    expect(trace.slots[1]?.selectedId).toBe("selected-trend");
    expect(trace.slots[2]?.selectedId).toBe("selected-discrepancy");
    expect(trace.slots[0]?.candidates.find((candidate) => candidate.id === "failed-direct")?.conditionTrace.result).toBe(false);
    expectDeepFreeze(trace);
    expect(JSON.stringify(catalog)).toBe(catalogBefore);
    expect(JSON.stringify(state)).toBe(stateBefore);
  });

  it("traces every ending rule with parity, full-tie suppression, and all exclusion codes", () => {
    const rules: EndingDefinition[] = [
      { id: "inventory_mixup", title: "winner", priority: 300, condition: { true: true } },
      {
        id: "undead_dawnless_city",
        title: "tie suppressed",
        priority: 200,
        condition: { leadingAxis: { axis: "undead" } },
      },
      { id: "final_departure", title: "lower", priority: 100, condition: { true: true } },
      {
        id: "fully_automated_business",
        title: "failed",
        priority: 50,
        condition: { flag: { id: "missing" } },
      },
      {
        id: "city_whole_beyond",
        title: "fallback",
        priority: 0,
        condition: { true: true },
        isFallback: true,
      },
    ];
    const state = makeState();
    const rulesBefore = JSON.stringify(rules);
    const stateBefore = JSON.stringify(state);

    const expected = determineEnding(state, {}, rules);
    const trace = traceEndingResolution(state, {}, rules);

    expect(trace.selectedResolution).toEqual(expected);
    expect(trace.rules).toHaveLength(rules.length);
    expect(trace.rules.map((rule) => rule.id)).toEqual([
      "inventory_mixup",
      "undead_dawnless_city",
      "final_departure",
      "fully_automated_business",
      "city_whole_beyond",
    ]);
    expect(trace.rules.map((rule) => rule.exclusionCode)).toEqual([
      null,
      "tie-without-convergence",
      "lower-priority",
      "condition-failed",
      "fallback-only",
    ]);
    expect(trace.rules.filter((rule) => rule.selected)).toHaveLength(1);
    expect(trace.rules.find((rule) => rule.selected)?.selectedResolution).toEqual(
      trace.selectedResolution,
    );
    expectDeepFreeze(trace);
    expect(JSON.stringify(rules)).toBe(rulesBefore);
    expect(JSON.stringify(state)).toBe(stateBefore);

    const convergedState = makeState({ world: { undead: 2, machine: 2, cosmic: 2, spirit: 2 } });
    const convergedTrace = traceEndingResolution(convergedState, { convergenceAxis: "machine" });
    expect(convergedTrace.selectedResolution).toEqual(
      determineEnding(convergedState, { convergenceAxis: "machine" }),
    );
    expect(convergedTrace.rules.find((rule) => rule.id === "fully_automated_business")?.selected).toBe(true);
    expectDeepFreeze(convergedTrace);
  });

  it("marks a selected fallback as eligible and preserves ending parity", () => {
    const state = makeState();
    const expected = determineEnding(state);
    const trace = traceEndingResolution(state);
    const selectedRule = trace.rules.find((rule) => rule.selected);

    expect(expected.isFallback).toBe(true);
    expect(trace.selectedResolution).toEqual(expected);
    expect(selectedRule).toMatchObject({
      isFallback: true,
      eligibility: true,
      exclusionCode: null,
      selected: true,
    });
    expect(trace.rules.filter((rule) => rule.selected).every((rule) => rule.eligibility)).toBe(true);
    expectDeepFreeze(trace);
  });

  it("traces aggregated effects with parity, no-op changes, immutability, and validation errors", () => {
    const state = makeState({
      world: { undead: 1 },
      stability: 0,
      awareness: 2,
      flags: ["ready"],
      customerStates: { alice: "happy" },
    });
    const effects: Effect[] = [
      { kind: "add", target: "world.undead", amount: 2 },
      { kind: "add", target: "world.undead", amount: 3 },
      { kind: "add", target: "stability", amount: 2 },
      { kind: "add", target: "stability", amount: -1 },
      { kind: "add", target: "awareness", amount: 0 },
      { kind: "setFlag", id: "ready" },
      { kind: "setFlag", id: "sold-item" },
      { kind: "setCustomerState", customerId: "alice", state: "happy" },
      { kind: "setCustomerState", customerId: "bob", state: "fed" },
    ];
    const stateBefore = JSON.stringify(state);
    const effectsBefore = JSON.stringify(effects);
    const expected = applyEffects(state, effects);
    const trace = traceEffects(state, effects);

    expect(trace.numeric).toEqual([
      { target: "world.undead", before: 1, delta: 5, after: 6 },
      { target: "stability", before: 0, delta: 1, after: 1 },
      { target: "awareness", before: 2, delta: 0, after: 2 },
    ]);
    expect(trace.flags).toEqual([
      { id: "ready", before: true, after: true, changed: false },
      { id: "sold-item", before: false, after: true, changed: true },
    ]);
    expect(trace.customerStates).toEqual([
      { customerId: "alice", before: "happy", after: "happy", changed: false },
      { customerId: "bob", before: null, after: "fed", changed: true },
    ]);
    trace.numeric.forEach((entry) => {
      const target = entry.target;
      if (target === "world.undead") {
        expect(expected.world.undead).toBe(entry.after);
      }
    });
    expect(expected.stability).toBe(1);
    expectDeepFreeze(trace);
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(effects)).toBe(effectsBefore);

    const invalid: Effect[] = [
      { kind: "setCustomerState", customerId: "alice", state: "sealed" },
      { kind: "setCustomerState", customerId: "alice", state: "remembered" },
    ];
    expect(() => traceEffects(state, invalid)).toThrow(/alice/);
  });
});
