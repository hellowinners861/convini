import { describe, expect, it } from "vitest";
import { getTask5Encounter, TASK5_CONTENT } from "../src/content";
import { CONNECTION_FLAGS as flags, connectionEcho, receiptFlag, witnessFlag } from "../src/content/connections";
import { CONTEXT_RECOMMENDATION_PAIRS } from "../src/content/pairs/contextPairs";
import { gameReducer, restoreAppStateFromRun, validateRunForResume, type AppState } from "../src/app/gameController";
import { evaluateCondition, resolveRecommendation } from "../src/engine";
import { beginTask5Day, startTask5Run, openAndReadTask5News } from "./fixtures/task4-run";
import { makeState } from "./fixtures/state";

function ask(state: AppState, questionId: string) {
  return gameReducer(state, { type: "ASK_QUESTION", questionId });
}

function roundTrip(state: AppState): AppState {
  if (!state.game) throw new Error("Missing run");
  const saved = JSON.parse(JSON.stringify(state.game));
  expect(validateRunForResume(saved)).toBe(true);
  const restored = restoreAppStateFromRun(saved);
  expect(restored?.game).toEqual(state.game);
  if (!restored) throw new Error("Save rejected");
  return restored;
}

function playTo(target?: string): AppState {
  let state = beginTask5Day(startTask5Run("connection-route"));
  for (let guard = 0; guard < 200; guard += 1) {
    if (!state.game) throw new Error("Missing game");
    if (state.game.phase.kind === "encounter") {
      const encounter = getTask5Encounter(state.game.phase.encounterId);
      if (encounter.id === target && state.game.phase.subPhase === "intro") return state;
      const question = encounter.questions?.find((candidate) => evaluateCondition(candidate.conditions, state.game!));
      if (question) state = ask(state, question.id);
      state = gameReducer(state, { type: "SCAN_ENCOUNTER" });
      const special = CONTEXT_RECOMMENDATION_PAIRS.find((pair) =>
        pair.customerId === encounter.customerId && evaluateCondition(pair.conditions, state.game!),
      );
      state = gameReducer(state, {
        type: "RECOMMEND",
        recommendedItemId: special?.recommendedItemId ?? encounter.recommendationOptions[0].itemId,
      });
      state = gameReducer(state, { type: "HAND_RECEIPT" });
      state = roundTrip(state);
      state = gameReducer(state, { type: "NEXT_ENCOUNTER" });
    } else if (state.view === "shiftSummary") {
      state = openAndReadTask5News(state);
      state = gameReducer(state, { type: "ADVANCE_DAY" });
    } else if (state.view === "briefing") {
      state = beginTask5Day(state);
    } else if (state.view === "ending") return state;
    else throw new Error(`Unexpected view: ${state.view}`);
  }
  throw new Error("Route did not finish");
}

describe("conversations, receipts and connected consequences", () => {
  it("records a question once, preserves the scan gate and rejects unrelated questions", () => {
    let state = beginTask5Day(startTask5Run());
    expect(ask(state, flags.rescueQuestion)).toBe(state);
    const before = state.game!;
    state = ask(state, "asked_d1_taxi_baseline");
    expect(state.game?.phase).toEqual(before.phase);
    expect(state.game?.revenue).toEqual(before.revenue);
    expect(state.game?.eventLog).toEqual([]);
    expect(ask(state, "asked_d1_taxi_baseline")).toBe(state);
    expect(gameReducer(state, { type: "SELL" })).toBe(state);
    expect(roundTrip(state).game?.flags).toContain("asked_d1_taxi_baseline");
  });

  it("hands out a receipt only after a completed sale, without duplicating revenue or events", () => {
    let state = playTo("d1_miyashita_baseline");
    expect(gameReducer(state, { type: "HAND_RECEIPT" })).toBe(state);
    state = gameReducer(state, { type: "SCAN_ENCOUNTER" });
    const refused = gameReducer(state, { type: "REFUSE" });
    expect(gameReducer(refused, { type: "HAND_RECEIPT" })).toBe(refused);
    state = gameReducer(state, { type: "SELL" });
    const before = state.game!;
    state = gameReducer(state, { type: "HAND_RECEIPT" });
    expect(state.game?.flags).toContain(witnessFlag("miyashita"));
    expect(state.game?.flags).toContain(receiptFlag("d1_miyashita_baseline"));
    expect(state.game?.eventLog).toEqual(before.eventLog);
    expect(state.game?.revenue).toEqual(before.revenue);
    expect(gameReducer(state, { type: "HAND_RECEIPT" })).toBe(state);
    expect(roundTrip(state).game?.flags).toEqual(state.game?.flags);
  });

  it("requires an available conversation and allows only one question per encounter", () => {
    let state = playTo("d3_hako3_return");
    const unknown = { ...state, game: { ...state.game!, flags: [], customerStates: {} } };
    expect(ask(unknown, flags.repairQuestion)).toBe(unknown);
    state = ask(state, "asked_d3_hako3_return");
    expect(ask(state, flags.repairQuestion)).toBe(state);
  });

  it.each(CONTEXT_RECOMMENDATION_PAIRS)("changes $id only after its question and on its intended day", (pair) => {
    const day = pair.id.includes("hako3") ? 3 : 4;
    const questionFlag = pair.id.includes("hako3") ? flags.repairQuestion : pair.id.includes("mew") ? flags.rescueQuestion : flags.boundaryQuestion;
    const encounter = TASK5_CONTENT.encounters.find((candidate) => candidate.customerId === pair.customerId)!;
    const resolve = (dayValue: 3 | 4 | 5, asked: boolean) => resolveRecommendation({
      state: makeState({ day: dayValue, flags: asked ? [questionFlag] : [] }),
      customerId: pair.customerId, requestedItemId: pair.requestedItemId,
      recommendedItemId: pair.recommendedItemId, pairs: TASK5_CONTENT.recommendationPairs,
      baseSale: encounter.outcomes.sell, defaultOutcome: encounter.outcomes.defaultRecommend,
    });
    expect(resolve(day, true).pairId).toBe(pair.id);
    expect(resolve(day, false).pairId).not.toBe(pair.id);
    expect(resolve(5, true).pairId).not.toBe(pair.id);
  });

  it("delivers feedback through other customers and completes all five nights with resumable consequences", () => {
    const nurse = playTo("d3_miyashita_four_wards");
    expect(nurse.game?.flags).toContain(flags.delivery);
    expect(connectionEcho(getTask5Encounter("d3_miyashita_four_wards"), nurse.game!)).toContain("車輪だけ");
    const end = playTo();
    expect(end.view).toBe("ending");
    expect(end.game?.flags).toEqual(expect.arrayContaining([flags.delivery, flags.rescue, flags.boundary]));
    expect(end.game?.eventLog.filter((event) => event.type === "encounter.decision")).toHaveLength(29);
    expect(end.game?.readNews).toHaveLength(15);
    expect(roundTrip(end).game).toEqual(end.game);
  });
});
