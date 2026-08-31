import { describe, expect, it } from "vitest";
import { ENDING_IDS, NewsArticleSchema } from "../src/domain";
import type { Condition, EndingDefinition, NewsArticle } from "../src/domain";
import {
  NEWS_CANONICAL_SLOTS,
  NEWS_CONTENT_VERSION,
  NEWS_FALLBACK_PRIORITY,
  NEWS_FINAL_REFUSAL_PRIORITY,
  NEWS_NORMAL_PRIORITY,
  NEWS_PER_DAY_COUNTS,
  NEWS_READ_TOTAL,
  NEWS_ROLE_TOTALS,
  NEWS_SELECTED_PER_DAY,
  NEWS_SELECTED_TOTAL,
  NEWS_TOTAL,
  NewsCatalogSchema,
  TASK5_CONTENT_VERSION as NEWS_TASK5_CONTENT_VERSION,
  TASK5_NEWS_CANONICAL_SLOTS,
  TASK5_NEWS_CONTRACT,
  TASK5_NEWS_CONTENT_VERSION,
  TASK5_NEWS_FALLBACK_PRIORITY,
  TASK5_NEWS_FINAL_REFUSAL_PRIORITY,
  TASK5_NEWS_NORMAL_PRIORITY,
  TASK5_NEWS_PER_DAY_COUNTS,
  TASK5_NEWS_READ_TOTAL,
  TASK5_NEWS_ROLE_TOTALS,
  TASK5_NEWS_SELECTED_PER_DAY,
  TASK5_NEWS_SELECTED_TOTAL,
  TASK5_NEWS_TOTAL,
} from "../src/content/news/contracts";
import {
  EndingBundleSchema,
  EndingRecordSchema,
  GoldenRouteSchema,
  TASK5_CONTENT_VERSION as ENDINGS_TASK5_CONTENT_VERSION,
} from "../src/content/endings/contracts";
import type {
  EndingBundle,
  EndingRecord,
  GoldenRoute,
  GoldenRouteDecision,
} from "../src/content/endings/contracts";

const always: Condition = { true: true };

function makeArticle(id = "news-one"): NewsArticle {
  return {
    id,
    day: 1,
    role: "direct",
    notificationHeadline: "通知見出し",
    headline: "見出し",
    body: "本文",
    conditions: always,
    priority: 200,
    effectsOnRead: [],
    isFallback: false,
  };
}

function makeNewsCatalog() {
  return {
    contentVersion: TASK5_NEWS_CONTENT_VERSION,
    articles: [makeArticle()],
  };
}

function makeRule(id: EndingDefinition["id"], isFallback = false): EndingDefinition {
  return {
    id,
    title: `rule-${id}`,
    priority: isFallback ? 0 : 100,
    condition: always,
    isFallback,
  };
}

function makePresentation(id: string): EndingRecord["presentation"] {
  return {
    title: `title-${id}`,
    lead: `lead-${id}`,
    body: {
      variants: [
        {
          id: `body-variant-${id}`,
          condition: always,
          priority: 1,
          text: `body-${id}`,
        },
      ],
      fallback: `body-fallback-${id}`,
    },
    finalLine: {
      variants: [],
      fallback: `final-line-${id}`,
    },
    runSummary: `summary-${id}`,
  };
}

function makeEndingRecord(id: EndingDefinition["id"], includeFallback = false): EndingRecord {
  return {
    id,
    rules: includeFallback ? [makeRule(id), makeRule(id, true)] : [makeRule(id)],
    presentation: makePresentation(id),
  };
}

function makeRoute(decisions: GoldenRouteDecision[] = [{
  encounterId: "canonical-encounter-1",
  recommendedItemId: "mask",
}]): GoldenRoute {
  return {
    id: "golden-undead",
    decisions,
    expected: {
      endingId: "undead_dawnless_city",
      world: { undead: 8, machine: 0, cosmic: 0, spirit: 0 },
      stability: -2,
      awareness: 3,
      convergenceAxis: "undead",
      customerStates: { hayakawa: "runaway" },
      flags: ["route-complete"],
      encounterDecisionCount: 1,
      completedDayCount: 5,
      selectedNewsCount: 15,
      readNewsCount: 15,
    },
  };
}

