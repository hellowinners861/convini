import { describe, expect, it } from "vitest";
import type { Day, Effect, NewsRole } from "../src/domain";
import { selectNewsForDay, validateNewsCatalog } from "../src/engine";
import {
  NewsCatalogSchema,
  TASK5_DAY1_NEWS,
  TASK5_DAY2_NEWS,
  TASK5_DAY3_NEWS,
  TASK5_DAY4_NEWS,
  TASK5_DAY5_NEWS,
  TASK5_NEWS,
  TASK5_NEWS_CATALOG,
  TASK5_NEWS_CONTENT_VERSION,
} from "../src/content/news";
import { makeState } from "./fixtures/state";

const DAY_NEWS = [
  TASK5_DAY1_NEWS,
  TASK5_DAY2_NEWS,
  TASK5_DAY3_NEWS,
  TASK5_DAY4_NEWS,
  TASK5_DAY5_NEWS,
] as const;

const EXPECTED_IDS = [
  [
    "news_d1_direct_hotaru_boundary",
    "news_d1_direct_fallback",
    "news_d1_trend_undead_night",
    "news_d1_trend_spirit_reflection",
    "news_d1_trend_fallback",
    "news_d1_local_clock_fallback",
  ],
  [
    "news_d2_direct_hako3_self_repair",
    "news_d2_direct_fallback",
    "news_d2_trend_machine_delivery",
    "news_d2_trend_cosmic_arrival",
    "news_d2_trend_fallback",
    "news_d2_discrepancy_hospital_fallback",
  ],
  [
    "news_d3_direct_hotaru_photo",
    "news_d3_direct_fallback",
    "news_d3_trend_system_collision",
    "news_d3_trend_fallback",
    "news_d3_discrepancy_hospital_history_fallback",
  ],
  [
    "news_d4_direct_four_systems",
    "news_d4_direct_fallback",
    "news_d4_trend_coexistence",
    "news_d4_trend_fallback",
    "news_d4_discrepancy_first_train_fallback",
  ],
  [
    "news_d5_direct_convergence_refused",
    "news_d5_direct_fallback",
    "news_d5_trend_undead",
    "news_d5_trend_machine",
    "news_d5_trend_cosmic",
    "news_d5_trend_spirit",
    "news_d5_trend_fallback",
    "news_d5_discrepancy_receipt_count_fallback",
  ],
] as const;

const EXPECTED_GROUPS: Record<string, string> = {
  news_d1_direct_hotaru_boundary: "d1_spirit_boundary",
  news_d1_trend_spirit_reflection: "d1_spirit_boundary",
  news_d2_direct_hako3_self_repair: "d2_machine_network",
  news_d2_trend_machine_delivery: "d2_machine_network",
  news_d3_direct_hotaru_photo: "d3_boundary_collision",
  news_d3_trend_system_collision: "d3_boundary_collision",
  news_d4_direct_four_systems: "d4_town_state",
  news_d4_trend_coexistence: "d4_town_state",
  news_d5_trend_undead: "d5_dominant_axis",
  news_d5_trend_machine: "d5_dominant_axis",
  news_d5_trend_cosmic: "d5_dominant_axis",
  news_d5_trend_spirit: "d5_dominant_axis",
};

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stateFor(day: Day, overrides: Parameters<typeof makeState>[0] = {}) {
  return makeState({ ...overrides, day });
}

function selectedIds(day: Day, state: Parameters<typeof makeState>[0] = {}): string[] {
  return selectNewsForDay(day, TASK5_NEWS, stateFor(day, state)).map(
    (selection) => selection.newsId,
  );
}

