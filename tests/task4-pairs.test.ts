import { describe, expect, it } from "vitest";
import { applyOutcome, resolveRecommendation, validateRecommendationPairs } from "../src/engine";
import { RecommendationPairSchema, type Effect, type GameState } from "../src/domain";
import { TASK4_CUSTOMERS } from "../src/content/customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../src/content/items/abnormal";
import { TASK4_RECOMMENDATION_PAIRS } from "../src/content/pairs/axisPairs";
import { makeState } from "./fixtures/state";

const expectedPairs = [
  {
    id: "pair_hayakawa_mask",
    customerId: "hayakawa",
    requestedItemId: "raw_meat_onigiri",
    recommendedItemId: "mask",
    axis: "undead",
    kind: "coexist",
    customerState: "integrating",
  },
  {
    id: "pair_hayakawa_counter_chicken",
    customerId: "hayakawa",
    requestedItemId: "raw_meat_onigiri",
    recommendedItemId: "counter_chicken",
    axis: "undead",
    kind: "runaway",
    customerState: "ravenous",
  },
  {
    id: "pair_hako3_shojo_manga",
    customerId: "hako3",
    requestedItemId: "self_aware_battery",
    recommendedItemId: "shojo_manga",
    axis: "machine",
    kind: "coexist",
    customerState: "empathetic",
  },
  {
    id: "pair_hako3_precision_screwdriver",
    customerId: "hako3",
    requestedItemId: "self_aware_battery",
    recommendedItemId: "precision_screwdriver",
    axis: "machine",
    kind: "runaway",
    customerState: "self_modified",
  },
  {
    id: "pair_mew_tourist_guide",
    customerId: "mew",
    requestedItemId: "zero_gravity_cup_noodles",
    recommendedItemId: "tourist_guide",
    axis: "cosmic",
    kind: "coexist",
    customerState: "visitor",
  },
  {
    id: "pair_mew_mobile_power_bank",
    customerId: "mew",
    requestedItemId: "zero_gravity_cup_noodles",
    recommendedItemId: "mobile_power_bank",
    axis: "cosmic",
    kind: "runaway",
    customerState: "beacon_sent",
  },
  {
    id: "pair_hotaru_photo_print_ticket",
    customerId: "hotaru",
    requestedItemId: "returning_soul_incense",
    recommendedItemId: "photo_print_ticket",
    axis: "spirit",
    kind: "coexist",
    customerState: "remembered",
  },
  {
    id: "pair_hotaru_purifying_salt",
    customerId: "hotaru",
    requestedItemId: "returning_soul_incense",
    recommendedItemId: "purifying_salt",
    axis: "spirit",
    kind: "runaway",
    customerState: "sealed",
  },
] as const;

const itemPrice = (itemId: string): number => {
  const item = TASK4_ABNORMAL_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`test fixture is missing item ${itemId}`);
  }
  return item.price;
};

const customerAxis = (customerId: string): string => {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer?.axis) {
    throw new Error(`test fixture is missing customer axis ${customerId}`);
  }
  return customer.axis;
};

const numericEffect = (effects: Effect[], target: string): number => {
  const effect = effects.find((candidate) => candidate.kind === "add" && candidate.target === target);
  if (!effect || effect.kind !== "add") {
    throw new Error(`missing numeric effect ${target}`);
  }
  return effect.amount;
};

const stateEffect = (effects: Effect[], customerId: string) => {
  const effect = effects.find(
    (candidate) => candidate.kind === "setCustomerState" && candidate.customerId === customerId,
  );
  if (!effect || effect.kind !== "setCustomerState") {
    throw new Error(`missing customer-state effect for ${customerId}`);
  }
  return effect;
};

const baseSale = {
  id: "task4-base-sale",
  effects: [{ kind: "add" as const, target: "world.undead" as const, amount: 2 }],
};

const defaultOutcome = {
  id: "task4-default-recommendation",
  effects: [{ kind: "add" as const, target: "awareness" as const, amount: 99 }],
};

