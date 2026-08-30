import { describe, expect, it } from "vitest";
import { resolveNarrative } from "../src/content/narrative";
import { TASK4_DAILY_PRESENTATIONS } from "../src/content/config/presentation";
import { TASK4_DAILY_REVENUE_TARGETS } from "../src/content/config/game";
import { TASK4_CUSTOMERS } from "../src/content/customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../src/content/items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../src/content/items/ordinary";
import { TASK4_DAY3_PLAN } from "../src/content/dayPlans/day3";
import { TASK4_DAY4_PLAN } from "../src/content/dayPlans/day4";
import { TASK4_DAY3_ENCOUNTERS } from "../src/content/encounters/day3";
import { TASK4_DAY4_ENCOUNTERS } from "../src/content/encounters/day4";
import { TASK4_RECOMMENDATION_PAIRS } from "../src/content/pairs/axisPairs";
import { AuthoredDayPlanSchema, AuthoredEncounterSchema } from "../src/content/schemas";
import type { AuthoredEncounter, AuthoredOutcome, Narrative, ResultCopy } from "../src/content/types";
import { applyOutcome, resolveEncounterQueue, resolveRecommendation, validateOutcomeEffects } from "../src/engine";
import type { Effect, GameState } from "../src/domain";
import { makeState } from "./fixtures/state";

const encounters = [...TASK4_DAY3_ENCOUNTERS, ...TASK4_DAY4_ENCOUNTERS];
const plans = [TASK4_DAY3_PLAN, TASK4_DAY4_PLAN];
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

function numericEffects(outcome: AuthoredOutcome, target: string): Effect[] {
  return outcome.effects.filter(
    (effect): effect is Extract<Effect, { kind: "add" }> =>
      effect.kind === "add" && effect.target === target,
  );
}

function oneAdd(outcome: AuthoredOutcome, target: string): number {
  const effects = numericEffects(outcome, target);
  expect(effects).toHaveLength(1);
  const effect = effects[0];
  if (!effect || effect.kind !== "add") {
    throw new Error(`missing numeric effect ${target}`);
  }
  return effect.amount;
}

function noAdd(outcome: AuthoredOutcome, target: string): void {
  expect(numericEffects(outcome, target)).toHaveLength(0);
}

function stateEffect(outcome: AuthoredOutcome, customerId: string): string | undefined {
  const effect = outcome.effects.find(
    (candidate): candidate is Extract<Effect, { kind: "setCustomerState" }> =>
      candidate.kind === "setCustomerState" && candidate.customerId === customerId,
  );
  return effect?.state;
}

