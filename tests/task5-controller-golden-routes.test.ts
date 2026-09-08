import { describe, expect, it } from "vitest";
import {
  ENCOUNTER_DECISION_EVENT_TYPE,
  ENDING_RESOLVED_EVENT_TYPE,
  gameReducer,
  initialAppState,
  reconstructEndingResult,
  type AppAction,
  type AppState,
} from "../src/app/gameController";
import {
  getTask5Encounter,
  simulateTask5AllRefusal,
  simulateTask5GoldenRoute,
  TASK5_CONTENT,
  TASK5_CONTENT_VERSION,
  TASK5_GOLDEN_ROUTES,
} from "../src/content";
import type { GameState } from "../src/domain";

function dispatch(state: AppState, action: AppAction): AppState {
  return gameReducer(state, action);
}

function gameOf(state: AppState): GameState {
  if (!state.game) {
    throw new Error("controller state has no game");
  }
  return state.game;
}

function readCurrentDayNews(state: AppState): AppState {
  const day = gameOf(state).day;
  const newsIds = gameOf(state).newsSelections
    .filter((selection) => selection.day === day)
    .map((selection) => selection.newsId);
  if (newsIds.length !== 3) {
    throw new Error(`expected three selected articles on day ${day}`);
  }

  let next = state;
  for (const newsId of newsIds) {
    next = dispatch(next, { type: "READ_NEWS", newsId });
  }
  return next;
}

function executeReducerRoute(
  routeId: string,
  decisionByEncounter: ReadonlyMap<string, string>,
): AppState {
  let state = dispatch(initialAppState, {
    type: "START_NEW_RUN",
    runId: routeId,
    contentVersion: TASK5_CONTENT_VERSION,
  });

  for (let day = 1; day <= 5; day += 1) {
    state = dispatch(state, { type: "BEGIN_DAY" });
    while (state.view === "encounter") {
      const game = gameOf(state);
      if (game.phase.kind !== "encounter") {
        throw new Error("encounter view lost its encounter phase");
      }
      const encounterId = game.phase.encounterId;
      const recommendedItemId = decisionByEncounter.get(encounterId);
      if (!recommendedItemId) {
        throw new Error(`route is missing decision for ${encounterId}`);
      }

      state = dispatch(state, { type: "SCAN_ENCOUNTER" });
      state = dispatch(state, { type: "RECOMMEND", recommendedItemId });
      state = dispatch(state, { type: "NEXT_ENCOUNTER" });
    }

    state = dispatch(state, { type: "OPEN_NEWS" });
    state = readCurrentDayNews(state);
    state = dispatch(state, { type: "ADVANCE_DAY" });
  }

  return state;
}

function executeReducerAllRefusal(): AppState {
  let state = dispatch(initialAppState, {
    type: "START_NEW_RUN",
    runId: "task5-all-refusal-controller",
    contentVersion: TASK5_CONTENT_VERSION,
  });

  for (let day = 1; day <= 5; day += 1) {
    state = dispatch(state, { type: "BEGIN_DAY" });
    while (state.view === "encounter") {
      state = dispatch(state, { type: "SCAN_ENCOUNTER" });
      state = dispatch(state, { type: "REFUSE" });
      state = dispatch(state, { type: "NEXT_ENCOUNTER" });
    }
    state = dispatch(state, { type: "OPEN_NEWS" });
    state = readCurrentDayNews(state);
    state = dispatch(state, { type: "ADVANCE_DAY" });
  }

  return state;
}

function decisionEvents(game: GameState) {
  return game.eventLog.filter((event) => event.type === ENCOUNTER_DECISION_EVENT_TYPE);
}

function selectedNewsForDay(game: GameState, day: GameState["day"]) {
  return game.newsSelections.filter((selection) => selection.day === day);
}

