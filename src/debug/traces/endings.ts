import type { WorldAxis } from "../../domain/constants";
import { ENDING_RULES } from "../../domain/endings";
import type { EndingDefinition, EndingResolution, GameState } from "../../domain/types";
import { areWorldAxesTied } from "../../engine/conditions";
import { determineEnding } from "../../engine/endings";
import { sortByPriorityThenId } from "../../engine/selection";
import { traceCondition } from "./conditions";
import type { EndingRuleTrace, EndingTrace, EndingTraceExclusionCode } from "../contracts";

export interface EndingTraceOptions {
  convergenceAxis?: WorldAxis;
}

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function isSingleAxisRule(rule: EndingDefinition): boolean {
  return "leadingAxis" in rule.condition;
}

function frozenResolution(resolution: EndingResolution): EndingResolution {
  return freeze({ ...resolution });
}

export function traceEndingResolution(
  state: GameState,
  options: EndingTraceOptions = {},
  rules: EndingDefinition[] = ENDING_RULES,
): EndingTrace {
  const selectedResolution = frozenResolution(determineEnding(state, options, rules));
  const orderedRules = sortByPriorityThenId(rules);
  const tieWithoutConvergenceAxis = areWorldAxesTied(state) && !options.convergenceAxis;
  const traces: EndingRuleTrace[] = [];

  for (const rule of orderedRules) {
    const conditionTrace = traceCondition(rule.condition, state, {
      tieBreakerAxis: options.convergenceAxis,
    });
    const selected =
      rule.id === selectedResolution.id &&
      rule.priority === selectedResolution.priority &&
      (rule.isFallback === true) === selectedResolution.isFallback;
    let exclusionCode: EndingTraceExclusionCode | null = null;
    let eligibility = true;

    if (rule.isFallback === true) {
      if (!selected) {
        exclusionCode = "fallback-only";
        eligibility = false;
      }
    } else if (tieWithoutConvergenceAxis && isSingleAxisRule(rule)) {
      exclusionCode = "tie-without-convergence";
      eligibility = false;
    } else if (!conditionTrace.result) {
      exclusionCode = "condition-failed";
      eligibility = false;
    }

    if (eligibility && !selected) {
      exclusionCode = "lower-priority";
    }

    traces.push(
      freeze({
        id: rule.id,
        priority: rule.priority,
        isFallback: rule.isFallback === true,
        conditionTrace,
        eligibility,
        selected,
        exclusionCode,
        selectedResolution: selected ? selectedResolution : null,
      }),
    );
  }

  return freeze({
    selectedResolution,
    rules: freeze(traces),
  });
}

export const traceEnding = traceEndingResolution;