describe("Task 4 canonical axis recommendation pairs", () => {
  it("contains exactly the locked IDs, triples, unconditional priorities, and replacement modes", () => {
    expect(TASK4_RECOMMENDATION_PAIRS).toHaveLength(8);
    expect(TASK4_RECOMMENDATION_PAIRS.map(({ id }) => id)).toEqual(expectedPairs.map(({ id }) => id));

    for (const [index, expected] of expectedPairs.entries()) {
      expect(TASK4_RECOMMENDATION_PAIRS[index]).toMatchObject({
        id: expected.id,
        customerId: expected.customerId,
        requestedItemId: expected.requestedItemId,
        recommendedItemId: expected.recommendedItemId,
        conditions: { true: true },
        priority: 100,
        mode: "replace-base-sale",
      });
    }
  });

  it("parses every pair through the domain Zod contract", () => {
    for (const pair of TASK4_RECOMMENDATION_PAIRS) {
      expect(RecommendationPairSchema.parse(pair)).toEqual(pair);
    }
  });

  it("passes startup semantic validation with unique triples and valid outcomes", () => {
    expect(() => validateRecommendationPairs(TASK4_RECOMMENDATION_PAIRS)).not.toThrow();

    const triples = TASK4_RECOMMENDATION_PAIRS.map(
      ({ customerId, requestedItemId, recommendedItemId }) =>
        `${customerId}\u0000${requestedItemId}\u0000${recommendedItemId}`,
    );
    expect(new Set(triples).size).toBe(triples.length);
  });

  it("uses catalog prices and exact coexist/runaway effects without convergence or copy", () => {
    for (const [index, expected] of expectedPairs.entries()) {
      const pair = TASK4_RECOMMENDATION_PAIRS[index];
      const effects = pair.outcome.effects;
      const expectedRevenue = itemPrice(expected.requestedItemId) + itemPrice(expected.recommendedItemId);
      const expectedAxisDelta = expected.kind === "coexist" ? 1 : 3;
      const expectedStabilityDelta = expected.kind === "coexist" ? 2 : -2;

      expect(pair.customerId).toBe(expected.customerId);
      expect(customerAxis(pair.customerId)).toBe(expected.axis);
      expect(effects).toEqual([
        { kind: "add", target: "revenue.total", amount: expectedRevenue },
        { kind: "add", target: "revenue.today", amount: expectedRevenue },
        { kind: "add", target: `world.${expected.axis}`, amount: expectedAxisDelta },
        { kind: "add", target: "stability", amount: expectedStabilityDelta },
        { kind: "setCustomerState", customerId: expected.customerId, state: expected.customerState },
      ]);
      expect(numericEffect(effects, "revenue.total")).toBe(expectedRevenue);
      expect(numericEffect(effects, "revenue.today")).toBe(expectedRevenue);
      expect(stateEffect(effects, expected.customerId).state).toBe(expected.customerState);
      expect("copy" in pair.outcome).toBe(false);
      expect(JSON.stringify(pair)).not.toContain("convergence");
      expect(effects.some((effect) => effect.kind === "setFlag")).toBe(false);
      expect(effects.filter((effect) => effect.kind === "setCustomerState")).toHaveLength(1);
    }
  });

  it("applies each pair's requested-plus-recommended revenue, axis, stability, and customer state", () => {
    for (const [index, expected] of expectedPairs.entries()) {
      const pair = TASK4_RECOMMENDATION_PAIRS[index];
      const initial = makeState();
      const next = applyOutcome(initial, pair.outcome);
      const expectedRevenue = itemPrice(expected.requestedItemId) + itemPrice(expected.recommendedItemId);

      expect(next.revenue.total).toBe(expectedRevenue);
      expect(next.revenue.today).toBe(expectedRevenue);
      expect(next.world[expected.axis]).toBe(expected.kind === "coexist" ? 1 : 3);
      expect(next.stability).toBe(expected.kind === "coexist" ? 2 : -2);
      expect(next.customerStates[expected.customerId]).toBe(expected.customerState);
      expect(initial).toEqual(makeState());
    }
  });

  it("replaces the base sale through resolveRecommendation and counts no base +2", () => {
    for (const expected of expectedPairs) {
      const pair = TASK4_RECOMMENDATION_PAIRS.find((candidate) => candidate.id === expected.id);
      if (!pair) {
        throw new Error(`missing pair ${expected.id}`);
      }

      const result = resolveRecommendation({
        state: makeState(),
        customerId: expected.customerId,
        requestedItemId: expected.requestedItemId,
        recommendedItemId: expected.recommendedItemId,
        pairs: TASK4_RECOMMENDATION_PAIRS,
        baseSale,
        defaultOutcome,
      });

      expect(result).toMatchObject({
        source: "pair",
        mode: "replace-base-sale",
        pairId: expected.id,
      });
      expect(result.outcome).toBe(pair.outcome);
      expect(result.outcome.effects).not.toContain(baseSale.effects[0]);
      expect(result.outcome.effects).not.toContainEqual({
        kind: "add",
        target: `world.${expected.axis}`,
        amount: 2,
      });
    }
  });

  it("does not mutate the canonical pairs while resolving or applying outcomes", () => {
    const before = structuredClone(TASK4_RECOMMENDATION_PAIRS);
    const state: GameState = makeState();

    for (const pair of TASK4_RECOMMENDATION_PAIRS) {
      resolveRecommendation({
        state,
        customerId: pair.customerId,
        requestedItemId: pair.requestedItemId,
        recommendedItemId: pair.recommendedItemId,
        pairs: TASK4_RECOMMENDATION_PAIRS,
        baseSale,
        defaultOutcome,
      });
      applyOutcome(state, pair.outcome);
    }

    expect(TASK4_RECOMMENDATION_PAIRS).toEqual(before);
  });
});