describe("Task 5 controller golden routes", () => {
  it("executes every canonical route through reducer actions and matches its oracle fingerprint", () => {
    const endingIds: string[] = [];

    for (const route of TASK5_GOLDEN_ROUTES) {
      const decisionByEncounter = new Map(
        route.decisions.map((decision) => [decision.encounterId, decision.recommendedItemId]),
      );
      const state = executeReducerRoute(route.id, decisionByEncounter);
      const game = gameOf(state);
      const ending = reconstructEndingResult(game);
      if (!ending) {
        throw new Error(`route ${route.id} has no reconstructable ending`);
      }

      expect(state.view).toBe("ending");
      expect(game.phase).toEqual({ kind: "ending", endingId: route.expected.endingId });
      expect(ending).toMatchObject({
        eventId: `${route.id}:ending`,
        endingId: route.expected.endingId,
        convergenceAxis: route.expected.convergenceAxis,
      });
      expect(game.world).toEqual(route.expected.world);
      expect(game.stability).toBe(route.expected.stability);
      expect(game.awareness).toBe(route.expected.awareness);
      expect(game.customerStates).toEqual(route.expected.customerStates);
      // The original route oracle predates the last-unit inventory record.
      expect(game.flags.filter((flag) => !flag.startsWith("night:"))).toEqual(route.expected.flags);
      expect(game.flags.filter((flag) => flag.startsWith("night:"))).toEqual(
        decisionByEncounter.get("d3_mew_return") === "mobile_power_bank" ? ["night:power-mew"] : [],
      );
      expect(decisionEvents(game)).toHaveLength(route.expected.encounterDecisionCount);
      expect(game.newsSelections).toHaveLength(route.expected.selectedNewsCount);
      expect(new Set(game.newsSelections.map((selection) => selection.newsId))).toHaveLength(15);
      expect(game.readNews).toHaveLength(route.expected.readNewsCount);
      expect(new Set(game.readNews)).toHaveLength(15);
      expect(new Set(game.newsSelections.map((selection) => selection.day))).toHaveLength(
        route.expected.completedDayCount,
      );
      for (let day = 1; day <= 5; day += 1) {
        expect(selectedNewsForDay(game, day as GameState["day"])).toHaveLength(3);
      }

      const endingEvents = game.eventLog.filter(
        (event) => event.type === ENDING_RESOLVED_EVENT_TYPE,
      );
      expect(endingEvents).toHaveLength(1);
      expect(endingEvents[0].data).toMatchObject({
        endingId: ending.endingId,
        title: ending.title,
        priority: ending.priority,
        isFallback: ending.isFallback,
        convergenceAxis: route.expected.convergenceAxis,
      });

      const oracle = simulateTask5GoldenRoute(route);
      expect({
        endingId: ending.endingId,
        world: game.world,
        stability: game.stability,
        awareness: game.awareness,
        convergenceAxis: ending.convergenceAxis,
        customerStates: game.customerStates,
        flags: game.flags.filter((flag) => !flag.startsWith("night:")),
        encounterDecisionCount: decisionEvents(game).length,
        completedDayCount: new Set(game.newsSelections.map((selection) => selection.day)).size,
        selectedNewsCount: game.newsSelections.length,
        readNewsCount: game.readNews.length,
      }).toEqual(oracle.fingerprint);

      endingIds.push(ending.endingId);
    }

    expect(new Set(endingIds)).toHaveLength(5);
    expect(endingIds).toEqual(TASK5_GOLDEN_ROUTES.map((route) => route.expected.endingId));
  });

  it("reaches the real all-refusal boundary through 29 REFUSE actions and five news rounds", () => {
    const state = executeReducerAllRefusal();
    const game = gameOf(state);
    const ending = reconstructEndingResult(game);
    if (!ending) {
      throw new Error("all-refusal route has no reconstructable ending");
    }

    expect(state.view).toBe("ending");
    expect(game.world).toEqual({ undead: 4, machine: 4, cosmic: 4, spirit: 4 });
    expect(game.stability).toBe(-18);
    expect(game.flags).toContain("convergence_refused");
    expect(decisionEvents(game)).toHaveLength(29);
    expect(decisionEvents(game).every((event) => event.data.decision === "refuse")).toBe(true);
    expect(game.newsSelections).toHaveLength(15);
    expect(new Set(game.newsSelections.map((selection) => selection.newsId))).toHaveLength(15);
    expect(game.readNews).toHaveLength(15);
    expect(new Set(game.readNews)).toHaveLength(15);
    expect(ending).toMatchObject({
      endingId: "inventory_mixup",
      title: "在庫混線",
      priority: 300,
      isFallback: false,
    });
    expect(ending.convergenceAxis).toBeUndefined();
    expect(
      game.eventLog.filter((event) => event.type === ENDING_RESOLVED_EVENT_TYPE),
    ).toHaveLength(1);
    expect(game.eventLog.at(-1)?.data).not.toHaveProperty("convergenceAxis");

    const oracle = simulateTask5AllRefusal();
    expect(oracle.fingerprint.world).toEqual(game.world);
    expect(oracle.fingerprint.stability).toBe(game.stability);
    expect(oracle.fingerprint.endingId).toBe(ending.endingId);
    expect(oracle.fingerprint.selectedNewsCount).toBe(15);
    expect(oracle.fingerprint.readNewsCount).toBe(15);
    expect(TASK5_CONTENT.encounters).toHaveLength(29);
    expect(TASK5_CONTENT.encounters.every((encounter) => getTask5Encounter(encounter.id))).toBe(true);
  });

  it("does not bypass the three-article gate on any day", () => {
    let state = dispatch(initialAppState, {
      type: "START_NEW_RUN",
      runId: "task5-news-gate-controller",
      contentVersion: TASK5_CONTENT_VERSION,
    });
    state = dispatch(state, { type: "BEGIN_DAY" });
    while (state.view === "encounter") {
      state = dispatch(state, { type: "SCAN_ENCOUNTER" });
      state = dispatch(state, { type: "SELL" });
      state = dispatch(state, { type: "NEXT_ENCOUNTER" });
    }
    state = dispatch(state, { type: "OPEN_NEWS" });
    const ids = gameOf(state).newsSelections.map((selection) => selection.newsId);
    state = dispatch(state, { type: "READ_NEWS", newsId: ids[0] });
    expect(dispatch(state, { type: "ADVANCE_DAY" })).toBe(state);
    state = dispatch(state, { type: "READ_NEWS", newsId: ids[1] });
    expect(dispatch(state, { type: "ADVANCE_DAY" })).toBe(state);
  });
});
