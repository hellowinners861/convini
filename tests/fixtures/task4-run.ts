import { getTask5Encounter, TASK5_CONTENT } from "../../src/content";
import type { Day } from "../../src/domain";
import {
  gameReducer,
  initialAppState,
  TASK4_DEFAULT_CONTENT_VERSION,
  TASK4_DEFAULT_RUN_ID,
  TASK5_DEFAULT_CONTENT_VERSION,
  TASK5_DEFAULT_RUN_ID,
  type AppState,
  type Decision,
} from "../../src/app/gameController";

export function startTask5Run(
  runId = TASK5_DEFAULT_RUN_ID,
  contentVersion = TASK5_DEFAULT_CONTENT_VERSION,
): AppState {
  return gameReducer(initialAppState, {
    type: "START_NEW_RUN",
    runId,
    contentVersion,
  });
}

/** Compatibility helper name retained for accepted Task 4 controller tests. */
export function startTask4Run(
  runId = TASK4_DEFAULT_RUN_ID,
  contentVersion = TASK4_DEFAULT_CONTENT_VERSION,
): AppState {
  return startTask5Run(runId, contentVersion);
}

export function beginTask4Day(state: AppState): AppState {
  return gameReducer(state, { type: "BEGIN_DAY" });
}

export const beginTask5Day = beginTask4Day;

export function currentTask5Encounter(state: AppState) {
  if (!state.game || state.game.phase.kind !== "encounter") {
    throw new Error("current state is not an encounter");
  }
  return getTask5Encounter(state.game.phase.encounterId);
}

/** Compatibility helper name retained for accepted Task 4 controller tests. */
export const currentTask4Encounter = currentTask5Encounter;

export function scanToDecision(state: AppState): AppState {
  let next = gameReducer(state, { type: "SCAN_ENCOUNTER" });
  next = gameReducer(next, { type: "OPEN_DECISION" });
  return next;
}

export function decideCurrentEncounter(
  state: AppState,
  decision: Decision,
  recommendedItemId?: string,
): AppState {
  const decisionState = scanToDecision(state);
  if (decision === "sell") {
    return gameReducer(decisionState, { type: "SELL" });
  }
  if (decision === "refuse") {
    return gameReducer(decisionState, { type: "REFUSE" });
  }

  const encounter = currentTask5Encounter(decisionState);
  const itemId = recommendedItemId ?? encounter.recommendationOptions[0]?.itemId;
  if (!itemId) {
    throw new Error(`encounter ${encounter.id} has no recommendation option`);
  }
  return gameReducer(decisionState, { type: "RECOMMEND", recommendedItemId: itemId });
}

export function nextEncounter(state: AppState): AppState {
  return gameReducer(state, { type: "NEXT_ENCOUNTER" });
}

export function completeTask4Day(
  state: AppState,
  decisions?: readonly Decision[],
): AppState {
  const count = state.game?.resolvedQueue.length ?? 0;
  const selectedDecisions = decisions ?? Array.from({ length: count }, () => "sell" as const);
  if (selectedDecisions.length !== count) {
    throw new Error(`expected ${count} decisions, received ${selectedDecisions.length}`);
  }

  let next = state;
  selectedDecisions.forEach((decision, index) => {
    next = decideCurrentEncounter(next, decision);
    if (index < selectedDecisions.length - 1 || next.view === "encounter") {
      next = nextEncounter(next);
    }
  });
  return next;
}

export function openAndReadTask5News(state: AppState): AppState {
  let next = gameReducer(state, { type: "OPEN_NEWS" });
  const newsIds = next.game?.newsSelections
    .filter((selection) => selection.day === next.game?.day)
    .map((selection) => selection.newsId) ?? [];
  newsIds.forEach((newsId) => {
    next = gameReducer(next, { type: "READ_NEWS", newsId });
  });
  return next;
}

/** Compatibility helper name retained; it now reads the current day's Task 5 news. */
export const openAndReadTask4Day1News = openAndReadTask5News;

export function advanceToNextDay(state: AppState): AppState {
  return gameReducer(state, { type: "ADVANCE_DAY" });
}

export function reachDay5Briefing(): AppState {
  let state = beginTask4Day(startTask4Run());
  state = completeTask4Day(state);
  state = openAndReadTask4Day1News(state);
  state = advanceToNextDay(state);

  for (const day of [2, 3, 4] as const) {
    if (state.game?.day !== day || state.view !== "briefing") {
      throw new Error(`expected day ${day} briefing`);
    }
    state = beginTask4Day(state);
    state = completeTask4Day(state);
    state = openAndReadTask5News(state);
    state = advanceToNextDay(state);
  }

  if (state.game?.day !== 5 || state.view !== "briefing") {
    throw new Error("expected day 5 briefing");
  }
  return state;
}

export function dayEncounterCounts(): Record<Day, number> {
  return Object.fromEntries(
    TASK5_CONTENT.dayPlans.map((plan) => [plan.day, plan.slots.length]),
  ) as Record<Day, number>;
}