function flagEffects(outcome: AuthoredOutcome): string[] {
  return outcome.effects
    .filter((effect): effect is Extract<Effect, { kind: "setFlag" }> => effect.kind === "setFlag")
    .map((effect) => effect.id);
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

function stateAt(day: 3 | 4, overrides: Partial<GameState> = {}): GameState {
  return makeState({ day, ...overrides });
}

describe("CONTENT-004E Day 3 and Day 4 authored content", () => {
  it("keeps the exact six/six encounter order, IDs, customers, requests, and recommendation counts", () => {
    expect(TASK4_DAY3_ENCOUNTERS.map((encounter) => encounter.id)).toEqual([
      "d3_elder_history",
      "d3_hako3_return",
      "d3_hotaru_return",
      "d3_miyashita_four_wards",
      "d3_mew_return",
      "d3_ren_evidence",
    ]);
    expect(TASK4_DAY4_ENCOUNTERS.map((encounter) => encounter.id)).toEqual([
      "d4_miyashita_triage",
      "d4_hayakawa_coworkers",
      "d4_hako3_network",
      "d4_mew_arrivals",
      "d4_hotaru_town_dead",
      "d4_ren_human_anchor",
    ]);
    expect(TASK4_DAY3_ENCOUNTERS.map(({ customerId, requestedItemId }) => [customerId, requestedItemId])).toEqual([
      ["elder", "newspaper"],
      ["hako3", "self_aware_battery"],
      ["hotaru", "returning_soul_incense"],
      ["miyashita", "black_coffee"],
      ["mew", "zero_gravity_cup_noodles"],
      ["ren", "milk"],
    ]);
    expect(TASK4_DAY4_ENCOUNTERS.map(({ customerId, requestedItemId }) => [customerId, requestedItemId])).toEqual([
      ["miyashita", "black_coffee"],
      ["hayakawa", "raw_meat_onigiri"],
      ["hako3", "self_aware_battery"],
      ["mew", "zero_gravity_cup_noodles"],
      ["hotaru", "returning_soul_incense"],
      ["ren", "milk"],
    ]);
    expect(TASK4_DAY3_ENCOUNTERS.map((encounter) => encounter.recommendationOptions.length)).toEqual([
      1,
      2,
      2,
      1,
      2,
      1,
    ]);
    expect(TASK4_DAY4_ENCOUNTERS.map((encounter) => encounter.recommendationOptions.length)).toEqual([
      1,
      2,
      2,
      2,
      2,
      1,
    ]);
    expect(encounters).toHaveLength(12);
    expect(new Set(encounters.map((encounter) => encounter.id)).size).toBe(12);
  });

  it("parses every encounter and plan with complete catalog references and copy", () => {
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
        validateOutcomeEffects(outcome);
        assertCopy(outcome.copy);
      }
    }

    expect(AuthoredDayPlanSchema.parse(TASK4_DAY3_PLAN)).toEqual(TASK4_DAY3_PLAN);
    expect(AuthoredDayPlanSchema.parse(TASK4_DAY4_PLAN)).toEqual(TASK4_DAY4_PLAN);
  });

  it("uses six fallback-backed slots with empty candidates, accepted targets, and presentations", () => {
    expect(TASK4_DAY3_PLAN.slots.map((slot) => slot.id)).toEqual([
      "slot_d3_01",
      "slot_d3_02",
      "slot_d3_03",
      "slot_d3_04",
      "slot_d3_05",
      "slot_d3_06",
    ]);
    expect(TASK4_DAY4_PLAN.slots.map((slot) => slot.id)).toEqual([
      "slot_d4_01",
      "slot_d4_02",
      "slot_d4_03",
      "slot_d4_04",
      "slot_d4_05",
      "slot_d4_06",
    ]);
    expect(TASK4_DAY3_PLAN.slots.map((slot) => slot.fallbackEncounterId)).toEqual(
      TASK4_DAY3_ENCOUNTERS.map((encounter) => encounter.id),
    );
    expect(TASK4_DAY4_PLAN.slots.map((slot) => slot.fallbackEncounterId)).toEqual(
      TASK4_DAY4_ENCOUNTERS.map((encounter) => encounter.id),
    );
    for (const plan of plans) {
      expect(plan.slots).toHaveLength(6);
      expect(plan.slots.every((slot) => slot.candidates.length === 0)).toBe(true);
      expect(new Set(plan.slots.map((slot) => slot.id)).size).toBe(6);
      expect(new Set(plan.slots.map((slot) => slot.fallbackEncounterId)).size).toBe(6);
    }
    expect(TASK4_DAY3_PLAN.revenueTarget).toBe(TASK4_DAILY_REVENUE_TARGETS[3]);
    expect(TASK4_DAY4_PLAN.revenueTarget).toBe(TASK4_DAILY_REVENUE_TARGETS[4]);
    expect(TASK4_DAY3_PLAN.presentation).toBe(TASK4_DAILY_PRESENTATIONS[2]);
    expect(TASK4_DAY4_PLAN.presentation).toBe(TASK4_DAILY_PRESENTATIONS[3]);
  });

  it("keeps regular recommendations ordinary and locks every abnormal option to one global pair", () => {
    for (const encounter of encounters) {
      const requestedItem = itemById(encounter.requestedItemId);
      if (requestedItem.kind === "ordinary") {
        expect(encounter.recommendationOptions).toHaveLength(1);
        expect(itemById(encounter.recommendationOptions[0].itemId).kind).toBe("ordinary");
        continue;
      }

      expect(encounter.recommendationOptions).toHaveLength(2);
      for (const option of encounter.recommendationOptions) {
        const matches = TASK4_RECOMMENDATION_PAIRS.filter(
          (pair) =>
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

  it("uses catalog prices and the required ordinary/abnormal effect semantics", () => {
    for (const encounter of encounters) {
      const requestedItem = itemById(encounter.requestedItemId);
      const recommendedItem = itemById(encounter.recommendationOptions[0].itemId);
      const customer = customerById(encounter.customerId);

      expect(oneAdd(encounter.outcomes.sell, "revenue.total")).toBe(requestedItem.price);
      expect(oneAdd(encounter.outcomes.sell, "revenue.today")).toBe(requestedItem.price);
      expect(oneAdd(encounter.outcomes.defaultRecommend, "revenue.total")).toBe(
        requestedItem.price + recommendedItem.price,
      );
      expect(oneAdd(encounter.outcomes.defaultRecommend, "revenue.today")).toBe(
        requestedItem.price + recommendedItem.price,
      );
      expect(oneAdd(encounter.outcomes.refuse, "managerTrust")).toBe(-1);

      if (requestedItem.kind === "abnormal") {
        expect(customer.axis).toBeDefined();
        expect(oneAdd(encounter.outcomes.sell, `world.${customer.axis}`)).toBe(2);
        expect(oneAdd(encounter.outcomes.defaultRecommend, `world.${customer.axis}`)).toBe(2);
        expect(oneAdd(encounter.outcomes.refuse, `world.${customer.axis}`)).toBe(1);
        expect(oneAdd(encounter.outcomes.refuse, "stability")).toBe(-1);
        noAdd(encounter.outcomes.refuse, "revenue.total");
        noAdd(encounter.outcomes.refuse, "revenue.today");
      } else {
        expect(customer.axis).toBeUndefined();
        for (const axis of ["undead", "machine", "cosmic", "spirit"]) {
          noAdd(encounter.outcomes.sell, `world.${axis}`);
          noAdd(encounter.outcomes.defaultRecommend, `world.${axis}`);
          noAdd(encounter.outcomes.refuse, `world.${axis}`);
        }
        noAdd(encounter.outcomes.refuse, "stability");
      }
    }

    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[1].outcomes.sell, "hako3")).toBe("powered");
    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[1].outcomes.refuse, "hako3")).toBe("offline");
    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[1].outcomes.defaultRecommend, "hako3")).toBe("powered");
    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[2].outcomes.sell, "hotaru")).toBe("calling");
    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[2].outcomes.refuse, "hotaru")).toBe("wandering");
    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[4].outcomes.sell, "mew")).toBe("supplied");
    expect(stateEffect(TASK4_DAY3_ENCOUNTERS[4].outcomes.refuse, "mew")).toBe("stranded");
    expect(stateEffect(TASK4_DAY4_ENCOUNTERS[1].outcomes.sell, "hayakawa")).toBe("fed");
    expect(stateEffect(TASK4_DAY4_ENCOUNTERS[1].outcomes.refuse, "hayakawa")).toBe("desperate");
    expect(stateEffect(TASK4_DAY4_ENCOUNTERS[2].outcomes.sell, "hako3")).toBe("powered");
    expect(stateEffect(TASK4_DAY4_ENCOUNTERS[3].outcomes.refuse, "mew")).toBe("stranded");
    expect(stateEffect(TASK4_DAY4_ENCOUNTERS[4].outcomes.refuse, "hotaru")).toBe("wandering");
    expect(oneAdd(TASK4_DAY3_ENCOUNTERS[5].outcomes.sell, "awareness")).toBe(1);
  });

  it("sets the human-anchor and isolation flags on only the requested Day 4 Ren outcomes", () => {
    const ren = TASK4_DAY4_ENCOUNTERS[5];
    expect(flagEffects(ren.outcomes.sell)).toEqual(["human_anchor"]);
    expect(flagEffects(ren.outcomes.defaultRecommend)).toEqual(["human_anchor"]);
    expect(flagEffects(ren.outcomes.refuse)).toEqual(["ren_isolated"]);
    expect(flagEffects(ren.outcomes.sell)).not.toContain("ren_isolated");
    expect(flagEffects(ren.outcomes.defaultRecommend)).not.toContain("ren_isolated");
    expect(flagEffects(ren.outcomes.refuse)).not.toContain("human_anchor");
  });

  it("resolves all state variants and genuine fallbacks deterministically", () => {
    const stateCases = [
      [TASK4_DAY3_ENCOUNTERS[1].intro, "hako3", "empathetic", "少女漫画"],
      [TASK4_DAY3_ENCOUNTERS[1].intro, "hako3", "self_modified", "自分で付け替えた"],
      [TASK4_DAY3_ENCOUNTERS[1].intro, "hako3", "offline", "停止"],
      [TASK4_DAY3_ENCOUNTERS[1].intro, "hako3", "powered", "電源を保ち"],
      [TASK4_DAY3_ENCOUNTERS[2].intro, "hotaru", "remembered", "家族の名前"],
      [TASK4_DAY3_ENCOUNTERS[2].intro, "hotaru", "sealed", "白い跡"],
      [TASK4_DAY3_ENCOUNTERS[2].intro, "hotaru", "wandering", "さまよ"],
      [TASK4_DAY3_ENCOUNTERS[2].intro, "hotaru", "calling", "名前を呼ぶ"],
      [TASK4_DAY3_ENCOUNTERS[4].intro, "mew", "visitor", "観光ガイド"],
      [TASK4_DAY3_ENCOUNTERS[4].intro, "mew", "beacon_sent", "ビーコン"],
      [TASK4_DAY3_ENCOUNTERS[4].intro, "mew", "stranded", "立ち往生"],
      [TASK4_DAY3_ENCOUNTERS[4].intro, "mew", "supplied", "補給"],
      [TASK4_DAY4_ENCOUNTERS[1].intro, "hayakawa", "fed", "同僚全員"],
      [TASK4_DAY4_ENCOUNTERS[2].intro, "hako3", "self_modified", "同じ改造"],
      [TASK4_DAY4_ENCOUNTERS[3].intro, "mew", "beacon_sent", "座標"],
      [TASK4_DAY4_ENCOUNTERS[4].intro, "hotaru", "sealed", "町の入口"],
    ] as const;

    for (const [narrative, customerId, customerState, expected] of stateCases) {
      expect(typeof narrative).toBe("object");
      expect(resolveNarrative(narrative, stateAt(customerId === "hayakawa" || customerId === "hako3" && narrative === TASK4_DAY4_ENCOUNTERS[2].intro || customerId === "mew" && narrative === TASK4_DAY4_ENCOUNTERS[3].intro || customerId === "hotaru" && narrative === TASK4_DAY4_ENCOUNTERS[4].intro ? 4 : 3, { customerStates: { [customerId]: customerState } }))).toContain(expected);
    }

    expect(resolveNarrative(TASK4_DAY3_ENCOUNTERS[1].intro, stateAt(3))).toContain("判断できない");
    expect(resolveNarrative(TASK4_DAY3_ENCOUNTERS[2].intro, stateAt(3))).toContain("判断できなかった");
    expect(resolveNarrative(TASK4_DAY3_ENCOUNTERS[4].intro, stateAt(3))).toContain("判断できなかった");
    expect(resolveNarrative(TASK4_DAY4_ENCOUNTERS[1].intro, stateAt(4))).toContain("説明できなかった");
  });

  it("uses lived hospital evidence for four leading axes and falls back on a full tie", () => {
    const d3Miyashita = TASK4_DAY3_ENCOUNTERS[3];
    const d4Miyashita = TASK4_DAY4_ENCOUNTERS[0];
    const axisCases = [
      ["undead", "不死者病棟"],
      ["machine", "自動診療"],
      ["cosmic", "異星検疫"],
      ["spirit", "霊安病棟"],
    ] as const;

    for (const [axis, expected] of axisCases) {
      const world = { undead: 0, machine: 0, cosmic: 0, spirit: 0 };
      world[axis] = 4;
      expect(resolveNarrative(d3Miyashita.intro, stateAt(3, { world }))).toContain(expected);
      expect(resolveNarrative(d4Miyashita.intro, stateAt(4, { world }))).toContain(expected);
    }

    const tied = { undead: 4, machine: 4, cosmic: 4, spirit: 4 };
    expect(resolveNarrative(d3Miyashita.intro, stateAt(3, { world: tied }))).toContain("判断できない");
    expect(resolveNarrative(d4Miyashita.intro, stateAt(4, { world: tied }))).toContain("判断できなかった");
    expect(narrativeStrings(d3Miyashita.intro)).toHaveLength(5);
    expect(narrativeStrings(d4Miyashita.intro)).toHaveLength(5);
  });

  it("keeps the evidence and town-scale choices grounded in restrained Japanese copy", () => {
    const d3Ren = TASK4_DAY3_ENCOUNTERS[5];
    const d4Ren = TASK4_DAY4_ENCOUNTERS[5];
    const evidence = allEncounterProse(d3Ren).join("\n");
    expect(evidence).toContain("保存した家族写真");
    expect(evidence).toContain("通知");
    expect(evidence).toContain("記事");
    expect(evidence).toContain("レシート");
    expect(evidence).toContain("かもしれない");
    expect(evidence).toContain("断定");
    expect(allEncounterProse(d4Ren).join("\n")).toContain("古い家族写真");
    expect(allEncounterProse(d4Ren).join("\n")).toContain("過去のレシート");

    const prose = encounters.flatMap(allEncounterProse).join("\n");
    expect(prose).not.toMatch(/TODO|FIXME|fixture|placeholder|dev-note|world\.|stability|awareness|managerTrust|score|random|Date|フラグ|スコア|安定度|認識度|世界線|エンディング|永続/i);
    expect(prose).not.toContain("数値");
  });

  it("resolves fixed queues deterministically and never mutates content, pairs, or input states", () => {
    const contentBefore = structuredClone({ encounters, plans });
    const pairsBefore = structuredClone(TASK4_RECOMMENDATION_PAIRS);
    const day3State = stateAt(3);
    const day4State = stateAt(4);

    const day3First = resolveEncounterQueue(TASK4_DAY3_PLAN, day3State);
    const day3Second = resolveEncounterQueue(TASK4_DAY3_PLAN, day3State);
    const day4First = resolveEncounterQueue(TASK4_DAY4_PLAN, day4State);
    const day4Second = resolveEncounterQueue(TASK4_DAY4_PLAN, day4State);
    expect(day3First.encounterIds).toEqual(TASK4_DAY3_ENCOUNTERS.map((encounter) => encounter.id));
    expect(day4First.encounterIds).toEqual(TASK4_DAY4_ENCOUNTERS.map((encounter) => encounter.id));
    expect(day3Second).toEqual(day3First);
    expect(day4Second).toEqual(day4First);

    for (const encounter of encounters) {
      applyOutcome(day3State, encounter.outcomes.sell);
    }
    for (const pair of TASK4_RECOMMENDATION_PAIRS) {
      resolveRecommendation({
        state: day4State,
        customerId: pair.customerId,
        requestedItemId: pair.requestedItemId,
        recommendedItemId: pair.recommendedItemId,
        pairs: TASK4_RECOMMENDATION_PAIRS,
        baseSale: { id: "task4-days3-4-base", effects: [] },
        defaultOutcome: { id: "task4-days3-4-default", effects: [] },
      });
      applyOutcome(day4State, pair.outcome);
    }

    expect({ encounters, plans }).toEqual(contentBefore);
    expect(TASK4_RECOMMENDATION_PAIRS).toEqual(pairsBefore);
    expect(day3State).toEqual(stateAt(3));
    expect(day4State).toEqual(stateAt(4));
  });
});
