import type { GameState } from "../domain";
import { evaluateCondition } from "../engine/conditions";
import type { ConditionalNarrative, Narrative, NarrativeVariant } from "./types";

function compareStableIds(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * Resolves authored copy without mutating the catalog. The fallback is guaranteed by the
 * authored contract and is returned whenever no variant condition matches.
 */
export function resolveNarrativeVariant(
  narrative: ConditionalNarrative,
  state: GameState,
): NarrativeVariant {
  const selected = narrative.variants
    .filter((variant) => evaluateCondition(variant.condition, state))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }
      return compareStableIds(left.id, right.id);
    })[0];

  return (
    selected ?? {
      id: "fallback",
      condition: { true: true },
      priority: Number.NEGATIVE_INFINITY,
      text: narrative.fallback,
    }
  );
}

export function resolveNarrative(narrative: Narrative, state: GameState): string {
  return typeof narrative === "string" ? narrative : resolveNarrativeVariant(narrative, state).text;
}

export const resolveConditionalNarrative = resolveNarrative;
