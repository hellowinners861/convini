import { WORLD_AXES } from "../domain/constants";
import type {
  Day5AnomalySlot,
  DayEncounterPlan,
  EncounterSlot,
  GameState,
  ResolvedEncounterQueue,
} from "../domain/types";
import { evaluateCondition } from "./conditions";
import { selectBestByPriorityThenId } from "./selection";
import {
  ContentValidationError,
  validateDay5AnomalySlots,
  validateDailyEncounterSlots,
  validateEncounterSlots,
} from "./validation";

function compareFixedId(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function compareDay5AnomalySlots(
  left: Day5AnomalySlot,
  right: Day5AnomalySlot,
  dayStartState: GameState,
): number {
  const scoreDifference = dayStartState.world[left.axis] - dayStartState.world[right.axis];
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  if (left.unresolvedness !== right.unresolvedness) {
    return right.unresolvedness - left.unresolvedness;
  }

  const lastAffectedAxisDifference =
    WORLD_AXES.indexOf(left.lastAffectedAxis) - WORLD_AXES.indexOf(right.lastAffectedAxis);
  if (lastAffectedAxisDifference !== 0) {
    return lastAffectedAxisDifference;
  }

  return compareFixedId(left.slotId, right.slotId);
}

export function orderDay5AnomalySlots(
  dayStartState: GameState,
  anomalySlots: Day5AnomalySlot[],
): Day5AnomalySlot[] {
  if (dayStartState.day !== 5) {
    throw new ContentValidationError("Day 5 ordering requires a day 5 snapshot", [
      `received day ${dayStartState.day}`,
    ]);
  }
  validateDay5AnomalySlots(anomalySlots);
  return [...anomalySlots].sort((left, right) =>
    compareDay5AnomalySlots(left, right, dayStartState),
  );
}

function cloneGameStateSnapshot(state: GameState): GameState {
  return {
    ...state,
    phase: { ...state.phase },
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

export function resolveEncounterSlot(slot: EncounterSlot, startState: GameState): string {
  validateEncounterSlots([slot]);
  const matchingCandidates = slot.candidates.filter((candidate) =>
    evaluateCondition(candidate.conditions, startState),
  );
  const selected = selectBestByPriorityThenId(
    matchingCandidates.map((candidate) => ({
      id: candidate.encounterId,
      priority: candidate.priority,
      candidate,
    })),
  );
  return selected?.candidate.encounterId ?? slot.fallbackEncounterId;
}

function applyDay5Ordering(
  slots: EncounterSlot[],
  anomalyOrder: Day5AnomalySlot[],
  dayStartState: GameState,
): EncounterSlot[] {
  const slotIndexes = new Map<string, number>();
  for (const [index, slot] of slots.entries()) {
    slotIndexes.set(slot.id, index);
  }

  const missingSlotIds = anomalyOrder
    .filter((entry) => !slotIndexes.has(entry.slotId))
    .map((entry) => entry.slotId);
  if (missingSlotIds.length > 0) {
    throw new ContentValidationError("Day 5 anomaly slot reference is missing", missingSlotIds);
  }

  const anomalyIndexes = anomalyOrder
    .map((entry) => slotIndexes.get(entry.slotId))
    .filter((index): index is number => index !== undefined)
    .sort((left, right) => left - right);
  const orderedAnomalies = orderDay5AnomalySlots(dayStartState, anomalyOrder);
  const replacementByIndex = new Map<number, EncounterSlot>();

  orderedAnomalies.forEach((entry, position) => {
    const originalIndex = slotIndexes.get(entry.slotId);
    if (originalIndex === undefined) {
      return;
    }
    replacementByIndex.set(anomalyIndexes[position], slots[originalIndex]);
  });

  return slots.map((slot, index) => replacementByIndex.get(index) ?? slot);
}

type EncounterQueueInput = EncounterSlot[] | DayEncounterPlan;

function isDayEncounterPlan(input: EncounterQueueInput): input is DayEncounterPlan {
  return !Array.isArray(input);
}

export function resolveEncounterQueue(
  slots: EncounterSlot[],
  dayStartState: GameState,
): ResolvedEncounterQueue;
export function resolveEncounterQueue(
  plan: DayEncounterPlan,
  dayStartState: GameState,
): ResolvedEncounterQueue;
export function resolveEncounterQueue(
  input: EncounterQueueInput,
  dayStartState: GameState,
): ResolvedEncounterQueue {
  const isPlan = isDayEncounterPlan(input);
  const day = isPlan ? input.day : dayStartState.day;
  const slots = isPlan ? input.slots : input;

  if (day !== dayStartState.day) {
    throw new ContentValidationError("Encounter plan day does not match day-start snapshot", [
      `plan day ${day}`,
      `snapshot day ${dayStartState.day}`,
    ]);
  }

  if (isPlan && day === 5 && !input.day5AnomalyOrder) {
    throw new ContentValidationError("Day 5 encounter plan requires anomaly ordering inputs", [
      "day5AnomalyOrder",
    ]);
  }

  validateDailyEncounterSlots(day, slots);
  const snapshot = cloneGameStateSnapshot(dayStartState);
  const orderedSlots =
    isPlan && day === 5 && input.day5AnomalyOrder
      ? applyDay5Ordering(slots, input.day5AnomalyOrder, snapshot)
      : slots;

  return {
    day: snapshot.day,
    snapshot,
    encounterIds: orderedSlots.map((slot) => resolveEncounterSlot(slot, snapshot)),
  };
}

export function resolveDayEncounterPlan(
  plan: DayEncounterPlan,
  dayStartState: GameState,
): ResolvedEncounterQueue {
  return resolveEncounterQueue(plan, dayStartState);
}
