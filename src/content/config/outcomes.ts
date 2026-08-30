import type { Effect, Outcome, WorldAxis } from "../../domain";
import type { AuthoredOutcome, ContentId, ResultCopy } from "../types";

function cloneEffect(effect: Effect): Effect {
  return { ...effect };
}

function cloneEffects(effects: readonly Effect[]): Effect[] {
  return effects.map(cloneEffect);
}

/** Revenue is recorded in both the run total and the current shift total. */
export function revenueEffects(price: number, additionalEffects: readonly Effect[] = []): Effect[] {
  return [
    { kind: "add", target: "revenue.total", amount: price },
    { kind: "add", target: "revenue.today", amount: price },
    ...cloneEffects(additionalEffects),
  ];
}

export const createRevenueEffects = revenueEffects;
export const makeRevenueEffects = revenueEffects;

export function createOutcome(id: ContentId, effects: readonly Effect[]): Outcome {
  return { id, effects: cloneEffects(effects) };
}

export function createAuthoredOutcome(
  id: ContentId,
  effects: readonly Effect[],
  copy: ResultCopy,
): AuthoredOutcome {
  return { ...createOutcome(id, effects), copy };
}

export function ordinarySaleEffects(
  price: number,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return revenueEffects(price, additionalEffects);
}

export function ordinaryRefusalEffects(additionalEffects: readonly Effect[] = []): Effect[] {
  return [
    { kind: "add", target: "managerTrust", amount: -1 },
    ...cloneEffects(additionalEffects),
  ];
}

export function ordinaryDefaultRecommendationEffects(
  requestedPrice: number,
  recommendedPrice: number,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return revenueEffects(requestedPrice + recommendedPrice, additionalEffects);
}

export function abnormalDefaultRecommendationEffects(
  axis: WorldAxis,
  requestedPrice: number,
  recommendedPrice: number,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return [
    ...revenueEffects(requestedPrice + recommendedPrice),
    { kind: "add", target: `world.${axis}`, amount: 2 },
    ...cloneEffects(additionalEffects),
  ];
}

export function abnormalBaseSellEffects(
  axis: WorldAxis,
  price: number,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return [
    ...revenueEffects(price),
    { kind: "add", target: `world.${axis}`, amount: 2 },
    ...cloneEffects(additionalEffects),
  ];
}

export function abnormalRefusalEffects(
  axis: WorldAxis,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return [
    { kind: "add", target: `world.${axis}`, amount: 1 },
    { kind: "add", target: "stability", amount: -1 },
    { kind: "add", target: "managerTrust", amount: -1 },
    ...cloneEffects(additionalEffects),
  ];
}

export function coexistPairEffects(
  axis: WorldAxis,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return [
    { kind: "add", target: `world.${axis}`, amount: 1 },
    { kind: "add", target: "stability", amount: 2 },
    ...cloneEffects(additionalEffects),
  ];
}

export function runawayPairEffects(
  axis: WorldAxis,
  additionalEffects: readonly Effect[] = [],
): Effect[] {
  return [
    { kind: "add", target: `world.${axis}`, amount: 3 },
    { kind: "add", target: "stability", amount: -2 },
    ...cloneEffects(additionalEffects),
  ];
}

export const createOrdinarySaleEffects = ordinarySaleEffects;
export const createOrdinaryRefusalEffects = ordinaryRefusalEffects;
export const createOrdinaryDefaultRecommendationEffects = ordinaryDefaultRecommendationEffects;
export const createAbnormalDefaultRecommendationEffects = abnormalDefaultRecommendationEffects;
export const createAbnormalBaseSellEffects = abnormalBaseSellEffects;
export const createAbnormalRefusalEffects = abnormalRefusalEffects;
export const createCoexistPairEffects = coexistPairEffects;
export const createRunawayPairEffects = runawayPairEffects;

export function ordinarySaleOutcome(
  id: ContentId,
  price: number,
  copy: ResultCopy,
  additionalEffects: readonly Effect[] = [],
): AuthoredOutcome {
  return createAuthoredOutcome(id, ordinarySaleEffects(price, additionalEffects), copy);
}

