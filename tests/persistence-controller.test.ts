import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  gameReducer,
  initialAppState,
  restoreAppStateFromRun,
  validateRunForResume,
  type AppState,
} from "../src/app/gameController";
import { TASK5_CONTENT_VERSION } from "../src/content";
import type { DomainEvent, GameState } from "../src/domain";
import type { PersistedRunV1 } from "../src/app/persistence";
import {
  beginTask4Day,
  completeTask4Day,
  scanToDecision,
  startTask4Run,
} from "./fixtures/task4-run";

function gameOf(state: AppState): GameState {
  if (!state.game) {
    throw new Error("game state is missing");
  }
  return state.game;
}

function persisted(state: AppState): PersistedRunV1 {
  return structuredClone(gameOf(state)) as PersistedRunV1;
}

function openAndRead(state: AppState, count = 3): AppState {
  let next = gameReducer(state, { type: "OPEN_NEWS" });
  const newsIds = gameOf(next)
    .newsSelections.filter((selection) => selection.day === gameOf(next).day)
    .map((selection) => selection.newsId);
  newsIds.slice(0, count).forEach((newsId) => {
    next = gameReducer(next, { type: "READ_NEWS", newsId });
  });
  return next;
}

function reachEnding(runId: string): AppState {
  const counts = [5, 6, 6, 6, 6] as const;
  let state = startTask4Run(runId);
  counts.forEach((count) => {
    state = beginTask4Day(state);
    state = completeTask4Day(state, Array.from({ length: count }, () => "sell"));
    state = openAndRead(state);
    state = gameReducer(state, { type: "ADVANCE_DAY" });
  });
  return state;
}

function mutateRun(state: AppState, mutate: (run: PersistedRunV1) => void): PersistedRunV1 {
  const run = persisted(state);
  mutate(run);
  return run;
}

