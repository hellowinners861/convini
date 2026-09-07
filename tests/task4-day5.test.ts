import { describe, expect, it } from "vitest";
import { resolveNarrative } from "../src/content/narrative";
import { TASK4_DAILY_PRESENTATIONS } from "../src/content/config/presentation";
import { TASK4_DAILY_REVENUE_TARGETS } from "../src/content/config/game";
import { TASK4_CUSTOMERS } from "../src/content/customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../src/content/items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../src/content/items/ordinary";
import { TASK4_DAY5_CONVERGENCE, TASK4_DAY5_PLAN } from "../src/content/dayPlans/day5";
import { TASK4_DAY5_ENCOUNTERS } from "../src/content/encounters/day5";
import { TASK4_RECOMMENDATION_PAIRS } from "../src/content/pairs/axisPairs";
import {
  AuthoredDayPlanSchema,
  AuthoredEncounterSchema,
  Day5ConvergenceMetadataSchema,
} from "../src/content/schemas";
import type {
  AuthoredEncounter,
  AuthoredOutcome,
  ConditionalNarrative,
  Narrative,
  ResultCopy,
} from "../src/content/types";
import { applyOutcome, resolveEncounterQueue, resolveRecommendation, validateOutcomeEffects } from "../src/engine";
import { createInitialGameState } from "../src/domain";
import type { Effect, GameState, WorldAxis } from "../src/domain";

const items = [...TASK4_ORDINARY_ITEMS, ...TASK4_ABNORMAL_ITEMS];

function itemById(itemId: string) {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`missing item ${itemId}`);
  }
  return item;
}

