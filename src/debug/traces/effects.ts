import type { NumericEffectTarget } from "../../domain/constants";
import type { Effect, GameState } from "../../domain/types";
import { aggregateEffects, applyEffects } from "../../engine/effects";
import type {
  CustomerStateEffectTrace,
  EffectsTrace,
  FlagEffectTrace,
  NumericEffectTrace,
} from "../contracts";

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function numericValue(state: GameState, target: NumericEffectTarget): number {
  switch (target) {
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
  }

  throw new Error(`Unsupported numeric effect target: ${target}`);
}

export function traceEffects(state: GameState, effects: Effect[]): EffectsTrace {
  const aggregated = aggregateEffects(effects);
  const next = applyEffects(state, effects);

  const numeric: NumericEffectTrace[] = Array.from(aggregated.numericAdds.entries()).map(
    ([target, delta]) => {
      const before = numericValue(state, target);
      const after = numericValue(next, target);
      return freeze({ target, before, delta, after });
    },
  );
  const flags: FlagEffectTrace[] = Array.from(aggregated.flags).map((id) => {
    const before = state.flags.includes(id);
    const after = next.flags.includes(id);
    return freeze({ id, before, after, changed: before !== after });
  });
  const customerStates: CustomerStateEffectTrace[] = Array.from(
    aggregated.customerStates.entries(),
  ).map(([customerId]) => {
    const before = state.customerStates[customerId] ?? null;
    const nextState = next.customerStates[customerId] ?? null;
    return freeze({
      customerId,
      before,
      after: nextState,
      changed: before !== nextState,
    });
  });

  return freeze({
    numeric: freeze(numeric),
    flags: freeze(flags),
    customerStates: freeze(customerStates),
  });
}

export const traceEffectApplication = traceEffects;
export const traceApplyEffects = traceEffects;
