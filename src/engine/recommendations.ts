import type {
  GameState,
  Outcome,
  RecommendationPair,
  RecommendationResolution,
} from "../domain/types";
import { evaluateCondition } from "./conditions";
import { mergeOutcomes } from "./effects";
import { selectWithoutPriorityAmbiguity } from "./selection";
import { validateRecommendationPairs } from "./validation";

export interface RecommendationResolutionInput {
  state: GameState;
  customerId: string;
  requestedItemId: string;
  recommendedItemId: string;
  pairs: RecommendationPair[];
  baseSale: Outcome;
  defaultOutcome: Outcome;
}

export function resolveRecommendation(
  input: RecommendationResolutionInput,
): RecommendationResolution {
  validateRecommendationPairs(input.pairs, {
    baseSale: input.baseSale,
    defaultOutcome: input.defaultOutcome,
  });
  const matchingPairs = input.pairs.filter(
    (pair) =>
      pair.customerId === input.customerId &&
      pair.requestedItemId === input.requestedItemId &&
      pair.recommendedItemId === input.recommendedItemId &&
      evaluateCondition(pair.conditions, input.state),
  );
  const selected = selectWithoutPriorityAmbiguity(matchingPairs, "recommendation pair");

  if (!selected) {
    return {
      source: "default",
      mode: "default",
      outcome: input.defaultOutcome,
    };
  }

  return {
    source: "pair",
    mode: selected.mode,
    pairId: selected.id,
    outcome:
      selected.mode === "append-base-sale"
        ? mergeOutcomes(input.baseSale, selected.outcome)
        : selected.outcome,
  };
}