function stateAt(overrides: Partial<GameState> = {}): GameState {
  const initial = createInitialGameState({ runId: "task4-day5-test", contentVersion: "task4-day5" });
  return {
    ...initial,
    ...overrides,
    day: 5,
    world: { ...initial.world, ...overrides.world },
    revenue: { ...initial.revenue, ...overrides.revenue },
  };
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

function numericEffects(outcome: AuthoredOutcome, target: string): Extract<Effect, { kind: "add" }>[] {
  return outcome.effects.filter(
    (effect): effect is Extract<Effect, { kind: "add" }> =>
      effect.kind === "add" && effect.target === target,
  );
}

function oneAdd(outcome: AuthoredOutcome, target: string): number {
  const effects = numericEffects(outcome, target);
  expect(effects).toHaveLength(1);
  return effects[0].amount;
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

function conditionalStateValues(narrative: ConditionalNarrative): string[] {
  return narrative.variants.flatMap((variant) => {
    if ("customerState" in variant.condition) {
      return [variant.condition.customerState.state];
    }
    return [];
  });
}

describe("CONTENT-004F Day 5 authored content", () => {
  it("keeps the exact six encounters, products, customers, option counts, references, and copy", () => {
    expect(TASK4_DAY5_ENCOUNTERS.map((encounter) => encounter.id)).toEqual([
      "d5_miyashita_convergence",
      "d5_hayakawa_final",
      "d5_hako3_final",
      "d5_mew_final",
      "d5_ren_photo",
      "d5_hotaru_final",
    ]);
    expect(TASK4_DAY5_ENCOUNTERS.map(({ customerId, requestedItemId }) => [customerId, requestedItemId])).toEqual([
      ["miyashita", "black_coffee"],
      ["hayakawa", "raw_meat_onigiri"],
      ["hako3", "self_aware_battery"],
      ["mew", "zero_gravity_cup_noodles"],
      ["ren", "milk"],
      ["hotaru", "returning_soul_incense"],
    ]);
    expect(TASK4_DAY5_ENCOUNTERS.map((encounter) => encounter.recommendationOptions.length)).toEqual([
      1,
      2,
      2,
      2,
      1,
      2,
    ]);

    const itemIds = new Set(items.map((item) => item.id));
    const customerIds = new Set(TASK4_CUSTOMERS.map((customer) => customer.id));
    for (const encounter of TASK4_DAY5_ENCOUNTERS) {
      expect(AuthoredEncounterSchema.parse(encounter)).toEqual(encounter);
      expect(itemIds.has(encounter.requestedItemId)).toBe(true);
      expect(customerIds.has(encounter.customerId)).toBe(true);
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
  });

  it("uses the exact physical slots and four unique snapshot-order metadata entries", () => {
    expect(TASK4_DAY5_PLAN.slots.map((slot) => slot.id)).toEqual([
      "slot_d5_miyashita",
      "slot_d5_undead",
      "slot_d5_machine",
      "slot_d5_cosmic",
      "slot_d5_ren",
      "slot_d5_spirit",
    ]);
    expect(TASK4_DAY5_PLAN.slots.map((slot) => slot.fallbackEncounterId)).toEqual(
      TASK4_DAY5_ENCOUNTERS.map((encounter) => encounter.id),
    );
    expect(TASK4_DAY5_PLAN.slots.every((slot) => slot.candidates.length === 0)).toBe(true);
    expect(TASK4_DAY5_PLAN.day5AnomalyOrder).toEqual([
      {
        slotId: "slot_d5_undead",
        customerId: "hayakawa",
        axis: "undead",
        unresolvedness: 0,
        lastAffectedAxis: "undead",
      },
      {
        slotId: "slot_d5_machine",
        customerId: "hako3",
        axis: "machine",
        unresolvedness: 0,
        lastAffectedAxis: "machine",
      },
      {
        slotId: "slot_d5_cosmic",
        customerId: "mew",
        axis: "cosmic",
        unresolvedness: 0,
        lastAffectedAxis: "cosmic",
      },
      {
        slotId: "slot_d5_spirit",
        customerId: "hotaru",
        axis: "spirit",
        unresolvedness: 0,
        lastAffectedAxis: "spirit",
      },
    ]);
    expect(new Set(TASK4_DAY5_PLAN.day5AnomalyOrder?.map((entry) => entry.slotId))).toHaveLength(4);
    expect(new Set(TASK4_DAY5_PLAN.day5AnomalyOrder?.map((entry) => entry.customerId))).toHaveLength(4);
    expect(new Set(TASK4_DAY5_PLAN.day5AnomalyOrder?.map((entry) => entry.axis))).toHaveLength(4);
    expect(TASK4_DAY5_PLAN.revenueTarget).toBe(TASK4_DAILY_REVENUE_TARGETS[5]);
    expect(TASK4_DAY5_PLAN.presentation).toBe(TASK4_DAILY_PRESENTATIONS[4]);
    expect(AuthoredDayPlanSchema.parse(TASK4_DAY5_PLAN)).toEqual(TASK4_DAY5_PLAN);
  });

  it("orders anomaly slots from weak to strong using two unequal snapshots, with fixed ordinary positions", () => {
    const first = resolveEncounterQueue(
      TASK4_DAY5_PLAN,
      stateAt({ world: { undead: 8, machine: 2, cosmic: 5, spirit: 1 } }),
    );
    const second = resolveEncounterQueue(
      TASK4_DAY5_PLAN,
      stateAt({ world: { undead: 4, machine: 9, cosmic: 2, spirit: 6 } }),
    );

    expect(first.encounterIds).toEqual([
      "d5_miyashita_convergence",
      "d5_hotaru_final",
      "d5_hako3_final",
      "d5_mew_final",
      "d5_ren_photo",
      "d5_hayakawa_final",
    ]);
    expect(second.encounterIds).toEqual([
      "d5_miyashita_convergence",
      "d5_mew_final",
      "d5_hayakawa_final",
      "d5_hotaru_final",
      "d5_ren_photo",
      "d5_hako3_final",
    ]);
    for (const queue of [first, second]) {
      expect(queue.encounterIds[0]).toBe("d5_miyashita_convergence");
      expect(queue.encounterIds[4]).toBe("d5_ren_photo");
      expect(queue.encounterIds[5]).toMatch(/d5_(hayakawa|hako3|mew|hotaru)_final/);
    }
  });

  it("keeps full-tie ordering deterministic and resolves from the immutable start snapshot", () => {
    const start = stateAt({ world: { undead: 4, machine: 4, cosmic: 4, spirit: 4 } });
    const before = structuredClone(start);
    const first = resolveEncounterQueue(TASK4_DAY5_PLAN, start);
    const second = resolveEncounterQueue(TASK4_DAY5_PLAN, start);

    expect(first.encounterIds).toEqual([
      "d5_miyashita_convergence",
      "d5_hayakawa_final",
      "d5_hako3_final",
      "d5_mew_final",
      "d5_ren_photo",
      "d5_hotaru_final",
    ]);
    expect(second).toEqual(first);
    expect(start).toEqual(before);
    expect(first.snapshot).toEqual(before);
  });

  it("covers all anomaly prior states and real fallbacks, plus four leading-axis variants and a tie fallback", () => {
    const anomalyCases = [
      ["d5_hayakawa_final", "hayakawa", ["integrating", "ravenous", "fed", "desperate"]],
      ["d5_hako3_final", "hako3", ["empathetic", "self_modified", "powered", "offline"]],
      ["d5_mew_final", "mew", ["visitor", "beacon_sent", "supplied", "stranded"]],
      ["d5_hotaru_final", "hotaru", ["remembered", "sealed", "calling", "wandering"]],
    ] as const;

    for (const [encounterId, customerId, states] of anomalyCases) {
      const encounter = TASK4_DAY5_ENCOUNTERS.find((candidate) => candidate.id === encounterId);
      expect(encounter).toBeDefined();
      if (!encounter || typeof encounter.intro === "string") {
        throw new Error(`missing conditional intro ${encounterId}`);
      }
      expect(conditionalStateValues(encounter.intro)).toEqual(states);
      for (const customerState of states) {
        expect(resolveNarrative(encounter.intro, stateAt({ customerStates: { [customerId]: customerState } }))).not.toBe(
          encounter.intro.fallback,
        );
      }
      expect(resolveNarrative(encounter.intro, stateAt())).toBe(encounter.intro.fallback);
    }

    const miyashita = TASK4_DAY5_ENCOUNTERS[0];
    expect(typeof miyashita.intro).toBe("object");
    if (typeof miyashita.intro === "string") {
      throw new Error("missing Miyashita conditional intro");
    }
    expect(miyashita.intro.variants).toHaveLength(4);
    const axisMarkers = {
      undead: "脈のない患者",
      machine: "無人端末",
      cosmic: "異星から来た患者",
      spirit: "返事のない患者",
    } as const;
    for (const axis of Object.keys(axisMarkers) as WorldAxis[]) {
      const world = { undead: 0, machine: 0, cosmic: 0, spirit: 0 };
      world[axis] = 4;
      expect(resolveNarrative(miyashita.intro, stateAt({ world }))).toContain(axisMarkers[axis]);
    }
    const tied = { undead: 4, machine: 4, cosmic: 4, spirit: 4 };
    expect(resolveNarrative(miyashita.intro, stateAt({ world: tied }))).toBe(miyashita.intro.fallback);
    expect(resolveNarrative(miyashita.intro, stateAt({ world: tied }))).toBe(
      resolveNarrative(miyashita.intro, stateAt({ world: tied })),
    );
  });

  it("keeps accepted prices, ordinary or abnormal effects, canonical states, and one global pair per abnormal option", () => {
    const canonicalStates = {
      hayakawa: ["fed", "desperate"],
      hako3: ["powered", "offline"],
      mew: ["supplied", "stranded"],
      hotaru: ["calling", "wandering"],
    } as const;

    for (const encounter of TASK4_DAY5_ENCOUNTERS) {
      const requested = itemById(encounter.requestedItemId);
      const recommended = itemById(encounter.recommendationOptions[0].itemId);
      expect(oneAdd(encounter.outcomes.sell, "revenue.total")).toBe(requested.price);
      expect(oneAdd(encounter.outcomes.sell, "revenue.today")).toBe(requested.price);
      expect(oneAdd(encounter.outcomes.defaultRecommend, "revenue.total")).toBe(
        requested.price + recommended.price,
      );
      expect(oneAdd(encounter.outcomes.defaultRecommend, "revenue.today")).toBe(
        requested.price + recommended.price,
      );
      expect(oneAdd(encounter.outcomes.refuse, "managerTrust")).toBe(-1);

      if (requested.kind === "abnormal") {
        const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === encounter.customerId);
        expect(customer?.axis).toBeDefined();
        const axis = customer?.axis as WorldAxis;
        expect(oneAdd(encounter.outcomes.sell, `world.${axis}`)).toBe(2);
        expect(oneAdd(encounter.outcomes.defaultRecommend, `world.${axis}`)).toBe(2);
        expect(oneAdd(encounter.outcomes.refuse, `world.${axis}`)).toBe(1);
        expect(oneAdd(encounter.outcomes.refuse, "stability")).toBe(-1);
        expect(numericEffects(encounter.outcomes.refuse, "revenue.total")).toHaveLength(0);
        expect(numericEffects(encounter.outcomes.refuse, "revenue.today")).toHaveLength(0);
        expect(stateEffect(encounter.outcomes.sell, encounter.customerId)).toBe(
          canonicalStates[encounter.customerId as keyof typeof canonicalStates][0],
        );
        expect(stateEffect(encounter.outcomes.defaultRecommend, encounter.customerId)).toBe(
          canonicalStates[encounter.customerId as keyof typeof canonicalStates][0],
        );
        expect(stateEffect(encounter.outcomes.refuse, encounter.customerId)).toBe(
          canonicalStates[encounter.customerId as keyof typeof canonicalStates][1],
        );
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
      } else {
        expect(numericEffects(encounter.outcomes.sell, "stability")).toHaveLength(0);
        expect(numericEffects(encounter.outcomes.refuse, "stability")).toHaveLength(0);
        for (const axis of ["undead", "machine", "cosmic", "spirit"] as const) {
          expect(numericEffects(encounter.outcomes.sell, `world.${axis}`)).toHaveLength(0);
          expect(numericEffects(encounter.outcomes.defaultRecommend, `world.${axis}`)).toHaveLength(0);
          expect(numericEffects(encounter.outcomes.refuse, `world.${axis}`)).toHaveLength(0);
        }
      }
    }

    const ren = TASK4_DAY5_ENCOUNTERS.find((encounter) => encounter.id === "d5_ren_photo");
    expect(ren).toBeDefined();
    if (ren) {
      expect(flagEffects(ren.outcomes.sell)).toEqual([]);
      expect(flagEffects(ren.outcomes.defaultRecommend)).toEqual([]);
      expect(flagEffects(ren.outcomes.refuse)).toEqual([]);
    }
  });

  it("leaves Day 4 Ren flags durable without adding either opposite flag", () => {
    const ren = TASK4_DAY5_ENCOUNTERS.find((encounter) => encounter.id === "d5_ren_photo");
    expect(ren).toBeDefined();
    if (!ren) {
      return;
    }

    for (const outcome of Object.values(ren.outcomes)) {
      expect(flagEffects(outcome)).not.toContain("human_anchor");
      expect(flagEffects(outcome)).not.toContain("ren_isolated");
      for (const priorFlag of ["human_anchor", "ren_isolated"] as const) {
        const state = stateAt({ flags: [priorFlag] });
        applyOutcome(state, outcome);
        expect(state.flags).toEqual([priorFlag]);
      }
    }
  });

  it("exports only dynamic convergence metadata and keeps runtime convergence effects out of leaf outcomes", () => {
    expect(Day5ConvergenceMetadataSchema.parse(TASK4_DAY5_CONVERGENCE)).toEqual({
      day: 5,
      finalQueueIndex: 5,
      successfulSaleAxisBonus: 2,
      refusalStabilityDelta: -2,
      refusalFlagId: "convergence_refused",
    });
    expect(TASK4_DAY5_CONVERGENCE).not.toHaveProperty("finalSlotId");
    expect(TASK4_DAY5_CONVERGENCE).not.toHaveProperty("finalEncounterId");
    expect(TASK4_DAY5_CONVERGENCE).not.toHaveProperty("anomalyOrder");
    expect(TASK4_DAY5_CONVERGENCE).not.toHaveProperty("convergenceAxis");

    for (const encounter of TASK4_DAY5_ENCOUNTERS) {
      for (const outcome of Object.values(encounter.outcomes)) {
        expect(flagEffects(outcome)).not.toContain("convergence_refused");
        expect(numericEffects(outcome, "stability").some((effect) => effect.amount === -2)).toBe(false);
        const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === encounter.customerId);
        for (const axis of ["undead", "machine", "cosmic", "spirit"] as const) {
          expect(numericEffects(outcome, `world.${axis}`)).toHaveLength(
            customer?.axis === axis ? 1 : 0,
          );
        }
      }
    }
  });

  it("does not mutate the plan, queue snapshot, encounters, pairs, or input states", () => {
    const before = structuredClone({ plan: TASK4_DAY5_PLAN, encounters: TASK4_DAY5_ENCOUNTERS, pairs: TASK4_RECOMMENDATION_PAIRS });
    const inputState = stateAt({ world: { undead: 8, machine: 2, cosmic: 5, spirit: 1 } });
    const stateBefore = structuredClone(inputState);
    const queue = resolveEncounterQueue(TASK4_DAY5_PLAN, inputState);

    queue.snapshot.world.undead = 999;
    queue.encounterIds.reverse();
    expect(inputState).toEqual(stateBefore);

    const workingState = stateAt();
    for (const encounter of TASK4_DAY5_ENCOUNTERS) {
      applyOutcome(workingState, encounter.outcomes.sell);
    }
    for (const pair of TASK4_RECOMMENDATION_PAIRS) {
      const resolution = resolveRecommendation({
        state: workingState,
        customerId: pair.customerId,
        requestedItemId: pair.requestedItemId,
        recommendedItemId: pair.recommendedItemId,
        pairs: TASK4_RECOMMENDATION_PAIRS,
        baseSale: { id: "task4-day5-base", effects: [] },
        defaultOutcome: { id: "task4-day5-default", effects: [] },
      });
      applyOutcome(workingState, resolution.outcome);
    }

    expect({ plan: TASK4_DAY5_PLAN, encounters: TASK4_DAY5_ENCOUNTERS, pairs: TASK4_RECOMMENDATION_PAIRS }).toEqual(before);
  });

  it("keeps every authored string restrained Japanese copy without internal or prohibited disclosure", () => {
    const prose = TASK4_DAY5_ENCOUNTERS.flatMap(allEncounterProse).join("\n");
    expect(prose).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
    expect(prose).not.toMatch(
      /TODO|FIXME|fixture|placeholder|dev-note|Date|random|score|news|ending|persistence|controller|world\.|stability|awareness|managerTrust|convergence_refused|スコア|数値|安定度|認識度|世界線|エンディング|ニュース|永続/i,
    );
    expect(prose).toContain("朝になったら、これは誰の写真になる？");
  });
});