describe("Task 5 authored news catalog", () => {
  it("exports the exact five day arrays, IDs, counts, and role totals", () => {
    expect(DAY_NEWS.map((articles) => articles.map((article) => article.id))).toEqual(EXPECTED_IDS);
    expect(DAY_NEWS.map((articles) => articles.length)).toEqual([6, 6, 5, 5, 8]);
    expect(TASK5_NEWS).toEqual(DAY_NEWS.flat());
    expect(TASK5_NEWS).toHaveLength(30);

    const roleTotals = TASK5_NEWS.reduce<Record<NewsRole, number>>(
      (totals, article) => ({ ...totals, [article.role]: totals[article.role] + 1 }),
      { direct: 0, trend: 0, discrepancy: 0, local: 0 },
    );
    expect(roleTotals).toEqual({ direct: 10, trend: 15, discrepancy: 4, local: 1 });
    expect(new Set(TASK5_NEWS.map((article) => article.id))).toHaveLength(30);
  });

  it("uses the frozen priorities, fallback rules, groups, and wrapper shape", () => {
    expect(TASK5_NEWS_CATALOG).toEqual({
      contentVersion: TASK5_NEWS_CONTENT_VERSION,
      articles: TASK5_NEWS,
    });
    expect(NewsCatalogSchema.parse(TASK5_NEWS_CATALOG)).toEqual(TASK5_NEWS_CATALOG);
    expect(() => validateNewsCatalog(TASK5_NEWS, [1, 2, 3, 4, 5])).not.toThrow();

    for (const article of TASK5_NEWS) {
      expect(article.isFallback).toBe(article.priority === -100);
      if (article.isFallback) {
        expect(article.priority).toBe(-100);
        expect(article.conditions).toEqual({ true: true });
        expect(article.exclusiveGroup).toBeUndefined();
      } else {
        expect(article.priority).toBe(article.id === "news_d5_direct_convergence_refused" ? 300 : 200);
        expect(article.conditions).not.toEqual({ true: true });
      }
      expect(article.exclusiveGroup).toBe(EXPECTED_GROUPS[article.id]);
    }

    expect(
      TASK5_DAY5_NEWS.filter((article) => article.exclusiveGroup === "d5_dominant_axis"),
    ).toHaveLength(4);
    expect(
      TASK5_DAY5_NEWS.filter((article) => article.exclusiveGroup === undefined).map(
        (article) => article.id,
      ),
    ).toEqual([
      "news_d5_direct_convergence_refused",
      "news_d5_direct_fallback",
      "news_d5_trend_fallback",
      "news_d5_discrepancy_receipt_count_fallback",
    ]);
  });

  it("keeps every notification distinct from the current article text", () => {
    for (const article of TASK5_NEWS) {
      const notification = normalize(article.notificationHeadline);
      expect(notification).not.toBe(normalize(article.headline));
      expect(notification).not.toBe(normalize(article.body));
    }
  });

  it("gives each article exactly its read flag and awareness only to discrepancy/local news", () => {
    for (const article of TASK5_NEWS) {
      const expected: Effect[] = [{ kind: "setFlag", id: `read_${article.id}` }];
      if (article.role === "discrepancy" || article.role === "local") {
        expected.push({ kind: "add", target: "awareness", amount: 1 });
      }
      expect(article.effectsOnRead).toEqual(expected);
      expect(article.effectsOnRead.every((effect) => effect.kind !== "setCustomerState")).toBe(true);
    }
  });

  it("selects the authored candidates for witness states and enforces no group collision", () => {
    const witnesses: Array<[Day, string, Parameters<typeof makeState>[0]]> = [
      [1, "news_d1_direct_hotaru_boundary", { customerStates: { hotaru: "sealed" }, world: { undead: 5 } }],
      [1, "news_d1_trend_undead_night", { world: { undead: 5 } }],
      [1, "news_d1_trend_spirit_reflection", { world: { spirit: 5 } }],
      [2, "news_d2_direct_hako3_self_repair", { customerStates: { hako3: "self_modified" }, world: { machine: 5 } }],
      [2, "news_d2_trend_machine_delivery", { world: { machine: 5 } }],
      [2, "news_d2_trend_cosmic_arrival", { world: { cosmic: 5 } }],
      [3, "news_d3_direct_hotaru_photo", { customerStates: { hotaru: "sealed" } }],
      [3, "news_d3_trend_system_collision", { stability: -6 }],
      [4, "news_d4_direct_four_systems", { world: { undead: 4, machine: 4, cosmic: 4 }, stability: -6 }],
      [4, "news_d4_trend_coexistence", { stability: 6 }],
      [5, "news_d5_direct_convergence_refused", { flags: ["convergence_refused"], world: { undead: 5 } }],
      [5, "news_d5_trend_undead", { world: { undead: 5 } }],
      [5, "news_d5_trend_machine", { world: { machine: 5 } }],
      [5, "news_d5_trend_cosmic", { world: { cosmic: 5 } }],
      [5, "news_d5_trend_spirit", { world: { spirit: 5 } }],
    ];

    for (const [day, newsId, overrides] of witnesses) {
      expect(selectedIds(day, overrides), `${newsId} should have a witness`).toContain(newsId);
    }

    const selected = [
      ...selectedIds(1, { customerStates: { hotaru: "sealed" }, world: { spirit: 5 } }),
      ...selectedIds(2, { customerStates: { hako3: "self_modified" }, world: { machine: 5 } }),
      ...selectedIds(3, { customerStates: { hotaru: "sealed" }, stability: -6 }),
      ...selectedIds(4, { world: { undead: 4, machine: 4, cosmic: 4 }, stability: -6 }),
      ...selectedIds(5, { flags: ["convergence_refused"], world: { undead: 5 } }),
    ];
    const groups = selected
      .map((newsId) => TASK5_NEWS.find((article) => article.id === newsId)?.exclusiveGroup)
      .filter((group): group is string => group !== undefined);
    expect(groups).toEqual([...new Set(groups)]);
  });

  it("uses deterministic priorities, seen filtering, and unconditional fallbacks", () => {
    expect(selectedIds(1)).toEqual([
      "news_d1_direct_fallback",
      "news_d1_trend_fallback",
      "news_d1_local_clock_fallback",
    ]);
    expect(
      selectedIds(1, {
        customerStates: { hotaru: "sealed" },
        world: { spirit: 5 },
        seenNews: ["news_d1_direct_hotaru_boundary"],
      }),
    ).toEqual([
      "news_d1_direct_fallback",
      "news_d1_trend_spirit_reflection",
      "news_d1_local_clock_fallback",
    ]);
    expect(
      selectedIds(5, {
        flags: ["convergence_refused"],
        world: { undead: 5 },
        seenNews: [
          "news_d5_direct_convergence_refused",
          "news_d5_trend_undead",
        ],
      }),
    ).toEqual([
      "news_d5_direct_fallback",
      "news_d5_trend_fallback",
      "news_d5_discrepancy_receipt_count_fallback",
    ]);
  });
});
