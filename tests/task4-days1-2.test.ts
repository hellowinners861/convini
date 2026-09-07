import { describe, expect, it } from "vitest";
import { resolveNarrative } from "../src/content/narrative";
import { TASK4_DAILY_PRESENTATIONS } from "../src/content/config/presentation";
import { TASK4_DAILY_REVENUE_TARGETS } from "../src/content/config/game";
import { TASK4_CUSTOMERS } from "../src/content/customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../src/content/items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../src/content/items/ordinary";
import { TASK4_RECOMMENDATION_PAIRS } from "../src/content/pairs/axisPairs";
import { AuthoredDayPlanSchema, AuthoredEncounterSchema } from "../src/content/schemas";
import type { AuthoredEncounter, AuthoredOutcome, Narrative, ResultCopy } from "../src/content/types";
import { TASK4_DAY1_PLAN } from "../src/content/dayPlans/day1";
import { TASK4_DAY2_PLAN } from "../src/content/dayPlans/day2";
import { TASK4_DAY1_ENCOUNTERS } from "../src/content/encounters/day1";
import { TASK4_DAY2_ENCOUNTERS } from "../src/content/encounters/day2";
import { applyOutcome, resolveEncounterQueue, resolveRecommendation, validateOutcomeEffects } from "../src/engine";
import type { Effect, GameState } from "../src/domain";
import { makeState } from "./fixtures/state";

const encounters = [...TASK4_DAY1_ENCOUNTERS, ...TASK4_DAY2_ENCOUNTERS];
const plans = [TASK4_DAY1_PLAN, TASK4_DAY2_PLAN];
const items = [...TASK4_ORDINARY_ITEMS, ...TASK4_ABNORMAL_ITEMS];

function itemById(itemId: string) {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`test catalog is missing item ${itemId}`);
  }
  return item;
}

function customerById(customerId: string) {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer) {
    throw new Error(`test catalog is missing customer ${customerId}`);
  }
  return customer;
}

function addEffects(outcome: AuthoredOutcome, target: string): Effect[] {
  return outcome.effects.filter(
    (effect): effect is Extract<Effect, { kind: "add" }> =>
      effect.kind === "add" && effect.target === target,
  );
}

function oneAdd(outcome: AuthoredOutcome, target: string): number {
  const effect = outcome.effects.find(
    (candidate): candidate is Extract<Effect, { kind: "add" }> =>
      candidate.kind === "add" && candidate.target === target,
  );
  expect(effect).toBeDefined();
  if (!effect || effect.kind !== "add") {
    throw new Error(`missing numeric effect ${target}`);
  }
  return effect.amount;
}

function noAdd(outcome: AuthoredOutcome, target: string): void {
  expect(addEffects(outcome, target)).toHaveLength(0);
}

function stateEffect(outcome: AuthoredOutcome, customerId: string): string | undefined {
  const effect = outcome.effects.find(
    (candidate): candidate is Extract<Effect, { kind: "setCustomerState" }> =>
      candidate.kind === "setCustomerState" && candidate.customerId === customerId,
  );
  return effect?.state;
}

function narrativeStrings(narrative: Narrative): string[] {
  if (typeof narrative === "string") {
    return [narrative];
  }
  return [narrative.fallback, ...narrative.variants.map((variant) => variant.text)];
}

function assertCopy(copy: ResultCopy): void {
  for (const narrative of [copy.result, copy.readback, copy.receipt]) {
    for (const text of narrativeStrings(narrative)) {
      expect(text.trim()).not.toBe("");
    }
  }
}

function assertNarrativeContract(narrative: Narrative): void {
  if (typeof narrative === "string") {
    expect(narrative.trim()).not.toBe("");
    return;
  }
  expect(narrative.fallback.trim()).not.toBe("");
  expect(narrative.variants.length).toBeGreaterThan(0);
  for (const variant of narrative.variants) {
    expect(variant.id.trim()).not.toBe("");
    expect(variant.text.trim()).not.toBe("");
  }
}

