import { ENDING_RULES } from "../domain/endings";
import type { WorldAxis } from "../domain/constants";
import type { EndingDefinition, EndingResolution, GameState } from "../domain/types";
import { areWorldAxesTied, evaluateCondition } from "./conditions";
import { selectBestByPriorityThenId } from "./selection";
import { validateEndingRules } from "./validation";

export interface EndingResolutionOptions {
  convergenceAxis?: WorldAxis;
}

function isSingleAxisRule(rule: EndingDefinition): boolean {
  return "leadingAxis" in rule.condition;
}

export function determineEnding(
  state: GameState,
  options: EndingResolutionOptions = {},
  rules: EndingDefinition[] = ENDING_RULES,
): EndingResolution {
  validateEndingRules(rules);
  const fallback = rules.find((rule) => rule.isFallback === true);
  if (!fallback) {
    throw new Error("Ending fallback is required.");
  }

  const tieWithoutConvergenceAxis = areWorldAxesTied(state) && !options.convergenceAxis;
  const matchingRules = rules.filter(
    (rule) =>
      rule.isFallback !== true &&
      (!tieWithoutConvergenceAxis || !isSingleAxisRule(rule)) &&
      evaluateCondition(rule.condition, state, { tieBreakerAxis: options.convergenceAxis }),
  );
  const selected = selectBestByPriorityThenId(matchingRules) ?? fallback;

  return {
    id: selected.id,
    title: selected.title,
    priority: selected.priority,
    isFallback: selected.isFallback === true,
  };
}