export function ordinaryRefusalOutcome(
  id: ContentId,
  copy: ResultCopy,
  additionalEffects: readonly Effect[] = [],
): AuthoredOutcome {
  return createAuthoredOutcome(id, ordinaryRefusalEffects(additionalEffects), copy);
}

export function ordinaryDefaultRecommendationOutcome(
  id: ContentId,
  requestedPrice: number,
  recommendedPrice: number,
  copy: ResultCopy,
  additionalEffects: readonly Effect[] = [],
): AuthoredOutcome {
  return createAuthoredOutcome(
    id,
    ordinaryDefaultRecommendationEffects(requestedPrice, recommendedPrice, additionalEffects),
    copy,
  );
}

export function abnormalDefaultRecommendationOutcome(
  id: ContentId,
  axis: WorldAxis,
  requestedPrice: number,
  recommendedPrice: number,
  copy: ResultCopy,
  additionalEffects: readonly Effect[] = [],
): AuthoredOutcome {
  return createAuthoredOutcome(
    id,
    abnormalDefaultRecommendationEffects(axis, requestedPrice, recommendedPrice, additionalEffects),
    copy,
  );
}

export function abnormalBaseSellOutcome(
  id: ContentId,
  axis: WorldAxis,
  price: number,
  copy: ResultCopy,
  additionalEffects: readonly Effect[] = [],
): AuthoredOutcome {
  return createAuthoredOutcome(id, abnormalBaseSellEffects(axis, price, additionalEffects), copy);
}

export function abnormalRefusalOutcome(
  id: ContentId,
  axis: WorldAxis,
  copy: ResultCopy,
  additionalEffects: readonly Effect[] = [],
): AuthoredOutcome {
  return createAuthoredOutcome(id, abnormalRefusalEffects(axis, additionalEffects), copy);
}

/** Builds the full replacement outcome for a coexist special pair. */
export function coexistReplacementPairOutcome(
  id: ContentId,
  axis: WorldAxis,
  requestedPrice: number,
  recommendedPrice: number,
  additionalEffects: readonly Effect[] = [],
): Outcome {
  return createOutcome(id, [
    ...revenueEffects(requestedPrice + recommendedPrice),
    ...coexistPairEffects(axis, additionalEffects),
  ]);
}

/** Builds the full replacement outcome for a runaway special pair. */
export function runawayReplacementPairOutcome(
  id: ContentId,
  axis: WorldAxis,
  requestedPrice: number,
  recommendedPrice: number,
  additionalEffects: readonly Effect[] = [],
): Outcome {
  return createOutcome(id, [
    ...revenueEffects(requestedPrice + recommendedPrice),
    ...runawayPairEffects(axis, additionalEffects),
  ]);
}

export const makeOrdinarySaleOutcome = ordinarySaleOutcome;
export const createOrdinarySaleOutcome = ordinarySaleOutcome;
export const makeOrdinaryRefusalOutcome = ordinaryRefusalOutcome;
export const createOrdinaryRefusalOutcome = ordinaryRefusalOutcome;
export const makeOrdinaryDefaultRecommendationOutcome = ordinaryDefaultRecommendationOutcome;
export const createOrdinaryDefaultRecommendationOutcome = ordinaryDefaultRecommendationOutcome;
export const makeAbnormalDefaultRecommendationOutcome = abnormalDefaultRecommendationOutcome;
export const createAbnormalDefaultRecommendationOutcome = abnormalDefaultRecommendationOutcome;
export const makeAbnormalBaseSellOutcome = abnormalBaseSellOutcome;
export const createAbnormalBaseSellOutcome = abnormalBaseSellOutcome;
export const makeAbnormalRefusalOutcome = abnormalRefusalOutcome;
export const createAbnormalRefusalOutcome = abnormalRefusalOutcome;
export const createCoexistReplacementPairOutcome = coexistReplacementPairOutcome;
export const createRunawayReplacementPairOutcome = runawayReplacementPairOutcome;
