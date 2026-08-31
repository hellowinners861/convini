import { describe, expect, it } from "vitest";
import {
  appendEncounterDecisionEvent,
  createEncounterDecisionEvent,
  ENCOUNTER_DECISION_EVENT_TYPE,
  ENDING_RESOLVED_EVENT_TYPE,
  gameReducer,
  initialAppState,
  reconstructEncounterResult,
  reconstructEndingResult,
  TASK4_DEFAULT_CONTENT_VERSION,
  TASK4_DEFAULT_RUN_ID,
  TASK5_DEFAULT_CONTENT_VERSION,
  TASK5_DEFAULT_RUN_ID,
  type AppState,
} from "../src/app/gameController";
import {
  getTask4Customer,
  getTask4DayPlan,
  TASK4_CONTENT,
  TASK5_CONTENT,
  TASK5_CONTENT_VERSION,
} from "../src/content";
import {
  DomainEventSchema,
  WORLD_AXES,
  type DomainEvent,
  type Effect,
  type GameState,
  type NumericEffectTarget,
} from "../src/domain";
import { orderDay5AnomalySlots } from "../src/engine";
import {
  advanceToNextDay,
  beginTask4Day,
  completeTask4Day,
  currentTask4Encounter,
  decideCurrentEncounter,
  dayEncounterCounts,
  nextEncounter,
  reachDay5Briefing,
  scanToDecision,
  startTask4Run,
} from "./fixtures/task4-run";

function gameOf(state: AppState): GameState {
  if (!state.game) {
    throw new Error("game state is missing");
  }
  return state.game;
}

function decisionEvents(game: GameState) {
  return game.eventLog.filter((event) => event.type === ENCOUNTER_DECISION_EVENT_TYPE);
}

function effectAmount(effects: readonly Effect[], target: NumericEffectTarget): number {
  return effects.reduce(
    (total, effect) =>
      effect.kind === "add" && effect.target === target ? total + effect.amount : total,
    0,
  );
}

function prepareDay5Final(runId: string): AppState {
  let state = reachDay5Briefing();
  state = { ...state, game: state.game ? { ...state.game, runId } : state.game };
  state = beginTask4Day(state);
  for (let index = 0; index < 5; index += 1) {
    state = decideCurrentEncounter(state, "sell");
    state = nextEncounter(state);
  }
  return state;
}

function resolveTask5RunToEnding(runId: string): AppState {
  const counts = [5, 6, 6, 6, 6] as const;
  let state = startTask4Run(runId);
  counts.forEach((count) => {
    state = beginTask4Day(state);
    state = completeTask4Day(state, Array.from({ length: count }, () => "sell"));
    state = gameReducer(state, { type: "OPEN_NEWS" });
    const newsIds = gameOf(state).newsSelections
      .filter((selection) => selection.day === gameOf(state).day)
      .map((selection) => selection.newsId);
    newsIds.forEach((newsId) => {
      state = gameReducer(state, { type: "READ_NEWS", newsId });
    });
    state = gameReducer(state, { type: "ADVANCE_DAY" });
  });
  return state;
}

function endingEvent(game: GameState): DomainEvent {
  const event = game.eventLog.find((candidate) => candidate.type === ENDING_RESOLVED_EVENT_TYPE);
  if (!event) {
    throw new Error("ending event is missing");
  }
  return event;
}

function finalConvergenceEvent(game: GameState): DomainEvent {
  const event = game.eventLog.find(
    (candidate) =>
      candidate.type === ENCOUNTER_DECISION_EVENT_TYPE &&
      candidate.day === 5 &&
      Object.prototype.hasOwnProperty.call(candidate.data, "convergenceAxis"),
  );
  if (!event) {
    throw new Error("final convergence event is missing");
  }
  return event;
}

function mutateEndingState(
  state: AppState,
  mutate: (game: GameState) => void,
): AppState {
  const next = structuredClone(state);
  mutate(gameOf(next));
  return next;
}

