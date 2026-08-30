import {
  STRONG_AXIS_THRESHOLD,
  WORLD_AXES,
} from "../domain/constants";
import type { ComparisonOperator, NumericReference, WorldAxis } from "../domain/constants";
import type { Condition, GameState } from "../domain/types";

export interface RankedWorldAxis {
  axis: WorldAxis;
  value: number;
}

export interface ConditionOptions {
  tieBreakerAxis?: WorldAxis;
}

function axisOrder(tieBreakerAxis?: WorldAxis): WorldAxis[] {
  if (!tieBreakerAxis) {
    return [...WORLD_AXES];
  }

  return [tieBreakerAxis, ...WORLD_AXES.filter((axis) => axis !== tieBreakerAxis)];
}

export function rankWorldAxes(state: GameState, tieBreakerAxis?: WorldAxis): RankedWorldAxis[] {
  const order = axisOrder(tieBreakerAxis);
  return [...WORLD_AXES]
    .map((axis) => ({ axis, value: state.world[axis] }))
    .sort((left, right) => {
      if (left.value !== right.value) {
        return right.value - left.value;
      }
      return order.indexOf(left.axis) - order.indexOf(right.axis);
    });
}

export function getLeadingAxis(state: GameState, tieBreakerAxis?: WorldAxis): WorldAxis {
  return rankWorldAxes(state, tieBreakerAxis)[0].axis;
}

export function areWorldAxesTied(state: GameState): boolean {
  return WORLD_AXES.every((axis) => state.world[axis] === state.world[WORLD_AXES[0]]);
}

export function getNumericReference(
  state: GameState,
  reference: NumericReference,
  options: ConditionOptions = {},
): number {
  const ranking = rankWorldAxes(state, options.tieBreakerAxis);

  switch (reference) {
    case "world.undead":
      return state.world.undead;
    case "world.machine":
      return state.world.machine;
    case "world.cosmic":
      return state.world.cosmic;
    case "world.spirit":
      return state.world.spirit;
    case "stability":
      return state.stability;
    case "awareness":
      return state.awareness;
    case "managerTrust":
      return state.managerTrust;
    case "revenue.total":
      return state.revenue.total;
    case "revenue.today":
      return state.revenue.today;
    case "revenue.dailyTarget":
      return state.revenue.dailyTarget;
    case "day":
      return state.day;
    case "leadingValue":
      return ranking[0].value;
    case "secondValue":
      return ranking[1].value;
    case "axisDifference":
      return ranking[0].value - ranking[1].value;
    case "strongAxisCount":
      return WORLD_AXES.filter((axis) => state.world[axis] >= STRONG_AXIS_THRESHOLD).length;
  }

  throw new Error(`Unsupported numeric reference: ${reference}`);
}

function compareNumeric(left: number, operator: ComparisonOperator, right: number): boolean {
  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
  }

  throw new Error(`Unsupported comparison operator: ${operator}`);
}

export function evaluateCondition(
  condition: Condition,
  state: GameState,
  options: ConditionOptions = {},
): boolean {
  if ("true" in condition) {
    return condition.true;
  }
  if ("all" in condition) {
    return condition.all.every((child) => evaluateCondition(child, state, options));
  }
  if ("any" in condition) {
    return condition.any.some((child) => evaluateCondition(child, state, options));
  }
  if ("not" in condition) {
    return !evaluateCondition(condition.not, state, options);
  }
  if ("numeric" in condition) {
    return compareNumeric(
      getNumericReference(state, condition.numeric.reference, options),
      condition.numeric.operator,
      condition.numeric.value,
    );
  }
  if ("flag" in condition) {
    const present = state.flags.includes(condition.flag.id);
    return condition.flag.present === false ? !present : present;
  }
  if ("customerState" in condition) {
    return state.customerStates[condition.customerState.customerId] === condition.customerState.state;
  }
  if ("seenNews" in condition) {
    const present = state.seenNews.includes(condition.seenNews.id);
    return condition.seenNews.present === false ? !present : present;
  }
  if ("readNews" in condition) {
    const present = state.readNews.includes(condition.readNews.id);
    return condition.readNews.present === false ? !present : present;
  }
  return condition.leadingAxis.axis === getLeadingAxis(state, options.tieBreakerAxis);
}

export function isUnconditionalCondition(condition: Condition): boolean {
  return "true" in condition && condition.true === true;
}
