import type { Condition, GameState } from "../../domain/types";
import {
  evaluateCondition,
  getLeadingAxis,
  getNumericReference,
  rankWorldAxes,
} from "../../engine/conditions";
import type { ConditionOptions } from "../../engine/conditions";
import type { ConditionTrace } from "../contracts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export function traceCondition(
  condition: Condition,
  state: GameState,
  options: ConditionOptions = {},
): ConditionTrace {
  const result = evaluateCondition(condition, state, options);

  if ("true" in condition) {
    return freeze({ kind: "true" as const, result });
  }

  if ("all" in condition) {
    const children = condition.all.map((child) => traceCondition(child, state, options));
    const matchedIndexes: number[] = [];
    const failedIndexes: number[] = [];

    children.forEach((child, index) => {
      (child.result ? matchedIndexes : failedIndexes).push(index);
    });

    return freeze({
      kind: "all" as const,
      result,
      children: freeze(children),
      matchedIndexes: freeze(matchedIndexes),
      failedIndexes: freeze(failedIndexes),
    });
  }

  if ("any" in condition) {
    const children = condition.any.map((child) => traceCondition(child, state, options));
    const matchedIndexes: number[] = [];
    const failedIndexes: number[] = [];

    children.forEach((child, index) => {
      (child.result ? matchedIndexes : failedIndexes).push(index);
    });

    return freeze({
      kind: "any" as const,
      result,
      children: freeze(children),
      matchedIndexes: freeze(matchedIndexes),
      failedIndexes: freeze(failedIndexes),
    });
  }

  if ("not" in condition) {
    return freeze({
      kind: "not" as const,
      result,
      child: traceCondition(condition.not, state, options),
    });
  }

  if ("numeric" in condition) {
    const actual = getNumericReference(state, condition.numeric.reference, options);

    return freeze({
      kind: "numeric" as const,
      result,
      ref: condition.numeric.reference,
      actual,
      op: condition.numeric.operator,
      expected: condition.numeric.value,
    });
  }

  if ("flag" in condition) {
    const actual = state.flags.includes(condition.flag.id);
    const expected = condition.flag.present ?? true;

    return freeze({
      kind: "flag" as const,
      result,
      flag: condition.flag.id,
      expected,
      actual,
    });
  }

  if ("customerState" in condition) {
    const actual = state.customerStates[condition.customerState.customerId] ?? null;

    return freeze({
      kind: "customer-state" as const,
      result,
      customerId: condition.customerState.customerId,
      expected: condition.customerState.state,
      actual,
    });
  }

  if ("seenNews" in condition) {
    return freeze({
      kind: "seen-news" as const,
      result,
      newsId: condition.seenNews.id,
      actual: state.seenNews.includes(condition.seenNews.id),
    });
  }

  if ("readNews" in condition) {
    return freeze({
      kind: "read-news" as const,
      result,
      newsId: condition.readNews.id,
      actual: state.readNews.includes(condition.readNews.id),
    });
  }

  const ranking = rankWorldAxes(state, options.tieBreakerAxis).map((entry) =>
    freeze({ axis: entry.axis, value: entry.value }),
  );

  return freeze({
    kind: "leading-axis" as const,
    result,
    expected: condition.leadingAxis.axis,
    actual: getLeadingAxis(state, options.tieBreakerAxis),
    tieBreakerAxis: options.tieBreakerAxis ?? null,
    ranking: freeze(ranking),
  });
}
