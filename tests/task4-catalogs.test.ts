import { describe, expect, it } from "vitest";
import {
  AbnormalItemDefinitionSchema,
  AuthoredOutcomeSchema,
  BriefingPresentationSchema,
  CustomerDefinitionSchema,
  OrdinaryItemDefinitionSchema,
  ShiftSummaryPresentationSchema,
} from "../src/content/schemas";
import {
  CATALOG_COUNTS,
  TASK4_CONTENT_VERSION,
  TASK4_DAILY_REVENUE_TARGETS,
} from "../src/content/config/game";
import {
  TASK4_DAILY_PRESENTATIONS,
  TASK4_MANAGER_BRIEFINGS,
  TASK4_SHIFT_SUMMARIES,
} from "../src/content/config/presentation";
import {
  abnormalBaseSellEffects,
  abnormalBaseSellOutcome,
  abnormalDefaultRecommendationEffects,
  abnormalDefaultRecommendationOutcome,
  abnormalRefusalEffects,
  coexistPairEffects,
  coexistReplacementPairOutcome,
  createOrdinaryDefaultRecommendationOutcome,
  createOrdinaryRefusalOutcome,
  createOrdinarySaleOutcome,
  runawayPairEffects,
  runawayReplacementPairOutcome,
} from "../src/content/config/outcomes";
import { TASK4_CUSTOMERS } from "../src/content/customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../src/content/items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../src/content/items/ordinary";
import type { Effect } from "../src/domain";
import type { ResultCopy } from "../src/content/types";

const copy = (label: string): ResultCopy => ({
  result: `${label}の結果`,
  readback: `${label}を確認した。`,
  receipt: `${label}のレシート`,
});

function markerFree(value: unknown): void {
  expect(JSON.stringify(value)).not.toMatch(/TODO|FIXME|fixture|placeholder|dev-note/i);
}

describe("Task 4 base catalogs", () => {
  it("contains the exact authored customer cast and parses every entry", () => {
    expect(TASK4_CUSTOMERS).toHaveLength(10);
    expect(TASK4_CUSTOMERS.map((customer) => customer.id)).toEqual([
      "hayakawa",
      "hako3",
      "mew",
      "hotaru",
      "miyashita",
      "ren",
      "manager",
      "taxi_driver",
      "construction_worker",
      "elder",
    ]);
    expect(TASK4_CUSTOMERS.filter((customer) => customer.role === "major")).toHaveLength(6);
    expect(TASK4_CUSTOMERS.filter((customer) => customer.role === "staff")).toHaveLength(1);
    expect(TASK4_CUSTOMERS.filter((customer) => customer.role === "incidental")).toHaveLength(3);
    expect(TASK4_CUSTOMERS.filter((customer) => customer.axis)).toMatchObject([
      { id: "hayakawa", axis: "undead" },
      { id: "hako3", axis: "machine" },
      { id: "mew", axis: "cosmic" },
      { id: "hotaru", axis: "spirit" },
    ]);

    for (const customer of TASK4_CUSTOMERS) {
      expect(CustomerDefinitionSchema.parse(customer)).toEqual(customer);
      expect(customer.description.trim()).not.toBe("");
      markerFree(customer);
    }
  });

  it("contains exactly the twelve abnormal item roles and parses every entry", () => {
    expect(TASK4_ABNORMAL_ITEMS).toHaveLength(12);
    expect(TASK4_ABNORMAL_ITEMS.map((item) => item.id)).toEqual([
      "raw_meat_onigiri",
      "mask",
      "counter_chicken",
      "self_aware_battery",
      "shojo_manga",
      "precision_screwdriver",
      "zero_gravity_cup_noodles",
      "tourist_guide",
      "mobile_power_bank",
      "returning_soul_incense",
      "photo_print_ticket",
      "purifying_salt",
    ]);
    expect(TASK4_ABNORMAL_ITEMS.map(({ axis, anomalyRole }) => `${axis}:${anomalyRole}`)).toEqual([
      "undead:base",
      "undead:coexist",
      "undead:runaway",
      "machine:base",
      "machine:coexist",
      "machine:runaway",
      "cosmic:base",
      "cosmic:coexist",
      "cosmic:runaway",
      "spirit:base",
      "spirit:coexist",
      "spirit:runaway",
    ]);

    for (const item of TASK4_ABNORMAL_ITEMS) {
      expect(AbnormalItemDefinitionSchema.parse(item)).toEqual(item);
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      markerFree(item);
    }
  });

  it("contains only the eight ordinary items with locked prices", () => {
    expect(TASK4_ORDINARY_ITEMS).toHaveLength(8);
    expect(TASK4_ORDINARY_ITEMS.map((item) => item.id)).toEqual([
      "black_coffee",
      "mint_gum",
      "sandwich",
      "milk",
      "pencil",
      "bento",
      "work_gloves",
      "newspaper",
    ]);
    expect(Object.fromEntries(TASK4_ORDINARY_ITEMS.map((item) => [item.id, item.price]))).toEqual({
      black_coffee: 180,
      mint_gum: 120,
      sandwich: 320,
      milk: 210,
      pencil: 100,
      bento: 580,
      work_gloves: 390,
      newspaper: 180,
    });
    for (const item of TASK4_ORDINARY_ITEMS) {
      expect(OrdinaryItemDefinitionSchema.parse(item)).toEqual(item);
      markerFree(item);
    }
  });

  it("keeps the Task 4 targets and catalog counts canonical", () => {
    expect(TASK4_CONTENT_VERSION).toMatch(/^task4-/);
    expect(TASK4_DAILY_REVENUE_TARGETS).toEqual({ 1: 1200, 2: 1900, 3: 1900, 4: 2000, 5: 2000 });
    expect(CATALOG_COUNTS).toEqual({
      days: 5,
      customers: 10,
      majorCustomers: 6,
      staffCustomers: 1,
      incidentalCustomers: 3,
      abnormalItems: 12,
      ordinaryItems: 8,
      items: 20,
    });
  });
});