describe("Task 4 game controller", () => {
  it("starts only the validated Task 5 run and resolves each day once", () => {
    expect(gameReducer(initialAppState, { type: "BEGIN_DAY" })).toBe(initialAppState);

    const mismatch = gameReducer(initialAppState, {
      type: "START_NEW_RUN",
      runId: TASK4_DEFAULT_RUN_ID,
      contentVersion: "not-task5",
    });
    expect(mismatch).toBe(initialAppState);

    const started = startTask4Run("controller-start");
    expect(started.view).toBe("briefing");
    expect(gameOf(started).contentVersion).toBe(TASK5_CONTENT_VERSION);
    expect(gameOf(started).runId).toBe("controller-start");
    expect(gameOf(started).phase).toEqual({ kind: "briefing" });

    const begun = beginTask4Day(started);
    expect(begun.view).toBe("encounter");
    expect(gameOf(begun).revenue.dailyTarget).toBe(getTask4DayPlan(1).revenueTarget);
    expect(begun.queue?.snapshot.revenue.dailyTarget).toBe(
      getTask4DayPlan(1).revenueTarget,
    );
    expect(begun.queue?.encounterIds).toHaveLength(5);
    expect(gameOf(begun).resolvedQueue).toEqual(begun.queue?.encounterIds);
    expect(gameReducer(begun, { type: "BEGIN_DAY" })).toBe(begun);

    const midRunStart = gameReducer(begun, {
      type: "START_NEW_RUN",
      runId: TASK4_DEFAULT_RUN_ID,
      contentVersion: TASK4_DEFAULT_CONTENT_VERSION,
    });
    expect(midRunStart).toBe(begun);

    const titleWithGame: AppState = { ...started, view: "title" };
    const replaced = gameReducer(titleWithGame, {
      type: "START_NEW_RUN",
      runId: TASK4_DEFAULT_RUN_ID,
      contentVersion: TASK4_DEFAULT_CONTENT_VERSION,
    });
    expect(replaced).not.toBe(titleWithGame);
    expect(replaced.view).toBe("briefing");
    expect(gameOf(replaced).runId).toBe(TASK4_DEFAULT_RUN_ID);
    const reset = gameReducer(begun, { type: "RESET_TO_TITLE" });
    expect(reset.view).toBe("title");
    expect(reset.game).toBe(begun.game);
    expect(reset.queue).toBeNull();
    expect(TASK4_DEFAULT_RUN_ID).toBe(TASK5_DEFAULT_RUN_ID);
    expect(TASK4_DEFAULT_CONTENT_VERSION).toBe(TASK5_DEFAULT_CONTENT_VERSION);
  });

  it("keeps scan, decision, result and recommendation gates exact", () => {
    const started = startTask4Run();
    const begun = beginTask4Day(started);

    expect(gameReducer(begun, { type: "SELL" })).toBe(begun);
    expect(gameReducer(begun, { type: "OPEN_DECISION" })).toBe(begun);

    const scanned = gameReducer(begun, { type: "SCAN_ENCOUNTER" });
    expect(gameReducer(scanned, { type: "SELL" })).toBe(scanned);
    const decision = gameReducer(scanned, { type: "OPEN_DECISION" });
    expect(gameOf(decision).phase).toMatchObject({ kind: "encounter", subPhase: "decision" });

    const invalidRecommendation = gameReducer(decision, {
      type: "RECOMMEND",
      recommendedItemId: "not-an-authored-option",
    });
    expect(invalidRecommendation).toBe(decision);

    const option = currentTask4Encounter(decision).recommendationOptions[0];
    const sourceSnapshot = structuredClone(decision);
    const resolved = gameReducer(decision, {
      type: "RECOMMEND",
      recommendedItemId: option.itemId,
    });
    expect(decision).toEqual(sourceSnapshot);
    expect(gameOf(resolved).phase).toMatchObject({ kind: "encounter", subPhase: "result" });
    expect(resolved.result).toMatchObject({
      encounterId: currentTask4Encounter(decision).id,
      decision: "recommend",
      recommendedItemId: option.itemId,
    });
    expect(gameReducer(resolved, { type: "SELL" })).toBe(resolved);
    expect(
      gameReducer(resolved, { type: "RECOMMEND", recommendedItemId: option.itemId }),
    ).toBe(resolved);
    expect(gameReducer(resolved, { type: "NEXT_ENCOUNTER" }).encounterIndex).toBe(1);
    expect(gameReducer(decision, { type: "NEXT_ENCOUNTER" })).toBe(decision);
  });

  it("runs all five days continuously through exactly three news articles per day", () => {
    expect(dayEncounterCounts()).toEqual({ 1: 5, 2: 6, 3: 6, 4: 6, 5: 6 });

    const counts = [5, 6, 6, 6, 6] as const;
    let state = startTask4Run("continuous-run");
    let expectedEventCount = 0;

    counts.forEach((count, dayOffset) => {
      const day = (dayOffset + 1) as 1 | 2 | 3 | 4 | 5;
      state = beginTask4Day(state);
      expect(state.view).toBe("encounter");
      expect(gameOf(state).day).toBe(day);
      expect(gameOf(state).resolvedQueue).toHaveLength(count);
      const fixedQueue = [...gameOf(state).resolvedQueue];
      const queueObject = state.queue;

      state = completeTask4Day(state);
      expectedEventCount += count;
      expect(state.view).toBe("shiftSummary");
      expect(gameOf(state).resolvedQueue).toEqual(fixedQueue);
      expect(state.queue).toBe(queueObject);
      expect(decisionEvents(gameOf(state))).toHaveLength(expectedEventCount);

      const opened = gameReducer(state, { type: "OPEN_NEWS" });
      expect(opened.view).toBe("news");
      expect(opened.game?.newsSelections.filter((selection) => selection.day === day)).toHaveLength(3);
      expect(gameReducer(opened, { type: "OPEN_NEWS" })).toBe(opened);
      expect(gameReducer(opened, { type: "ADVANCE_DAY" })).toBe(opened);

      const newsIds = opened.game?.newsSelections
        .filter((selection) => selection.day === day)
        .map((selection) => selection.newsId) ?? [];
      let read = opened;
      newsIds.slice(0, 2).forEach((newsId) => {
        read = gameReducer(read, { type: "READ_NEWS", newsId });
      });
      expect(gameReducer(read, { type: "ADVANCE_DAY" })).toBe(read);
      read = gameReducer(read, { type: "READ_NEWS", newsId: newsIds[2] });
      expect(read.game?.readNews).toHaveLength(day * 3);
      const reread = gameReducer(read, { type: "READ_NEWS", newsId: newsIds[0] });
      expect(reread).toBe(read);
      state = advanceToNextDay(read);

      if (day < 5) {
        expect(state.view).toBe("briefing");
        expect(gameOf(state).day).toBe(day + 1);
        expect(gameOf(state).phase).toEqual({ kind: "briefing" });
        expect(gameOf(state).resolvedQueue).toEqual([]);
        expect(gameOf(state).revenue.today).toBe(0);
        expect(gameOf(state).revenue.dailyTarget).toBe(
          getTask4DayPlan((day + 1) as 2 | 3 | 4 | 5).revenueTarget,
        );
      } else {
        expect(state.view).toBe("ending");
        expect(gameOf(state).phase.kind).toBe("ending");
      }
    });

    expect(state.view).toBe("ending");
    expect(gameOf(state).day).toBe(5);
    expect(decisionEvents(gameOf(state))).toHaveLength(29);
    expect(gameOf(state).eventLog.filter((event) => event.type === ENDING_RESOLVED_EVENT_TYPE)).toHaveLength(1);

    const endingResult = reconstructEndingResult(gameOf(state));
    expect(endingResult).not.toBeNull();
    const summary = gameReducer(state, { type: "OPEN_RUN_SUMMARY" });
    expect(summary.view).toBe("runSummary");
    expect(gameOf(summary).phase).toEqual({ kind: "runSummary" });
    expect(reconstructEndingResult(gameOf(summary))).toEqual(endingResult);
    expect(gameReducer(summary, { type: "OPEN_RUN_SUMMARY" })).toBe(summary);
    expect(gameReducer(summary, { type: "ADVANCE_DAY" })).toBe(summary);
    const reset = gameReducer(summary, { type: "RESET_TO_TITLE" });
    expect(reset.view).toBe("title");
    expect(reset.game).toBe(summary.game);
    expect(reset.queue).toBeNull();
    expect(reset.encounterIndex).toBe(0);
  });

  it("uses the global recommendation pairs and reconstructs durable results", () => {
    let state = beginTask4Day(startTask4Run("recommendation-run"));
    for (let index = 0; index < 3; index += 1) {
      state = decideCurrentEncounter(state, "sell");
      state = nextEncounter(state);
    }

    const decision = scanToDecision(state);
    const hayakawa = currentTask4Encounter(decision);
    expect(hayakawa.customerId).toBe("hayakawa");
    const mask = hayakawa.recommendationOptions.find((option) => option.itemId === "mask");
    if (!mask) {
      throw new Error("Hayakawa mask option is missing");
    }

    expect(
      gameReducer(decision, {
        type: "RECOMMEND",
        recommendedItemId: "not-a-real-item",
      }),
    ).toBe(decision);

    const resolved = gameReducer(decision, {
      type: "RECOMMEND",
      recommendedItemId: mask.itemId,
    });
    const event = gameOf(resolved).eventLog.at(-1);
    if (!event || !resolved.result) {
      throw new Error("recommendation decision event is missing");
    }
    expect(event.data).toMatchObject({
      slotId: "slot_d1_04",
      encounterId: hayakawa.id,
      customerId: "hayakawa",
      requestedItemId: hayakawa.requestedItemId,
      decision: "recommend",
      recommendedItemId: "mask",
      outcomeId: "pair_hayakawa_mask-outcome",
    });
    expect(resolved.result.outcomeId).toBe("pair_hayakawa_mask-outcome");
    expect(() => DomainEventSchema.parse(event)).not.toThrow();

    const reconstructed = reconstructEncounterResult(
      gameOf(resolved),
      hayakawa.id,
      "slot_d1_04",
    );
    expect(reconstructed).toEqual(resolved.result);
    const reloaded: AppState = { ...resolved, result: null };
    expect(reconstructEncounterResult(gameOf(reloaded), hayakawa.id, "slot_d1_04")).toEqual(
      resolved.result,
    );
    expect(gameReducer(reloaded, { type: "NEXT_ENCOUNTER" }).encounterIndex).toBe(4);
  });

  it("keeps Day 5 weak-to-strong ordering frozen and maps reordered slots canonically", () => {
    let state = beginTask4Day(reachDay5Briefing());
    const game = gameOf(state);
    const plan = getTask4DayPlan(5);
    const queue = state.queue;
    if (!queue || !plan.day5AnomalyOrder) {
      throw new Error("Day 5 queue or ordering metadata is missing");
    }

    const anomalySlotIds = new Set(plan.day5AnomalyOrder.map((entry) => entry.slotId));
    const orderedAnomalies = orderDay5AnomalySlots(queue.snapshot, plan.day5AnomalyOrder);
    let anomalyIndex = 0;
    const expectedSlots = plan.slots.map((slot) => {
      if (!anomalySlotIds.has(slot.id)) {
        return slot;
      }
      const ordered = orderedAnomalies[anomalyIndex];
      anomalyIndex += 1;
      return plan.slots.find((candidate) => candidate.id === ordered.slotId) ?? slot;
    });
    const expectedQueue = expectedSlots.map((slot) => slot.fallbackEncounterId);
    expect(queue.encounterIds).toEqual(expectedQueue);

    const dayStartWorld = { ...queue.snapshot.world };
    const fixedQueue = [...game.resolvedQueue];
    const fixedQueueObject = state.queue;
    for (let index = 0; index < 5; index += 1) {
      expect(gameOf(state).phase).toMatchObject({
        kind: "encounter",
        encounterId: fixedQueue[index],
        slotId: expectedSlots[index].id,
      });
      state = decideCurrentEncounter(state, "sell");
      const event = gameOf(state).eventLog.at(-1);
      expect(event?.data.convergenceAxis).toBeUndefined();
      expect(event?.data.convergenceRefused).toBeUndefined();
      state = nextEncounter(state);
      expect(state.queue).toBe(fixedQueueObject);
      expect(gameOf(state).resolvedQueue).toEqual(fixedQueue);
    }

    expect(gameOf(state).phase).toMatchObject({
      kind: "encounter",
      encounterId: fixedQueue[5],
      slotId: expectedSlots[5].id,
    });
    expect(gameOf(state).world).not.toEqual(dayStartWorld);
    expect(queue.snapshot.world).toEqual(dayStartWorld);
    expect(gameOf(state).resolvedQueue).toEqual(fixedQueue);
  });

  it("applies exactly one final sell convergence bonus to the actual customer's axis", () => {
    const state = prepareDay5Final("final-sell-run");
    const encounter = currentTask4Encounter(state);
    const customer = getTask4Customer(encounter.customerId);
    if (!customer.axis) {
      throw new Error("final customer has no canonical world axis");
    }

    const before = gameOf(state);
    const beforeSnapshot = structuredClone(state);
    const authoredAxisDelta = effectAmount(encounter.outcomes.sell.effects, `world.${customer.axis}`);
    const resolved = decideCurrentEncounter(state, "sell");
    expect(state).toEqual(beforeSnapshot);
    expect(gameOf(resolved).world[customer.axis] - before.world[customer.axis]).toBe(
      authoredAxisDelta + TASK4_CONTENT.day5Convergence.successfulSaleAxisBonus,
    );

    const event = gameOf(resolved).eventLog.at(-1);
    if (!event) {
      throw new Error("final sell event is missing");
    }
    expect(event.data).toMatchObject({
      encounterId: encounter.id,
      customerId: encounter.customerId,
      convergenceAxis: customer.axis,
    });
    expect(event.data.convergenceRefused).toBeUndefined();
    expect(event.data.outcomeId).toBe(encounter.outcomes.sell.id);
    expect(() => DomainEventSchema.parse(event)).not.toThrow();
    expect(gameReducer(resolved, { type: "SELL" })).toBe(resolved);
  });

  it("applies exactly one final refusal convergence delta and refusal flag", () => {
    const state = prepareDay5Final("final-refusal-run");
    const encounter = currentTask4Encounter(state);
    const before = gameOf(state);
    const authoredStabilityDelta = effectAmount(encounter.outcomes.refuse.effects, "stability");
    const resolved = decideCurrentEncounter(state, "refuse");

    expect(gameOf(resolved).stability - before.stability).toBe(
      authoredStabilityDelta + TASK4_CONTENT.day5Convergence.refusalStabilityDelta,
    );
    expect(gameOf(resolved).flags.filter((flag) => flag === "convergence_refused")).toHaveLength(1);

    const event = gameOf(resolved).eventLog.at(-1);
    if (!event) {
      throw new Error("final refusal event is missing");
    }
    expect(event.data).toMatchObject({
      encounterId: encounter.id,
      customerId: encounter.customerId,
      convergenceRefused: true,
    });
    expect(event.data.convergenceAxis).toBeUndefined();
    expect(event.data.outcomeId).toBe(encounter.outcomes.refuse.id);
    expect(() => DomainEventSchema.parse(event)).not.toThrow();
  });

  it("appends decision events immutably and preserves deterministic IDs", () => {
    const state = beginTask4Day(startTask4Run("event-run"));
    const game = gameOf(state);
    if (game.phase.kind !== "encounter") {
      throw new Error("encounter phase is missing");
    }
    const encounter = currentTask4Encounter(state);
    const event = createEncounterDecisionEvent(
      game,
      game.phase,
      encounter,
      "sell",
      encounter.outcomes.sell,
    );
    expect(() => DomainEventSchema.parse(event)).not.toThrow();
    const appended = appendEncounterDecisionEvent(game, event);
    expect(game.eventLog).toEqual([]);
    expect(appended.eventLog).toEqual([event]);
    expect(appendEncounterDecisionEvent(appended, event)).toBe(appended);
    expect(event.id).toBe(
      `${game.runId}:day-1:slot-slot_d1_01:encounter-d1_taxi_baseline:decision`,
    );
  });
});

