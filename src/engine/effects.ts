import type { NumericEffectTarget } from "../domain/constants";
import type { Effect, GameState, Outcome } from "../domain/types";
import { ContentValidationError } from "./errors";

export interface AggregatedEffects {
  numericAdds: Map<NumericEffectTarget, number>;
  flags: Set<string>;
  customerStates: Map<string, string>;
}

export function aggregateEffects(effects: Effect[]): AggregatedEffects {
  const numericAdds = new Map<NumericEffectTarget, number>();
  const flags = new Set<string>();
  const customerStates = new Map<string, string>();

  for (const effect of effects) {
    switch (effect.kind) {
      case "add":
        numericAdds.set(effect.target, (numericAdds.get(effect.target) ?? 0) + effect.amount);
        break;
      case "setFlag":
        flags.add(effect.id);
        break;
      case "setCustomerState":
        if (customerStates.has(effect.customerId)) {
          throw new ContentValidationError("Multiple customer states in one outcome", [
            effect.customerId,
          ]);
        }
        customerStates.set(effect.customerId, effect.state);
        break;
    }
  }

  return { numericAdds, flags, customerStates };
}

function addNumericEffect(state: GameState, target: NumericEffectTarget, amount: number): void {
  switch (target) {
    case "world.undead":
      state.world.undead += amount;
      break;
    case "world.machine":
      state.world.machine += amount;
      break;
    case "world.cosmic":
      state.world.cosmic += amount;
      break;
    case "world.spirit":
      state.world.spirit += amount;
      break;
    case "stability":
      state.stability += amount;
      break;
    case "awareness":
      state.awareness += amount;
      break;
    case "managerTrust":
      state.managerTrust += amount;
      break;
    case "revenue.total":
      state.revenue.total += amount;
      break;
    case "revenue.today":
      state.revenue.today += amount;
      break;
    case "revenue.dailyTarget":
      state.revenue.dailyTarget += amount;
      break;
  }
}

function copyState(state: GameState): GameState {
  return {
    ...state,
    world: { ...state.world },
    revenue: { ...state.revenue },
    flags: [...state.flags],
    customerStates: { ...state.customerStates },
    seenNews: [...state.seenNews],
    readNews: [...state.readNews],
    resolvedQueue: [...state.resolvedQueue],
    newsSelections: state.newsSelections.map((selection) => ({ ...selection })),
    eventLog: state.eventLog.map((event) => ({ ...event, data: { ...event.data } })),
  };
}

export function applyEffects(state: GameState, effects: Effect[]): GameState {
  const aggregated = aggregateEffects(effects);
  const next = copyState(state);

  for (const [target, amount] of aggregated.numericAdds) {
    addNumericEffect(next, target, amount);
  }

  next.flags = [...new Set([...state.flags, ...aggregated.flags])];
  for (const [customerId, customerState] of aggregated.customerStates) {
    next.customerStates[customerId] = customerState;
  }

  return next;
}

export function applyOutcome(state: GameState, outcome: Outcome): GameState {
  return applyEffects(state, outcome.effects);
}

export function mergeOutcomes(base: Outcome, addition: Outcome): Outcome {
  return {
    id: `${base.id}::${addition.id}`,
    effects: [...base.effects, ...addition.effects],
  };
}

export function validateOutcomeEffects(outcome: Outcome): void {
  aggregateEffects(outcome.effects);
}
