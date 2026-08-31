import { describe, expect, it } from "vitest";
import { applyOutcome, resolveRecommendation, validateRecommendationPairs } from "../src/engine";
import type { Outcome, RecommendationPair } from "../src/domain";
import { TASK3_ENCOUNTERS } from "../src/content/task3";
import { makeState, alwaysTrue } from "./fixtures/state";

const baseSale: Outcome = {
  id: "base-sale",
  effects: [{ kind: "add", target: "world.undead", amount: 2 }],
};

const pair = (overrides: Partial<RecommendationPair> = {}): RecommendationPair => ({
  id: "pair-1",
  customerId: "hayakawa",
  requestedItemId: "raw-rice-ball",
  recommendedItemId: "mask",
  conditions: alwaysTrue,
  priority: 10,
  mode: "append-base-sale",
  outcome: {
    id: "mask-outcome",
    effects: [{ kind: "add", target: "stability", amount: 2 }],
  },
  ...overrides,
});

const defaultOutcome: Outcome = {
  id: "default-recommend",
  effects: [{ kind: "add", target: "awareness", amount: 1 }],
};

describe("recommendation pair resolution", () => {
  it("appends a pair outcome to the base sale", () => {
    const result = resolveRecommendation({
      state: makeState(),
      customerId: "hayakawa",
      requestedItemId: "raw-rice-ball",
      recommendedItemId: "mask",
      pairs: [pair()],
      baseSale,
      defaultOutcome,
    });

    expect(result.source).toBe("pair");
    expect(result.mode).toBe("append-base-sale");
    expect(result.outcome.effects).toHaveLength(2);
    expect(result.outcome.effects.map((effect) => effect.kind)).toEqual(["add", "add"]);
  });

  it("replaces the base sale when the pair says replace-base-sale", () => {
    const replacement = pair({
      mode: "replace-base-sale",
      outcome: { id: "replacement", effects: [{ kind: "add", target: "world.machine", amount: 3 }] },
    });
    const result = resolveRecommendation({
      state: makeState(),
      customerId: "hayakawa",
      requestedItemId: "raw-rice-ball",
      recommendedItemId: "mask",
      pairs: [replacement],
      baseSale,
      defaultOutcome,
    });

    expect(result.mode).toBe("replace-base-sale");
    expect(result.outcome).toEqual(replacement.outcome);
  });

  it("uses the default outcome when no exact eligible pair exists", () => {
    const result = resolveRecommendation({
      state: makeState(),
      customerId: "other-customer",
      requestedItemId: "raw-rice-ball",
      recommendedItemId: "mask",
      pairs: [pair()],
      baseSale,
      defaultOutcome,
    });

    expect(result.source).toBe("default");
    expect(result.mode).toBe("default");
    expect(result.outcome).toBe(defaultOutcome);
  });

  it("rejects ambiguous same-priority exact triples", () => {
    const pairs = [pair(), pair({ id: "pair-2" })];
    expect(() => validateRecommendationPairs(pairs)).toThrow(/ambiguous/);
    expect(() =>
      resolveRecommendation({
        state: makeState(),
        customerId: "hayakawa",
        requestedItemId: "raw-rice-ball",
        recommendedItemId: "mask",
        pairs,
        baseSale,
        defaultOutcome,
      }),
    ).toThrow(/ambiguous/);
  });

  it("rejects duplicate customer-state writes during catalog validation", () => {
    const invalid = pair({
      outcome: {
        id: "invalid-pair-outcome",
        effects: [
          { kind: "setCustomerState", customerId: "hayakawa", state: "fed" },
          { kind: "setCustomerState", customerId: "hayakawa", state: "lost" },
        ],
      },
    });

    expect(() => validateRecommendationPairs([invalid])).toThrow(/hayakawa/);
  });

  it("validates the effective append-base-sale outcome", () => {
    const base = {
      id: "base-with-state",
      effects: [{ kind: "setCustomerState" as const, customerId: "hayakawa", state: "fed" }],
    };
    const append = pair({
      outcome: {
        id: "append-with-state",
        effects: [{ kind: "setCustomerState", customerId: "hayakawa", state: "lost" }],
      },
    });

    expect(() => validateRecommendationPairs([append], { baseSale: base })).toThrow(/hayakawa/);
    expect(() =>
      resolveRecommendation({
        state: makeState(),
        customerId: "hayakawa",
        requestedItemId: "raw-rice-ball",
        recommendedItemId: "mask",
        pairs: [append],
        baseSale: base,
        defaultOutcome,
      }),
    ).toThrow(/hayakawa/);
  });

  it("charges requested plus recommended prices for append, replace, and default fixtures", () => {
    const appendFixture = TASK3_ENCOUNTERS[0];
    const appendResolution = resolveRecommendation({
      state: makeState(),
      customerId: appendFixture.customerId,
      requestedItemId: appendFixture.requestedItem.id,
      recommendedItemId: appendFixture.recommendations[0].id,
      pairs: appendFixture.recommendationPairs,
      baseSale: appendFixture.baseSale,
      defaultOutcome: appendFixture.defaultRecommendation,
    });
    const appendState = applyOutcome(makeState(), appendResolution.outcome);
    expect(appendState.revenue.today).toBe(300);
    expect(appendState.revenue.total).toBe(300);

    const replaceFixture = TASK3_ENCOUNTERS[1];
    const replaceResolution = resolveRecommendation({
      state: makeState(),
      customerId: replaceFixture.customerId,
      requestedItemId: replaceFixture.requestedItem.id,
      recommendedItemId: replaceFixture.recommendations[0].id,
      pairs: replaceFixture.recommendationPairs,
      baseSale: replaceFixture.baseSale,
      defaultOutcome: replaceFixture.defaultRecommendation,
    });
    const replaceState = applyOutcome(makeState(), replaceResolution.outcome);
    expect(replaceState.revenue.today).toBe(580);
    expect(replaceState.revenue.total).toBe(580);

    const defaultResolution = resolveRecommendation({
      state: makeState(),
      customerId: appendFixture.customerId,
      requestedItemId: appendFixture.requestedItem.id,
      recommendedItemId: appendFixture.recommendations[0].id,
      pairs: [],
      baseSale: appendFixture.baseSale,
      defaultOutcome: appendFixture.defaultRecommendation,
    });
    const defaultState = applyOutcome(makeState(), defaultResolution.outcome);
    expect(defaultResolution.source).toBe("default");
    expect(defaultState.revenue.today).toBe(300);
    expect(defaultState.revenue.total).toBe(300);
  });
});