function allEncounterProse(encounter: AuthoredEncounter): string[] {
  return [
    ...narrativeStrings(encounter.intro),
    ...narrativeStrings(encounter.scan),
    ...encounter.recommendationOptions.flatMap((option) => [
      ...narrativeStrings(option.resultCopy.result),
      ...narrativeStrings(option.resultCopy.readback),
      ...narrativeStrings(option.resultCopy.receipt),
    ]),
    ...Object.values(encounter.outcomes).flatMap((outcome) => [
      ...narrativeStrings(outcome.copy.result),
      ...narrativeStrings(outcome.copy.readback),
      ...narrativeStrings(outcome.copy.receipt),
    ]),
  ];
}

function stateAt(day: 1 | 2, customerStates: Record<string, string> = {}): GameState {
  return makeState({ day, customerStates });
}

describe("CONTENT-004D Day 1 and Day 2 authored content", () => {
  it("keeps the exact encounter order, IDs, customers, requests, and recommendation counts", () => {
    expect(TASK4_DAY1_ENCOUNTERS.map((encounter) => encounter.id)).toEqual([
      "d1_taxi_baseline",
      "d1_miyashita_baseline",
      "d1_ren_only_child",
      "d1_hayakawa_first",
      "d1_hotaru_first",
    ]);
    expect(TASK4_DAY2_ENCOUNTERS.map((encounter) => encounter.id)).toEqual([
      "d2_miyashita_undead_echo",
      "d2_hako3_first",
      "d2_construction_sales_rule",
      "d2_ren_spirit_echo",
      "d2_mew_first",
      "d2_hayakawa_return",
    ]);
    expect(TASK4_DAY1_ENCOUNTERS.map(({ customerId, requestedItemId }) => [customerId, requestedItemId])).toEqual([
      ["taxi_driver", "black_coffee"],
      ["miyashita", "sandwich"],
      ["ren", "milk"],
      ["hayakawa", "raw_meat_onigiri"],
      ["hotaru", "returning_soul_incense"],
    ]);
    expect(TASK4_DAY2_ENCOUNTERS.map(({ customerId, requestedItemId }) => [customerId, requestedItemId])).toEqual([
      ["miyashita", "black_coffee"],
      ["hako3", "self_aware_battery"],
      ["construction_worker", "bento"],
      ["ren", "milk"],
      ["mew", "zero_gravity_cup_noodles"],
      ["hayakawa", "raw_meat_onigiri"],
    ]);
    expect(TASK4_DAY1_ENCOUNTERS.map((encounter) => encounter.recommendationOptions.map((option) => option.itemId))).toEqual([
      ["mint_gum"],
      ["black_coffee"],
      ["pencil"],
      ["mask", "counter_chicken"],
      ["photo_print_ticket", "purifying_salt"],
    ]);
    expect(TASK4_DAY2_ENCOUNTERS.map((encounter) => encounter.recommendationOptions.map((option) => option.itemId))).toEqual([
      ["sandwich"],
      ["shojo_manga", "precision_screwdriver"],
      ["work_gloves"],
      ["pencil"],
      ["tourist_guide", "mobile_power_bank"],
      ["mask", "counter_chicken"],
    ]);
    expect(encounters).toHaveLength(11);
    expect(new Set(encounters.map((encounter) => encounter.id)).size).toBe(11);
  });

  it("parses every encounter and plan and keeps all catalog references valid", () => {
    const itemIds = new Set(items.map((item) => item.id));
    const customerIds = new Set(TASK4_CUSTOMERS.map((customer) => customer.id));

    for (const encounter of encounters) {
      expect(AuthoredEncounterSchema.parse(encounter)).toEqual(encounter);
      expect(customerIds.has(encounter.customerId)).toBe(true);
      expect(itemIds.has(encounter.requestedItemId)).toBe(true);
      expect("recommendationPairs" in encounter).toBe(false);
      for (const option of encounter.recommendationOptions) {
        expect(itemIds.has(option.itemId)).toBe(true);
        expect(option.itemId).not.toBe(encounter.requestedItemId);
        assertCopy(option.resultCopy);
      }
      for (const outcome of Object.values(encounter.outcomes)) {
        expect(AuthoredEncounterSchema.parse(encounter).outcomes).toBeDefined();
        validateOutcomeEffects(outcome);
        assertCopy(outcome.copy);
      }
      assertNarrativeContract(encounter.intro);
      assertNarrativeContract(encounter.scan);
    }

    expect(AuthoredDayPlanSchema.parse(TASK4_DAY1_PLAN)).toEqual(TASK4_DAY1_PLAN);
    expect(AuthoredDayPlanSchema.parse(TASK4_DAY2_PLAN)).toEqual(TASK4_DAY2_PLAN);
  });

  it("uses the exact five/six fallback-backed slots and accepted daily targets/presentations", () => {
    expect(TASK4_DAY1_PLAN.day).toBe(1);
    expect(TASK4_DAY1_PLAN.slots.map((slot) => slot.id)).toEqual([
      "slot_d1_01",
      "slot_d1_02",
      "slot_d1_03",
      "slot_d1_04",
      "slot_d1_05",
    ]);
    expect(TASK4_DAY1_PLAN.slots.map((slot) => slot.fallbackEncounterId)).toEqual(
      TASK4_DAY1_ENCOUNTERS.map((encounter) => encounter.id),
    );
    expect(TASK4_DAY2_PLAN.day).toBe(2);
    expect(TASK4_DAY2_PLAN.slots.map((slot) => slot.id)).toEqual([
      "slot_d2_01",
      "slot_d2_02",
      "slot_d2_03",
      "slot_d2_04",
      "slot_d2_05",
      "slot_d2_06",
    ]);
    expect(TASK4_DAY2_PLAN.slots.map((slot) => slot.fallbackEncounterId)).toEqual(
      TASK4_DAY2_ENCOUNTERS.map((encounter) => encounter.id),
    );

    for (const plan of plans) {
      expect(plan.slots.length === 5 || plan.slots.length === 6).toBe(true);
      expect(new Set(plan.slots.map((slot) => slot.id)).size).toBe(plan.slots.length);
      expect(plan.slots.every((slot) => slot.candidates.length === 0)).toBe(true);
      expect(new Set(plan.slots.map((slot) => slot.fallbackEncounterId)).size).toBe(plan.slots.length);
    }
    expect(TASK4_DAY1_PLAN.revenueTarget).toBe(TASK4_DAILY_REVENUE_TARGETS[1]);
    expect(TASK4_DAY2_PLAN.revenueTarget).toBe(TASK4_DAILY_REVENUE_TARGETS[2]);
    expect(TASK4_DAY1_PLAN.presentation).toBe(TASK4_DAILY_PRESENTATIONS[0]);
    expect(TASK4_DAY2_PLAN.presentation).toBe(TASK4_DAILY_PRESENTATIONS[1]);
  });

  it("keeps normal and abnormal outcome effect semantics and exact catalog-price revenue", () => {
    const abnormalItemIds = new Set(TASK4_ABNORMAL_ITEMS.map((item) => item.id));

    for (const encounter of encounters) {
      const requestedPrice = itemById(encounter.requestedItemId).price;
      const recommendedPrice = itemById(encounter.recommendationOptions[0].itemId).price;
      const axis = customerById(encounter.customerId).axis;
      const abnormal = abnormalItemIds.has(encounter.requestedItemId);

      expect(oneAdd(encounter.outcomes.sell, "revenue.total")).toBe(requestedPrice);
      expect(oneAdd(encounter.outcomes.sell, "revenue.today")).toBe(requestedPrice);
      expect(oneAdd(encounter.outcomes.defaultRecommend, "revenue.total")).toBe(
        requestedPrice + recommendedPrice,
      );
      expect(oneAdd(encounter.outcomes.defaultRecommend, "revenue.today")).toBe(
        requestedPrice + recommendedPrice,
      );
      expect(oneAdd(encounter.outcomes.refuse, "managerTrust")).toBe(-1);

      if (abnormal) {
        expect(axis).toBeDefined();
        expect(oneAdd(encounter.outcomes.sell, `world.${axis}`)).toBe(2);
        expect(oneAdd(encounter.outcomes.defaultRecommend, `world.${axis}`)).toBe(2);
        expect(oneAdd(encounter.outcomes.refuse, `world.${axis}`)).toBe(1);
        expect(oneAdd(encounter.outcomes.refuse, "stability")).toBe(-1);
        noAdd(encounter.outcomes.refuse, "revenue.total");
        noAdd(encounter.outcomes.refuse, "revenue.today");
      } else {
        expect(axis).toBeUndefined();
        noAdd(encounter.outcomes.sell, "world.undead");
        noAdd(encounter.outcomes.sell, "world.machine");
        noAdd(encounter.outcomes.sell, "world.cosmic");
        noAdd(encounter.outcomes.sell, "world.spirit");
        noAdd(encounter.outcomes.defaultRecommend, "stability");
      }
    }

    const d1Hayakawa = TASK4_DAY1_ENCOUNTERS[3];
    const d1Hotaru = TASK4_DAY1_ENCOUNTERS[4];
    const d2Hayakawa = TASK4_DAY2_ENCOUNTERS[5];
    expect(stateEffect(d1Hayakawa.outcomes.sell, "hayakawa")).toBe("fed");
    expect(stateEffect(d1Hayakawa.outcomes.defaultRecommend, "hayakawa")).toBe("fed");
    expect(stateEffect(d1Hayakawa.outcomes.refuse, "hayakawa")).toBe("desperate");
    expect(stateEffect(d1Hotaru.outcomes.sell, "hotaru")).toBe("calling");
    expect(stateEffect(d1Hotaru.outcomes.defaultRecommend, "hotaru")).toBe("calling");
    expect(stateEffect(d1Hotaru.outcomes.refuse, "hotaru")).toBe("wandering");
    expect(stateEffect(d2Hayakawa.outcomes.sell, "hayakawa")).toBe("fed");
    expect(stateEffect(d2Hayakawa.outcomes.defaultRecommend, "hayakawa")).toBe("fed");
    expect(stateEffect(d2Hayakawa.outcomes.refuse, "hayakawa")).toBe("desperate");
  });

  it("covers every abnormal recommendation option with exactly one locked global pair", () => {
    for (const encounter of encounters) {
      if (!TASK4_ABNORMAL_ITEMS.some((item) => item.id === encounter.requestedItemId)) {
        expect(encounter.recommendationOptions).toHaveLength(1);
        continue;
      }

      expect(encounter.recommendationOptions).toHaveLength(2);
      for (const option of encounter.recommendationOptions) {
        const matches = TASK4_RECOMMENDATION_PAIRS.filter(
          (pair) =>
            "true" in pair.conditions &&
              pair.customerId === encounter.customerId &&
            pair.requestedItemId === encounter.requestedItemId &&
            pair.recommendedItemId === option.itemId,
        );
        expect(matches).toHaveLength(1);
        expect(matches[0].mode).toBe("replace-base-sale");
        expect("copy" in matches[0].outcome).toBe(false);
      }
    }
  });

  it("resolves all prior-state narrative variants and genuine fallbacks deterministically", () => {
    const miyashita = TASK4_DAY2_ENCOUNTERS[0];
    const miyashitaStates = [
      ["integrating", "不死者"],
      ["fed", "落ち着"],
      ["ravenous", "咬傷"],
      ["desperate", "行方不明"],
    ] as const;
    for (const [state, expected] of miyashitaStates) {
      const stateSnapshot = stateAt(2, { hayakawa: state });
      expect(resolveNarrative(miyashita.intro, stateSnapshot)).toContain(expected);
      expect(resolveNarrative(miyashita.outcomes.sell.copy.readback, stateSnapshot)).toContain(expected);
    }
    expect(resolveNarrative(miyashita.intro, stateAt(2))).toContain("はっきりしない");
    expect(resolveNarrative(miyashita.outcomes.sell.copy.readback, stateAt(2))).toContain("判断できない");

    const ren = TASK4_DAY2_ENCOUNTERS[3];
    const renStates = [
      ["remembered", "姉"],
      ["calling", "名前"],
      ["sealed", "影"],
      ["wandering", "喪失"],
    ] as const;
    for (const [state, expected] of renStates) {
      const stateSnapshot = stateAt(2, { hotaru: state });
      expect(resolveNarrative(ren.intro, stateSnapshot)).toContain(expected);
      expect(resolveNarrative(ren.outcomes.sell.copy.readback, stateSnapshot)).toContain(expected);
    }
    expect(resolveNarrative(ren.intro, stateAt(2))).toContain("分からない");

    const hayakawa = TASK4_DAY2_ENCOUNTERS[5];
    const hayakawaStates = [
      ["integrating", "馴染んで"],
      ["ravenous", "匂い"],
      ["desperate", "空腹"],
      ["fed", "まし"],
    ] as const;
    for (const [state, expected] of hayakawaStates) {
      const stateSnapshot = stateAt(2, { hayakawa: state });
      expect(resolveNarrative(hayakawa.intro, stateSnapshot)).toContain(expected);
      expect(resolveNarrative(hayakawa.outcomes.sell.copy.result, stateSnapshot)).toBeTruthy();
    }
    expect(resolveNarrative(hayakawa.intro, stateAt(2))).toContain("季節限定");
  });

  it("resolves the fixed queues deterministically and does not mutate content or pairs", () => {
    const contentBefore = structuredClone({ encounters, plans });
    const pairsBefore = structuredClone(TASK4_RECOMMENDATION_PAIRS);
    const day1State = stateAt(1, { hayakawa: "fed", hotaru: "calling" });
    const day2State = stateAt(2, { hayakawa: "ravenous", hotaru: "sealed" });

    const day1First = resolveEncounterQueue(TASK4_DAY1_PLAN, day1State);
    const day1Second = resolveEncounterQueue(TASK4_DAY1_PLAN, day1State);
    const day2First = resolveEncounterQueue(TASK4_DAY2_PLAN, day2State);
    const day2Second = resolveEncounterQueue(TASK4_DAY2_PLAN, day2State);
    expect(day1First.encounterIds).toEqual(TASK4_DAY1_ENCOUNTERS.map((encounter) => encounter.id));
    expect(day1Second).toEqual(day1First);
    expect(day2First.encounterIds).toEqual(TASK4_DAY2_ENCOUNTERS.map((encounter) => encounter.id));
    expect(day2Second).toEqual(day2First);

    for (const encounter of encounters) {
      applyOutcome(day1State, encounter.outcomes.sell);
    }
    for (const pair of TASK4_RECOMMENDATION_PAIRS) {
      resolveRecommendation({
        state: day2State,
        customerId: pair.customerId,
        requestedItemId: pair.requestedItemId,
        recommendedItemId: pair.recommendedItemId,
        pairs: TASK4_RECOMMENDATION_PAIRS,
        baseSale: { id: "task4-test-base", effects: [] },
        defaultOutcome: { id: "task4-test-default", effects: [] },
      });
      applyOutcome(day2State, pair.outcome);
    }

    expect({ encounters, plans }).toEqual(contentBefore);
    expect(TASK4_RECOMMENDATION_PAIRS).toEqual(pairsBefore);
    expect(day1State).toEqual(stateAt(1, { hayakawa: "fed", hotaru: "calling" }));
    expect(day2State).toEqual(stateAt(2, { hayakawa: "ravenous", hotaru: "sealed" }));
  });

  it("keeps authored prose Japanese, restrained, and free of implementation or score disclosure", () => {
    const prose = encounters.flatMap(allEncounterProse).join("\n");
    expect(prose).not.toMatch(/TODO|FIXME|fixture|placeholder|dev-note|world\.|stability|awareness|managerTrust|score|random|Date|フラグ|スコア|安定度|認識度|世界線|エンディング|永続/i);
    expect(prose).not.toContain("数値");
  });
});