describe("Task 5 strict ending controller guards", () => {
  it("rejects run summary before ending and enforces canonical news reads", () => {
    let state = beginTask4Day(startTask4Run("news-gates"));
    state = completeTask4Day(state);
    expect(gameReducer(state, { type: "OPEN_RUN_SUMMARY" })).toBe(state);

    const opened = gameReducer(state, { type: "OPEN_NEWS" });
    const selectedIds = gameOf(opened).newsSelections
      .filter((selection) => selection.day === 1)
      .map((selection) => selection.newsId);
    const unselected = TASK5_CONTENT.news.find(
      (article) => article.day === 1 && !selectedIds.includes(article.id),
    );
    if (!unselected) {
      throw new Error("an unselected day 1 article is missing");
    }

    expect(gameReducer(opened, { type: "READ_NEWS", newsId: "unknown-news" })).toBe(opened);
    expect(gameReducer(opened, { type: "READ_NEWS", newsId: unselected.id })).toBe(opened);

    const read = gameReducer(opened, { type: "READ_NEWS", newsId: selectedIds[0] });
    expect(gameReducer(read, { type: "READ_NEWS", newsId: selectedIds[0] })).toBe(read);
    expect(gameReducer(read, { type: "ADVANCE_DAY" })).toBe(read);
  });

  it("preserves every durable field while advancing from news to the next briefing", () => {
    let state = beginTask4Day(startTask4Run("advance-preservation"));
    state = completeTask4Day(state);
    state = gameReducer(state, { type: "OPEN_NEWS" });
    const selectedIds = gameOf(state).newsSelections
      .filter((selection) => selection.day === 1)
      .map((selection) => selection.newsId);
    selectedIds.forEach((newsId) => {
      state = gameReducer(state, { type: "READ_NEWS", newsId });
    });

    const before = gameOf(state);
    const advanced = gameReducer(state, { type: "ADVANCE_DAY" });
    const after = gameOf(advanced);
    expect(after.revenue.total).toBe(before.revenue.total);
    expect(after.world).toEqual(before.world);
    expect(after.stability).toBe(before.stability);
    expect(after.awareness).toBe(before.awareness);
    expect(after.managerTrust).toBe(before.managerTrust);
    expect(after.customerStates).toEqual(before.customerStates);
    expect(after.flags).toEqual(before.flags);
    expect(after.seenNews).toEqual(before.seenNews);
    expect(after.readNews).toEqual(before.readNews);
    expect(after.newsSelections).toEqual(before.newsSelections);
    expect(after.eventLog).toEqual(before.eventLog);
    expect(after.day).toBe(2);
    expect(after.phase).toEqual({ kind: "briefing" });
    expect(after.resolvedQueue).toEqual([]);
    expect(after.revenue.today).toBe(0);
    expect(after.revenue.dailyTarget).toBe(getTask4DayPlan(2).revenueTarget);
  });

  it("reconstructs only the deterministic ending and rejects every tampering route", () => {
    const valid = resolveTask5RunToEnding("strict-ending");
    const validGame = gameOf(valid);
    const validResult = reconstructEndingResult(validGame);
    if (!validResult) {
      throw new Error("valid ending did not reconstruct");
    }
    expect(validGame.eventLog.filter((event) => event.type === ENDING_RESOLVED_EVENT_TYPE)).toHaveLength(1);

    const otherRule = TASK5_CONTENT.endingRecords
      .flatMap((record) => record.rules)
      .find((rule) => rule.id !== validResult.endingId);
    if (!otherRule) {
      throw new Error("a second canonical ending rule is missing");
    }
    const otherAxis = WORLD_AXES.find((axis) => axis !== validResult.convergenceAxis);
    if (!otherAxis) {
      throw new Error("a second world axis is missing");
    }

    const malformedStates: Array<[string, AppState]> = [
      [
        "null runtime event entry",
        mutateEndingState(valid, (game) => {
          game.eventLog.push(null as unknown as DomainEvent);
        }),
      ],
      [
        "array runtime event entry",
        mutateEndingState(valid, (game) => {
          game.eventLog.push([] as unknown as DomainEvent);
        }),
      ],
      [
        "duplicate ending event",
        mutateEndingState(valid, (game) => {
          const event = endingEvent(game);
          game.eventLog.push(structuredClone(event));
        }),
      ],
      [
        "deterministic id collision",
        mutateEndingState(valid, (game) => {
          const event = endingEvent(game);
          game.eventLog.push({ ...structuredClone(event), id: event.id, type: "collision" });
        }),
      ],
      [
        "extra ending data key",
        mutateEndingState(valid, (game) => {
          const data = endingEvent(game).data as Record<string, unknown>;
          data.extra = true;
        }),
      ],
      [
        "missing ending data key",
        mutateEndingState(valid, (game) => {
          const data = endingEvent(game).data as Record<string, unknown>;
          delete data.title;
        }),
      ],
      [
        "null ending data",
        mutateEndingState(valid, (game) => {
          endingEvent(game).data = null as unknown as DomainEvent["data"];
        }),
      ],
      [
        "array ending data",
        mutateEndingState(valid, (game) => {
          endingEvent(game).data = [] as unknown as DomainEvent["data"];
        }),
      ],
      [
        "bad ending title",
        mutateEndingState(valid, (game) => {
          const data = endingEvent(game).data as Record<string, unknown>;
          data.title = `${String(data.title)} corrupted`;
        }),
      ],
      [
        "bad ending priority",
        mutateEndingState(valid, (game) => {
          const data = endingEvent(game).data as Record<string, unknown>;
          data.priority = Number(data.priority) + 1;
        }),
      ],
      [
        "bad ending fallback",
        mutateEndingState(valid, (game) => {
          const data = endingEvent(game).data as Record<string, unknown>;
          data.isFallback = !data.isFallback;
        }),
      ],
      [
        "wrong canonical ending with matching phase",
        mutateEndingState(valid, (game) => {
          const event = endingEvent(game);
          event.data = {
            endingId: otherRule.id,
            title: otherRule.title,
            priority: otherRule.priority,
            isFallback: otherRule.isFallback === true,
            ...(validResult.convergenceAxis
              ? { convergenceAxis: validResult.convergenceAxis }
              : {}),
          };
          game.phase = { kind: "ending", endingId: otherRule.id };
        }),
      ],
      [
        "wrong valid convergence axis",
        mutateEndingState(valid, (game) => {
          const data = endingEvent(game).data as Record<string, unknown>;
          data.convergenceAxis = otherAxis;
        }),
      ],
      [
        "phase mismatch",
        mutateEndingState(valid, (game) => {
          game.phase = { kind: "ending", endingId: otherRule.id };
        }),
      ],
    ];

    for (const [label, malformed] of malformedStates) {
      expect(() => reconstructEndingResult(gameOf(malformed)), label).not.toThrow();
      expect(reconstructEndingResult(gameOf(malformed)), label).toBeNull();
      expect(gameReducer(malformed, { type: "OPEN_RUN_SUMMARY" }), label).toBe(malformed);
    }

    for (const [label, mutate] of [
      ["id", (event: DomainEvent) => { event.id = `${event.id}:tampered`; }],
      ["slot", (event: DomainEvent) => { event.data.slotId = "wrong-slot"; }],
      ["encounter", (event: DomainEvent) => { event.data.encounterId = "wrong-encounter"; }],
      ["customer", (event: DomainEvent) => { event.data.customerId = "wrong-customer"; }],
      ["axis", (event: DomainEvent) => { event.data.convergenceAxis = otherAxis; }],
    ] as const) {
      const tampered = mutateEndingState(valid, (game) => mutate(finalConvergenceEvent(game)));
      expect(() => reconstructEndingResult(gameOf(tampered)), `final ${label}`).not.toThrow();
      expect(reconstructEndingResult(gameOf(tampered)), `final ${label}`).toBeNull();
      expect(gameReducer(tampered, { type: "OPEN_RUN_SUMMARY" }), `final ${label}`).toBe(tampered);
    }

    const summary = gameReducer(valid, { type: "OPEN_RUN_SUMMARY" });
    expect(summary.view).toBe("runSummary");
    expect(reconstructEndingResult(gameOf(summary))).toEqual(validResult);
    expect(reconstructEndingResult(gameOf(summary))).toEqual(validResult);
    expect(gameReducer(valid, { type: "ADVANCE_DAY" })).toBe(valid);
    expect(gameReducer(summary, { type: "OPEN_RUN_SUMMARY" })).toBe(summary);
    expect(gameOf(valid).eventLog.filter((event) => event.type === ENDING_RESOLVED_EVENT_TYPE)).toHaveLength(1);
  });
});