describe("T6-B persistence controller", () => {
  it("accepts and restores the initial briefing run", () => {
    const started = startTask4Run("resume-briefing");
    const run = persisted(started);

    expect(validateRunForResume(run)).toBe(true);
    const restored = restoreAppStateFromRun(run);
    expect(restored?.view).toBe("briefing");
    expect(restored?.queue).toBeNull();
    expect(restored?.encounterIndex).toBe(0);
  });

  it("RESTORE_RUN stays on title and deep-clones durable state", () => {
    const source = beginTask4Day(startTask4Run("restore-title"));
    const run = persisted(source);
    const before = structuredClone(run);
    const restored = gameReducer(initialAppState, { type: "RESTORE_RUN", run });

    expect(restored.view).toBe("title");
    expect(restored.queue).toBeNull();
    expect(restored.result).toBeNull();
    expect(restored.openNewsId).toBeNull();
    expect(restored.game).not.toBe(run);
    expect(restored.game?.resolvedQueue).not.toBe(run.resolvedQueue);
    expect(restored.game?.eventLog).not.toBe(run.eventLog);
    expect(run).toEqual(before);

    if (!restored.game) {
      throw new Error("RESTORE_RUN did not retain the durable game");
    }
    restored.game.resolvedQueue.push("tamper");
    expect(run.resolvedQueue).not.toContain("tamper");
  });

  it("CONTINUE_RUN reconstructs encounter intro, scan, and decision phases", () => {
    const states = [
      beginTask4Day(startTask4Run("continue-intro")),
      scanToDecision(beginTask4Day(startTask4Run("continue-scan"))),
    ];
    const decisionGame = gameOf(states[1]);
    if (decisionGame.phase.kind !== "encounter") {
      throw new Error("decision phase fixture is missing");
    }
    states.push({
      ...states[1],
      game: {
        ...decisionGame,
        phase: {
          kind: "encounter",
          subPhase: "decision",
          encounterId: decisionGame.phase.encounterId,
          slotId: decisionGame.phase.slotId,
        },
      },
    });

    for (const state of states) {
      const title = gameReducer(
        { ...state, view: "title", queue: null, result: null, openNewsId: null },
        { type: "CONTINUE_RUN" },
      );
      expect(title.view).toBe("encounter");
      expect(title.queue).toBeNull();
      expect(title.encounterIndex).toBe(0);
      expect(title.result).toBeNull();
    }
  });

  it("restores an encounter result and NEXT_ENCOUNTER uses durable queue", () => {
    const resultState = scanToDecision(beginTask4Day(startTask4Run("continue-result")));
    const resolved = gameReducer(resultState, { type: "SELL" });
    const title = gameReducer(
      { ...resolved, view: "title", queue: null, result: null, openNewsId: null },
      { type: "CONTINUE_RUN" },
    );

    expect(title.view).toBe("encounter");
    expect(title.result?.eventId).toBe(gameOf(resolved).eventLog[0].id);
    expect(gameReducer(title, { type: "NEXT_ENCOUNTER" }).encounterIndex).toBe(1);
  });

  it("continues from shiftSummary without selecting news again", () => {
    const shiftSummary = completeTask4Day(
      beginTask4Day(startTask4Run("continue-shift")),
    );
    const continued = gameReducer(
      { ...shiftSummary, view: "title", queue: null },
      { type: "CONTINUE_RUN" },
    );

    expect(continued.view).toBe("shiftSummary");
    expect(continued.game?.newsSelections).toHaveLength(0);
    expect(continued.queue).toBeNull();
  });

  it("restores news with a partial read set and committed selections", () => {
    const news = openAndRead(
      completeTask4Day(beginTask4Day(startTask4Run("continue-news"))),
      1,
    );
    const selections = gameOf(news).newsSelections;
    const title = gameReducer(
      { ...news, view: "title", queue: null, openNewsId: "should-clear" },
      { type: "CONTINUE_RUN" },
    );

    expect(title.view).toBe("news");
    expect(title.openNewsId).toBeNull();
    expect(title.game?.newsSelections).toEqual(selections);
    expect(title.game?.readNews).toHaveLength(1);
    expect(gameReducer(title, { type: "OPEN_NEWS" })).toBe(title);
  });

  it("restores both ending and runSummary phases", () => {
    const ending = reachEnding("continue-ending");
    const endingTitle = gameReducer(
      { ...ending, view: "title", queue: null },
      { type: "CONTINUE_RUN" },
    );
    const summary = gameReducer(ending, { type: "OPEN_RUN_SUMMARY" });
    const summaryTitle = gameReducer(
      { ...summary, view: "title", queue: null },
      { type: "CONTINUE_RUN" },
    );

    expect(endingTitle.view).toBe("ending");
    expect(summaryTitle.view).toBe("runSummary");
    expect(endingTitle.game?.eventLog).toEqual(summaryTitle.game?.eventLog);
  });

  it("rejects wrong content version, references, duplicate durable IDs, and malformed queues", () => {
    const valid = beginTask4Day(startTask4Run("invalid-general"));
    const invalidRuns: PersistedRunV1[] = [
      mutateRun(valid, (run) => { run.contentVersion = "old-content"; }),
      mutateRun(valid, (run) => { run.customerStates.unknown_customer = "fed"; }),
      mutateRun(valid, (run) => {
        run.flags.push("duplicate");
        run.flags.push("duplicate");
      }),
      mutateRun(valid, (run) => { run.resolvedQueue[1] = run.resolvedQueue[0]; }),
      mutateRun(valid, (run) => { run.resolvedQueue[0] = "missing-encounter"; }),
      mutateRun(valid, (run) => {
        if (run.phase.kind === "encounter") {
          run.phase.slotId = "wrong-slot";
        }
      }),
    ];

    invalidRuns.forEach((run) => {
      expect(validateRunForResume(run)).toBe(false);
      expect(gameReducer(initialAppState, { type: "RESTORE_RUN", run })).toBe(initialAppState);
    });
  });

  it("rejects malformed decision event data, chronology, and event types", () => {
    const valid = gameReducer(
      scanToDecision(beginTask4Day(startTask4Run("invalid-events"))),
      { type: "SELL" },
    );
    const invalidRuns = [
      mutateRun(valid, (run) => { run.eventLog.push({ ...run.eventLog[0] } as DomainEvent); }),
      mutateRun(valid, (run) => {
        run.eventLog[0].type = "unknown.event";
      }),
      mutateRun(valid, (run) => {
        run.eventLog[0].data.outcomeId = "not-authored";
      }),
      mutateRun(valid, (run) => {
        run.eventLog[0].data.customerId = "wrong-customer";
      }),
    ];

    invalidRuns.forEach((run) => expect(validateRunForResume(run)).toBe(false));
  });

  it("rejects invalid news chronology and unselected reads", () => {
    const validNews = openAndRead(
      completeTask4Day(beginTask4Day(startTask4Run("invalid-news"))),
      1,
    );
    const invalidRuns = [
      mutateRun(validNews, (run) => { run.readNews.push("not-selected"); }),
      mutateRun(validNews, (run) => { run.newsSelections[0].day = 2; }),
      mutateRun(validNews, (run) => { run.newsSelections[1].slot = run.newsSelections[0].slot; }),
      mutateRun(validNews, (run) => {
        run.newsSelections[0].newsId = run.newsSelections[1].newsId;
      }),
    ];

    invalidRuns.forEach((run) => expect(validateRunForResume(run)).toBe(false));
  });

  it("rejects tampered ending data and phase mismatches", () => {
    const ending = reachEnding("invalid-ending");
    const invalidRuns = [
      mutateRun(ending, (run) => {
        const event = run.eventLog.at(-1);
        if (event) {
          event.data.title = "tampered";
        }
      }),
      mutateRun(ending, (run) => {
        if (run.phase.kind === "ending") {
          run.phase.endingId = "inventory_mixup";
        }
      }),
      mutateRun(ending, (run) => {
        run.eventLog[run.eventLog.length - 1].data.convergenceAxis = "undead";
      }),
    ];

    invalidRuns.forEach((run) => expect(validateRunForResume(run)).toBe(false));
  });

  it("rejects every action gate with the same object and keeps RESET navigation-only", () => {
    expect(gameReducer(initialAppState, { type: "RESET_TO_TITLE" })).toBe(initialAppState);
    const initialRestore = gameReducer(initialAppState, {
      type: "CONTINUE_RUN",
    });
    expect(initialRestore).toBe(initialAppState);
    expect(
      gameReducer(initialAppState, {
        type: "RESTORE_RUN",
        run: mutateRun(beginTask4Day(startTask4Run("gated")), (run) => {
          run.contentVersion = "wrong";
        }),
      }),
    ).toBe(initialAppState);

    const active = beginTask4Day(startTask4Run("reset-preserve"));
    const reset = gameReducer(active, { type: "RESET_TO_TITLE" });
    expect(reset).not.toBe(active);
    expect(reset.game).toBe(active.game);
    expect(reset.view).toBe("title");
    expect(reset.queue).toBeNull();
    expect(reset.result).toBeNull();
    expect(reset.openNewsId).toBeNull();
    expect(gameReducer(reset, { type: "RESET_TO_TITLE" })).toBe(reset);
    expect(gameReducer(active, { type: "CONTINUE_RUN" })).toBe(active);
  });

  it("allows START_NEW_RUN only from title, validates runNumber, and replaces the retained run", () => {
    const active = beginTask4Day(startTask4Run("start-gate"));
    const rejected = gameReducer(active, {
      type: "START_NEW_RUN",
      runId: "replacement",
      contentVersion: TASK5_CONTENT_VERSION,
      runNumber: 4,
    });
    expect(rejected).toBe(active);

    const title = gameReducer(active, { type: "RESET_TO_TITLE" });
    expect(
      gameReducer(title, {
        type: "START_NEW_RUN",
        runId: "   ",
        contentVersion: TASK5_CONTENT_VERSION,
      }),
    ).toBe(title);
    expect(
      gameReducer(title, {
        type: "START_NEW_RUN",
        runId: "replacement-invalid-number",
        contentVersion: TASK5_CONTENT_VERSION,
        runNumber: 0,
      }),
    ).toBe(title);

    const replacement = gameReducer(title, {
      type: "START_NEW_RUN",
      runId: "replacement",
      contentVersion: TASK5_CONTENT_VERSION,
      runNumber: 4,
    });
    expect(replacement.view).toBe("briefing");
    expect(gameOf(replacement).runId).toBe("replacement");
    expect(gameOf(replacement).runNumber).toBe(4);
  });

  it("does not use clock, randomness, crypto, or browser persistence in the controller", () => {
    const source = readFileSync("src/app/gameController.ts", "utf8");
    expect(source).not.toMatch(/\bDate\b|Math\.random|crypto|localStorage|StorageLike/);
  });

  it("keeps the five golden-route controller contract green", () => {
    const source = readFileSync("tests/task5-controller-golden-routes.test.ts", "utf8");
    expect(source).toContain("TASK5_GOLDEN_ROUTES");
    expect(TASK5_CONTENT_VERSION).toBe("task5-authored-v1");
  });
});