function makeBundle(): EndingBundle {
  return {
    contentVersion: ENDINGS_TASK5_CONTENT_VERSION,
    records: [
      makeEndingRecord(ENDING_IDS[0]),
      makeEndingRecord(ENDING_IDS[1]),
      makeEndingRecord(ENDING_IDS[2]),
      makeEndingRecord(ENDING_IDS[3]),
      makeEndingRecord(ENDING_IDS[4], true),
    ],
    routes: [makeRoute()],
  };
}

describe("Task 5 frozen content contracts", () => {
  it("parses a minimal news wrapper and reuses strict NewsArticleSchema", () => {
    const catalog = makeNewsCatalog();

    expect(NewsCatalogSchema.parse(catalog)).toEqual(catalog);
    expect(NewsCatalogSchema.safeParse({ ...catalog, extra: true }).success).toBe(false);
    expect(
      NewsCatalogSchema.safeParse({
        ...catalog,
        articles: [{ ...catalog.articles[0], extra: true }],
      }).success,
    ).toBe(false);
    expect(
      NewsCatalogSchema.safeParse({
        ...catalog,
        articles: [{ ...catalog.articles[0], id: "" }],
      }).success,
    ).toBe(false);
    expect(
      NewsCatalogSchema.safeParse({
        ...catalog,
        articles: [{ ...catalog.articles[0], body: "  " }],
      }).success,
    ).toBe(false);
    expect(NewsArticleSchema.safeParse({ ...catalog.articles[0], id: "" }).success).toBe(false);
  });

  it("exposes the frozen news counts, priorities, slots, and version", () => {
    expect(TASK5_NEWS_CONTENT_VERSION).toBe("task5-authored-v1");
    expect(NEWS_TASK5_CONTENT_VERSION).toBe("task5-authored-v1");
    expect(NEWS_CONTENT_VERSION).toBe("task5-authored-v1");
    expect(TASK5_NEWS_TOTAL).toBe(30);
    expect(NEWS_TOTAL).toBe(30);
    expect(TASK5_NEWS_PER_DAY_COUNTS).toEqual({ 1: 6, 2: 6, 3: 5, 4: 5, 5: 8 });
    expect(NEWS_PER_DAY_COUNTS).toEqual({ 1: 6, 2: 6, 3: 5, 4: 5, 5: 8 });
    expect(TASK5_NEWS_ROLE_TOTALS).toEqual({ direct: 10, trend: 15, discrepancy: 4, local: 1 });
    expect(NEWS_ROLE_TOTALS).toEqual({ direct: 10, trend: 15, discrepancy: 4, local: 1 });
    expect(TASK5_NEWS_SELECTED_PER_DAY).toBe(3);
    expect(NEWS_SELECTED_PER_DAY).toBe(3);
    expect(TASK5_NEWS_SELECTED_TOTAL).toBe(15);
    expect(NEWS_SELECTED_TOTAL).toBe(15);
    expect(TASK5_NEWS_READ_TOTAL).toBe(15);
    expect(NEWS_READ_TOTAL).toBe(15);
    expect(TASK5_NEWS_FALLBACK_PRIORITY).toBe(-100);
    expect(NEWS_FALLBACK_PRIORITY).toBe(-100);
    expect(TASK5_NEWS_NORMAL_PRIORITY).toBe(200);
    expect(NEWS_NORMAL_PRIORITY).toBe(200);
    expect(TASK5_NEWS_FINAL_REFUSAL_PRIORITY).toBe(300);
    expect(NEWS_FINAL_REFUSAL_PRIORITY).toBe(300);
    expect(TASK5_NEWS_CANONICAL_SLOTS).toEqual(["direct", "trend", "discrepancy"]);
    expect(NEWS_CANONICAL_SLOTS).toEqual(["direct", "trend", "discrepancy"]);
    expect(TASK5_NEWS_CONTRACT).toMatchObject({
      contentVersion: "task5-authored-v1",
      total: 30,
      selectedPerDay: 3,
      selectedTotal: 15,
      readTotal: 15,
      priorities: { fallback: -100, normal: 200, finalRefusal: 300 },
      canonicalSlots: ["direct", "trend", "discrepancy"],
    });
  });

  it("parses a valid five-record, six-rule-shaped ending bundle", () => {
    const bundle = makeBundle();

    expect(EndingBundleSchema.safeParse(bundle).success).toBe(true);
    expect(bundle.records).toHaveLength(5);
    expect(bundle.records.reduce((total, record) => total + record.rules.length, 0)).toBe(6);
    expect(bundle.records[4].rules).toHaveLength(2);
    expect(bundle.routes).toHaveLength(1);
  });

  it("rejects unknown keys and blank narrative fields", () => {
    const unknown = structuredClone(makeBundle());
    const presentation = unknown.records[0].presentation as EndingRecord["presentation"] & {
      extra?: unknown;
    };
    presentation.extra = true;
    expect(EndingBundleSchema.safeParse(unknown).success).toBe(false);

    const blankTitle = structuredClone(makeBundle());
    blankTitle.records[0].presentation.title = "  ";
    expect(EndingBundleSchema.safeParse(blankTitle).success).toBe(false);

    const blankLead = structuredClone(makeBundle());
    blankLead.records[0].presentation.lead = "";
    expect(EndingBundleSchema.safeParse(blankLead).success).toBe(false);

    const blankBody = structuredClone(makeBundle());
    blankBody.records[0].presentation.body.fallback = "\t";
    expect(EndingBundleSchema.safeParse(blankBody).success).toBe(false);

    const blankFinalLine = structuredClone(makeBundle());
    blankFinalLine.records[0].presentation.finalLine.fallback = "";
    expect(EndingBundleSchema.safeParse(blankFinalLine).success).toBe(false);
  });

  it("rejects duplicate route encounters and arbitrary override/effect keys", () => {
    const duplicate = structuredClone(makeBundle());
    duplicate.routes[0].decisions.push({ ...duplicate.routes[0].decisions[0] });
    expect(GoldenRouteSchema.safeParse(duplicate.routes[0]).success).toBe(false);

    const invalid = structuredClone(makeBundle());
    const invalidRoute = invalid.routes[0] as GoldenRoute & {
      stateOverride?: unknown;
      effects?: unknown;
    };
    invalidRoute.stateOverride = { world: { machine: 99 } };
    invalidRoute.effects = [{ kind: "add", target: "world.machine", amount: 99 }];
    expect(GoldenRouteSchema.safeParse(invalidRoute).success).toBe(false);

    const invalidDecision = structuredClone(makeBundle());
    const decision = invalidDecision.routes[0].decisions[0] as GoldenRouteDecision & {
      effects?: unknown;
    };
    decision.effects = [];
    expect(GoldenRouteSchema.safeParse(invalidDecision.routes[0]).success).toBe(false);
  });

  it("rejects duplicate non-fallback rule IDs while preserving the domain fallback pair", () => {
    const invalid = structuredClone(makeBundle());
    invalid.records[0].rules.push({ ...invalid.records[0].rules[0] });
    expect(EndingRecordSchema.safeParse(invalid.records[0]).success).toBe(false);
    expect(EndingRecordSchema.safeParse(makeBundle().records[4]).success).toBe(true);
  });

  it("does not mutate inputs while parsing", () => {
    const newsInput = makeNewsCatalog();
    const newsBefore = structuredClone(newsInput);
    NewsCatalogSchema.parse(newsInput);
    expect(newsInput).toEqual(newsBefore);

    const bundleInput = makeBundle();
    const bundleBefore = structuredClone(bundleInput);
    EndingBundleSchema.parse(bundleInput);
    expect(bundleInput).toEqual(bundleBefore);
  });
});