describe("Task 4 outcome builders", () => {
  it("records each sale in total and today without mutating additional effects", () => {
    const additional: Effect[] = [{ kind: "add", target: "awareness", amount: 1 }];
    const before = structuredClone(additional);
    const outcome = createOrdinarySaleOutcome("ordinary-sale", 180, copy("販売"), additional);

    expect(outcome.effects).toEqual([
      { kind: "add", target: "revenue.total", amount: 180 },
      { kind: "add", target: "revenue.today", amount: 180 },
      ...additional,
    ]);
    expect(additional).toEqual(before);
    expect(AuthoredOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it("builds ordinary recommendation and refusal outcomes with authored copy", () => {
    const recommendation = createOrdinaryDefaultRecommendationOutcome(
      "ordinary-recommend",
      180,
      120,
      copy("おすすめ"),
    );
    expect(recommendation.effects).toEqual([
      { kind: "add", target: "revenue.total", amount: 300 },
      { kind: "add", target: "revenue.today", amount: 300 },
    ]);

    const refusal = createOrdinaryRefusalOutcome("ordinary-refusal", copy("拒否"));
    expect(refusal.effects).toEqual([{ kind: "add", target: "managerTrust", amount: -1 }]);
    expect(AuthoredOutcomeSchema.parse(recommendation)).toEqual(recommendation);
    expect(AuthoredOutcomeSchema.parse(refusal)).toEqual(refusal);
  });

  it("builds abnormal base and refusal effects with the locked totals", () => {
    const base = abnormalBaseSellOutcome("undead-base", "undead", 260, copy("基本販売"));
    expect(base.effects).toEqual([
      { kind: "add", target: "revenue.total", amount: 260 },
      { kind: "add", target: "revenue.today", amount: 260 },
      { kind: "add", target: "world.undead", amount: 2 },
    ]);
    expect(abnormalBaseSellEffects("machine", 480)).toEqual([
      { kind: "add", target: "revenue.total", amount: 480 },
      { kind: "add", target: "revenue.today", amount: 480 },
      { kind: "add", target: "world.machine", amount: 2 },
    ]);
    expect(abnormalRefusalEffects("spirit")).toEqual([
      { kind: "add", target: "world.spirit", amount: 1 },
      { kind: "add", target: "stability", amount: -1 },
      { kind: "add", target: "managerTrust", amount: -1 },
    ]);
    expect(AuthoredOutcomeSchema.parse(base)).toEqual(base);
  });

  it("builds coexist and runaway special-pair effects without convergence bonuses", () => {
    expect(coexistPairEffects("cosmic")).toEqual([
      { kind: "add", target: "world.cosmic", amount: 1 },
      { kind: "add", target: "stability", amount: 2 },
    ]);
    expect(runawayPairEffects("machine")).toEqual([
      { kind: "add", target: "world.machine", amount: 3 },
      { kind: "add", target: "stability", amount: -2 },
    ]);
    expect(JSON.stringify({ coexist: coexistPairEffects("spirit"), runaway: runawayPairEffects("undead") })).not.toContain(
      "convergence",
    );
  });

  it("builds exact coexist and runaway replacement outcomes without mutating additional effects", () => {
    const coexistAdditional: Effect[] = [{ kind: "add", target: "awareness", amount: 1 }];
    const runawayAdditional: Effect[] = [{ kind: "setFlag", id: "runaway-pair" }];
    const coexistBefore = structuredClone(coexistAdditional);
    const runawayBefore = structuredClone(runawayAdditional);
    const coexist = coexistReplacementPairOutcome(
      "undead-mask-replacement",
      "undead",
      260,
      140,
      coexistAdditional,
    );
    const runaway = runawayReplacementPairOutcome(
      "undead-chicken-replacement",
      "undead",
      260,
      230,
      runawayAdditional,
    );

    expect(coexist.effects).toEqual([
      { kind: "add", target: "revenue.total", amount: 400 },
      { kind: "add", target: "revenue.today", amount: 400 },
      { kind: "add", target: "world.undead", amount: 1 },
      { kind: "add", target: "stability", amount: 2 },
      { kind: "add", target: "awareness", amount: 1 },
    ]);
    expect(runaway.effects).toEqual([
      { kind: "add", target: "revenue.total", amount: 490 },
      { kind: "add", target: "revenue.today", amount: 490 },
      { kind: "add", target: "world.undead", amount: 3 },
      { kind: "add", target: "stability", amount: -2 },
      { kind: "setFlag", id: "runaway-pair" },
    ]);
    expect(coexist.effects.filter((effect) => effect.kind === "add" && effect.target === "revenue.total")).toHaveLength(1);
    expect(runaway.effects.filter((effect) => effect.kind === "add" && effect.target === "revenue.today")).toHaveLength(1);
    expect(coexistAdditional).toEqual(coexistBefore);
    expect(runawayAdditional).toEqual(runawayBefore);
  });

  it("builds an exact abnormal default recommendation outcome with immutable additions", () => {
    const additional: Effect[] = [{ kind: "add", target: "awareness", amount: 2 }];
    const before = structuredClone(additional);
    const effects = abnormalDefaultRecommendationEffects("machine", 480, 520, additional);
    const outcome = abnormalDefaultRecommendationOutcome(
      "machine-default-recommendation",
      "machine",
      480,
      520,
      copy("異常おすすめ"),
      additional,
    );

    expect(effects).toEqual([
      { kind: "add", target: "revenue.total", amount: 1000 },
      { kind: "add", target: "revenue.today", amount: 1000 },
      { kind: "add", target: "world.machine", amount: 2 },
      { kind: "add", target: "awareness", amount: 2 },
    ]);
    expect(outcome.effects).toEqual(effects);
    expect(outcome.effects.filter((effect) => effect.kind === "add" && effect.target === "revenue.total")).toHaveLength(1);
    expect(outcome.effects.filter((effect) => effect.kind === "add" && effect.target === "revenue.today")).toHaveLength(1);
    expect(additional).toEqual(before);
    expect(AuthoredOutcomeSchema.parse(outcome)).toEqual(outcome);
  });
});

describe("Task 4 presentation", () => {
  it("parses five final briefings and shift summaries with the blueprint progression", () => {
    expect(TASK4_DAILY_PRESENTATIONS).toHaveLength(5);
    expect(TASK4_MANAGER_BRIEFINGS).toHaveLength(5);
    expect(TASK4_SHIFT_SUMMARIES).toHaveLength(5);
    expect(TASK4_DAILY_PRESENTATIONS.map((presentation) => presentation.day)).toEqual([1, 2, 3, 4, 5]);

    for (const presentation of TASK4_DAILY_PRESENTATIONS) {
      expect(BriefingPresentationSchema.parse(presentation.briefing)).toEqual(presentation.briefing);
      expect(ShiftSummaryPresentationSchema.parse(presentation.shiftSummary)).toEqual(
        presentation.shiftSummary,
      );
      markerFree(presentation);
    }

    expect(TASK4_SHIFT_SUMMARIES[0].nextAction).toContain("ニュース");
    expect(TASK4_SHIFT_SUMMARIES.slice(1, 4).map((summary) => summary.nextAction)).toEqual([
      "次の勤務へ進む",
      "次の勤務へ進む",
      "次の勤務へ進む",
    ]);
    expect(TASK4_SHIFT_SUMMARIES[4].nextAction).not.toMatch(/ニュース|エンディング|結末/);
  });
});
