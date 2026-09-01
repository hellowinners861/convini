import {
  applyOutcome,
  canAdvanceAfterNews,
  commitNewsSelections,
  determineEnding,
  readNewsArticle,
  resolveEncounterQueue,
  resolveRecommendation,
  selectNewsForDay,
} from "../engine";
import {
  createInitialGameState,
  ENDING_IDS,
  NEWS_SLOTS,
  SCHEMA_VERSION,
  WORLD_AXES,
  type Day,
  type DomainEvent,
  type Effect,
  type EncounterSlot,
  type EndingId,
  type GamePhase,
  type GameState,
  type Outcome,
  type ResolvedEncounterQueue,
  type WorldAxis,
} from "../domain";
import {
  PersistedRunV1Schema,
  type PersistedGamePhase,
  type PersistedRunV1,
} from "./persistence/contracts";
import {
  getTask5Customer,
  getTask5DayPlan,
  getTask5Encounter,
  getTask5NewsArticle,
  TASK5_CONTENT,
  TASK5_CONTENT_VERSION,
  validateTask5Content,
  type AuthoredEncounter,
} from "../content";

export type AppView =
  | "title"
  | "briefing"
  | "encounter"
  | "shiftSummary"
  | "news"
  | "ending"
  | "runSummary";

export type Decision = "sell" | "refuse" | "recommend";
export type EncounterDecision = Decision;

export interface EncounterResultState {
  eventId: string;
  encounterId: string;
  decision: Decision;
  recommendedItemId?: string;
  outcomeId: string;
}

export interface EncounterDecisionEventMetadata {
  convergenceAxis?: WorldAxis;
  convergenceRefused?: boolean;
}

export const ENCOUNTER_DECISION_EVENT_TYPE = "encounter.decision";
export const ENDING_RESOLVED_EVENT_TYPE = "ending.resolved";

export interface EndingResultState {
  eventId: string;
  endingId: EndingId;
  title: string;
  priority: number;
  isFallback: boolean;
  convergenceAxis?: WorldAxis;
}

export interface AppState {
  view: AppView;
  game: GameState | null;
  queue: ResolvedEncounterQueue | null;
  encounterIndex: number;
  result: EncounterResultState | null;
  openNewsId: string | null;
}

export type AppAction =
  | { type: "START_NEW_RUN"; runId: string; contentVersion: string; runNumber?: number }
  | { type: "RESTORE_RUN"; run: PersistedRunV1 }
  | { type: "CONTINUE_RUN" }
  | { type: "BEGIN_DAY" }
  | { type: "SCAN_ENCOUNTER" }
  | { type: "SELL" }
  | { type: "REFUSE" }
  | { type: "RECOMMEND"; recommendedItemId: string }
  | { type: "NEXT_ENCOUNTER" }
  | { type: "OPEN_NEWS" }
  | { type: "READ_NEWS"; newsId: string }
  | { type: "ADVANCE_DAY" }
  | { type: "OPEN_RUN_SUMMARY" }
  | { type: "RESET_TO_TITLE" };

export const initialAppState: AppState = {
  view: "title",
  game: null,
  queue: null,
  encounterIndex: 0,
  result: null,
  openNewsId: null,
};

function rejected(state: AppState): AppState {
  return state;
}

function canonicalSlotId(day: Day, encounterId: string): string | undefined {
  try {
    return getTask5DayPlan(day).slots.find(
      (slot) =>
        slot.fallbackEncounterId === encounterId ||
        slot.candidates.some((candidate) => candidate.encounterId === encounterId),
    )?.id;
  } catch {
    return undefined;
  }
}

interface QueueSlotMapping {
  index: number;
  encounterId: string;
  slotId: string;
}

function slotAllowsEncounter(
  slot: EncounterSlot,
  encounterId: string,
): boolean {
  return (
    slot.fallbackEncounterId === encounterId ||
    slot.candidates.some((candidate) => candidate.encounterId === encounterId)
  );
}

/**
 * Matches a committed queue to authored slots without evaluating any current
 * conditions. The queue is durable history; only its one-to-one authored
 * witness is checked here.
 */
function mapCommittedQueueToSlots(
  day: Day,
  queue: readonly string[],
): QueueSlotMapping[] | null {
  try {
    const plan = getTask5DayPlan(day);
    if (queue.length !== plan.slots.length) {
      return null;
    }

    const queueIds = new Set(queue);
    if (queueIds.size !== queue.length) {
      return null;
    }

    const candidateSlotIndexes = queue.map((encounterId) =>
      plan.slots
        .map((slot, index) => (slotAllowsEncounter(slot, encounterId) ? index : -1))
        .filter((index) => index >= 0),
    );
    if (candidateSlotIndexes.some((indexes) => indexes.length === 0)) {
      return null;
    }

    const assignments: Array<number | undefined> = Array.from(
      { length: queue.length },
      () => undefined,
    );
    const usedSlotIndexes = new Set<number>();

    function assignSlots(assignedCount: number): boolean {
      if (assignedCount === queue.length) {
        return true;
      }

      let nextPosition = -1;
      let nextCandidates: number[] = [];
      for (let position = 0; position < queue.length; position += 1) {
        if (assignments[position] !== undefined) {
          continue;
        }
        const available = candidateSlotIndexes[position].filter(
          (slotIndex) => !usedSlotIndexes.has(slotIndex),
        );
        if (nextPosition === -1 || available.length < nextCandidates.length) {
          nextPosition = position;
          nextCandidates = available;
        }
      }

      if (nextPosition === -1 || nextCandidates.length === 0) {
        return false;
      }

      for (const slotIndex of nextCandidates) {
        assignments[nextPosition] = slotIndex;
        usedSlotIndexes.add(slotIndex);
        if (assignSlots(assignedCount + 1)) {
          return true;
        }
        usedSlotIndexes.delete(slotIndex);
        assignments[nextPosition] = undefined;
      }
      return false;
    }

    if (!assignSlots(0)) {
      return null;
    }

    return assignments.map((slotIndex, index) => {
      const slot = plan.slots[slotIndex ?? -1];
      return {
        index,
        encounterId: queue[index],
        slotId: slot.id,
      };
    });
  } catch {
    return null;
  }
}

function withEncounterPhase(
  game: GameState,
  encounterIndex: number,
  subPhase: "intro" | "scan" | "decision" | "result",
): GameState {
  const encounterId = game.resolvedQueue[encounterIndex];
  const committedMapping = mapCommittedQueueToSlots(game.day, game.resolvedQueue);
  const slotId = committedMapping?.[encounterIndex]?.slotId ??
    (encounterId ? canonicalSlotId(game.day, encounterId) : undefined);
  if (!encounterId || !slotId) {
    return game;
  }

  return {
    ...game,
    phase: { kind: "encounter", subPhase, encounterId, slotId },
  };
}

function currentEncounter(state: AppState): AuthoredEncounter | undefined {
  if (!state.game || state.game.phase.kind !== "encounter") {
    return undefined;
  }
  const encounterId = state.game.phase.encounterId;
  try {
    return getTask5Encounter(encounterId);
  } catch {
    return undefined;
  }
}

export function createEncounterDecisionEvent(
  game: GameState,
  phase: Extract<GamePhase, { kind: "encounter" }>,
  encounter: AuthoredEncounter,
  decision: Decision,
  outcome: Outcome,
  recommendedItemId?: string,
  metadata: EncounterDecisionEventMetadata = {},
): DomainEvent {
  const data: DomainEvent["data"] = {
    slotId: phase.slotId,
    encounterId: encounter.id,
    customerId: encounter.customerId,
    requestedItemId: encounter.requestedItemId,
    decision,
    outcomeId: outcome.id,
  };
  if (recommendedItemId) {
    data.recommendedItemId = recommendedItemId;
  }
  if (metadata.convergenceAxis) {
    data.convergenceAxis = metadata.convergenceAxis;
  }
  if (metadata.convergenceRefused === true) {
    data.convergenceRefused = true;
  }

  return {
    id: `${game.runId}:day-${game.day}:slot-${phase.slotId}:encounter-${encounter.id}:decision`,
    type: ENCOUNTER_DECISION_EVENT_TYPE,
    day: game.day,
    data,
  };
}

export function appendEncounterDecisionEvent(
  game: GameState,
  event: DomainEvent,
): GameState {
  if (game.eventLog.some((candidate) => candidate.id === event.id)) {
    return game;
  }
  return {
    ...game,
    eventLog: [
      ...game.eventLog,
      {
        ...event,
        data: { ...event.data },
      },
    ],
  };
}

function eventDataString(event: DomainEvent, key: string): string | undefined {
  const value = event.data[key];
  return typeof value === "string" ? value : undefined;
}

function isDecision(value: string | undefined): value is Decision {
  return value === "sell" || value === "refuse" || value === "recommend";
}

export function reconstructEncounterResult(
  game: GameState,
  encounterId: string,
  slotId?: string,
): EncounterResultState | null {
  const event = [...game.eventLog]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === ENCOUNTER_DECISION_EVENT_TYPE &&
        candidate.day === game.day &&
        eventDataString(candidate, "encounterId") === encounterId &&
        (slotId === undefined || eventDataString(candidate, "slotId") === slotId),
    );
  if (!event) {
    return null;
  }

  const decision = eventDataString(event, "decision");
  const outcomeId = eventDataString(event, "outcomeId");
  if (!isDecision(decision) || !outcomeId) {
    return null;
  }

  const recommendedItemId = eventDataString(event, "recommendedItemId");
  if (decision === "recommend" && !recommendedItemId) {
    return null;
  }

  return {
    eventId: event.id,
    encounterId,
    decision,
    ...(recommendedItemId ? { recommendedItemId } : {}),
    outcomeId,
  };
}

function currentEncounterResult(state: AppState): EncounterResultState | null {
  if (!state.game || state.game.phase.kind !== "encounter") {
    return state.result;
  }
  return (
    reconstructEncounterResult(
      state.game,
      state.game.phase.encounterId,
      state.game.phase.slotId,
    ) ?? state.result
  );
}

function isWorldAxis(value: unknown): value is WorldAxis {
  return typeof value === "string" && WORLD_AXES.includes(value as WorldAxis);
}

function isEndingId(value: unknown): value is EndingId {
  return typeof value === "string" && ENDING_IDS.includes(value as EndingId);
}

function hasOwn(object: unknown, key: string): boolean {
  return (
    object !== null &&
    typeof object === "object" &&
    Object.prototype.hasOwnProperty.call(object, key)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRuntimeDomainEvent(value: unknown): value is DomainEvent {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== 4 ||
    !keys.every((key) => ["id", "type", "day", "data"].includes(key)) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.type !== "string" ||
    value.type.length === 0 ||
    typeof value.day !== "number" ||
    !Number.isInteger(value.day) ||
    value.day < 1 ||
    value.day > 5 ||
    !isRecord(value.data)
  ) {
    return false;
  }
  return Object.values(value.data).every(
    (entry) =>
      typeof entry === "string" ||
      typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry)),
  );
}

function isRuntimeEventLog(value: unknown): value is DomainEvent[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!isRuntimeDomainEvent(value[index])) {
      return false;
    }
  }
  return true;
}

interface ConvergenceEventResolution {
  valid: boolean;
  convergenceAxis?: WorldAxis;
}

function recoverConvergenceFromFinalEvent(game: GameState): ConvergenceEventResolution {
  try {
    if (
      game.day !== 5 ||
      !Array.isArray(game.resolvedQueue) ||
      !isRuntimeEventLog(game.eventLog)
    ) {
      return { valid: false };
    }

    const day5Plan = getTask5DayPlan(5);
    const finalQueueIndex = TASK5_CONTENT.day5Convergence.finalQueueIndex;
    if (
      game.resolvedQueue.length !== day5Plan.slots.length ||
      !Number.isInteger(finalQueueIndex) ||
      finalQueueIndex < 0 ||
      finalQueueIndex >= game.resolvedQueue.length
    ) {
      return { valid: false };
    }

    const finalEncounterId = game.resolvedQueue[finalQueueIndex];
    if (typeof finalEncounterId !== "string") {
      return { valid: false };
    }
    const finalSlot = day5Plan.slots.find(
      (slot) => slot.fallbackEncounterId === finalEncounterId,
    );
    if (!finalSlot) {
      return { valid: false };
    }
    const finalEncounter = getTask5Encounter(finalEncounterId);
    const finalCustomer = getTask5Customer(finalEncounter.customerId);
    if (!finalCustomer.axis) {
      return { valid: false };
    }

    const expectedEventId =
      `${game.runId}:day-5:slot-${finalSlot.id}:encounter-${finalEncounter.id}:decision`;
    const metadataEvents = game.eventLog.filter(
      (event) =>
        isRecord(event) &&
        event.type === ENCOUNTER_DECISION_EVENT_TYPE &&
        event.day === 5 &&
        (hasOwn(event.data, "convergenceAxis") || hasOwn(event.data, "convergenceRefused")),
    );
    const expectedEvents = game.eventLog.filter(
      (event) => isRecord(event) && event.id === expectedEventId,
    );
    if (metadataEvents.length !== 1 || expectedEvents.length !== 1) {
      return { valid: false };
    }

    const event = metadataEvents[0];
    if (event !== expectedEvents[0] || event.type !== ENCOUNTER_DECISION_EVENT_TYPE || event.day !== 5) {
      return { valid: false };
    }
    if (!isRecord(event.data)) {
      return { valid: false };
    }
    const data = event.data;
    if (
      data.slotId !== finalSlot.id ||
      data.encounterId !== finalEncounter.id ||
      data.customerId !== finalEncounter.customerId ||
      data.requestedItemId !== finalEncounter.requestedItemId
    ) {
      return { valid: false };
    }

    const hasAxis = hasOwn(data, "convergenceAxis");
    const hasRefusal = hasOwn(data, "convergenceRefused");
    if (hasAxis === hasRefusal) {
      return { valid: false };
    }

    if (hasAxis) {
      if (
        !isWorldAxis(data.convergenceAxis) ||
        (data.decision !== "sell" && data.decision !== "recommend") ||
        data.convergenceAxis !== finalCustomer.axis
      ) {
        return { valid: false };
      }
      return { valid: true, convergenceAxis: data.convergenceAxis };
    }

    if (
      data.convergenceRefused !== true ||
      data.decision !== "refuse" ||
      !Array.isArray(game.flags) ||
      !game.flags.includes("convergence_refused")
    ) {
      return { valid: false };
    }
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

function parseEndingEventResult(game: GameState, event: unknown): EndingResultState | null {
  try {
    if (
      game.contentVersion !== TASK5_CONTENT_VERSION ||
      !isRuntimeDomainEvent(event) ||
      event.id !== `${game.runId}:ending` ||
      event.type !== ENDING_RESOLVED_EVENT_TYPE ||
      event.day !== 5 ||
      !isRecord(event.data)
    ) {
      return null;
    }

    const data = event.data;
    const requiredKeys = ["endingId", "title", "priority", "isFallback"];
    const allowedKeys = [...requiredKeys, "convergenceAxis"];
    const keys = Object.keys(data);
    if (
      keys.some((key) => !allowedKeys.includes(key)) ||
      requiredKeys.some((key) => !hasOwn(data, key)) ||
      keys.length < requiredKeys.length ||
      keys.length > allowedKeys.length
    ) {
      return null;
    }

    const endingId = data.endingId;
    const title = data.title;
    const priority = data.priority;
    const isFallback = data.isFallback;
    if (
      !isEndingId(endingId) ||
      typeof title !== "string" ||
      typeof priority !== "number" ||
      !Number.isFinite(priority) ||
      typeof isFallback !== "boolean"
    ) {
      return null;
    }

    const convergence = recoverConvergenceFromFinalEvent(game);
    if (!convergence.valid) {
      return null;
    }
    const hasConvergenceAxis = hasOwn(data, "convergenceAxis");
    const authoritativeAxis = convergence.convergenceAxis;
    if (
      hasConvergenceAxis !== (authoritativeAxis !== undefined) ||
      (hasConvergenceAxis && data.convergenceAxis !== authoritativeAxis)
    ) {
      return null;
    }

    const ending = determineEnding(
      game,
      authoritativeAxis ? { convergenceAxis: authoritativeAxis } : {},
      TASK5_CONTENT.endingRecords.flatMap((record) => record.rules),
    );
    if (
      ending.id !== endingId ||
      ending.title !== title ||
      ending.priority !== priority ||
      ending.isFallback !== isFallback
    ) {
      return null;
    }

    if (game.phase.kind === "ending" && game.phase.endingId !== endingId) {
      return null;
    }

    return {
      eventId: event.id,
      endingId,
      title,
      priority,
      isFallback,
      ...(hasConvergenceAxis ? { convergenceAxis: authoritativeAxis } : {}),
    };
  } catch {
    return null;
  }
}

export function reconstructEndingResult(game: GameState): EndingResultState | null {
  try {
    if (
      (game.phase.kind !== "ending" && game.phase.kind !== "runSummary") ||
      !isRuntimeEventLog(game.eventLog)
    ) {
      return null;
    }

    const endingEvents = game.eventLog.filter(
      (event) => isRecord(event) && event.type === ENDING_RESOLVED_EVENT_TYPE,
    );
    const expectedEventId = `${game.runId}:ending`;
    const expectedEvents = game.eventLog.filter(
      (event) => isRecord(event) && event.id === expectedEventId,
    );
    if (endingEvents.length !== 1 || expectedEvents.length !== 1) {
      return null;
    }

    return parseEndingEventResult(game, endingEvents[0]);
  } catch {
    return null;
  }
}

interface ResumeContext {
  currentQueueMapping: QueueSlotMapping[];
  currentEncounterIndex: number | null;
}

function hasUniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function hasTask5Customer(id: string): boolean {
  return TASK5_CONTENT.customers.some((customer) => customer.id === id);
}

function hasTask5Item(id: string): boolean {
  return TASK5_CONTENT.items.some((item) => item.id === id);
}

function hasTask5News(id: string): boolean {
  return TASK5_CONTENT.news.some((article) => article.id === id);
}

function hasTask5Ending(id: string): boolean {
  return TASK5_CONTENT.endingRecords.some((record) => record.id === id);
}

function task5Encounter(id: string): AuthoredEncounter | undefined {
  return TASK5_CONTENT.encounters.find((encounter) => encounter.id === id);
}

function task5News(id: string) {
  return TASK5_CONTENT.news.find((article) => article.id === id);
}

function validateReferencedCatalogs(run: PersistedRunV1): boolean {
  for (const customerId of Object.keys(run.customerStates)) {
    if (!hasTask5Customer(customerId)) {
      return false;
    }
  }

  for (const encounterId of run.resolvedQueue) {
    const encounter = task5Encounter(encounterId);
    if (!encounter || !hasTask5Customer(encounter.customerId)) {
      return false;
    }
    if (!hasTask5Item(encounter.requestedItemId)) {
      return false;
    }
    if (encounter.recommendationOptions.some((option) => !hasTask5Item(option.itemId))) {
      return false;
    }
  }

  if (run.phase.kind === "encounter") {
    const encounter = task5Encounter(run.phase.encounterId);
    if (
      !encounter ||
      !hasTask5Customer(encounter.customerId) ||
      !hasTask5Item(encounter.requestedItemId) ||
      encounter.recommendationOptions.some((option) => !hasTask5Item(option.itemId))
    ) {
      return false;
    }
  }

  for (const selection of run.newsSelections) {
    if (!hasTask5News(selection.newsId)) {
      return false;
    }
  }

  if (
    (run.phase.kind === "ending" && !hasTask5Ending(run.phase.endingId)) ||
    (run.phase.kind === "ending" && !isEndingId(run.phase.endingId))
  ) {
    return false;
  }

  return true;
}

function validatePhaseAndQueue(run: PersistedRunV1): ResumeContext | null {
  try {
    if (run.phase.kind === "briefing") {
      return run.resolvedQueue.length === 0
        ? { currentQueueMapping: [], currentEncounterIndex: null }
        : null;
    }

    const mapping = mapCommittedQueueToSlots(run.day, run.resolvedQueue);
    if (!mapping) {
      return null;
    }

    if (run.phase.kind === "encounter") {
      const encounterPhase = run.phase;
      const currentEncounterIndex = mapping.findIndex(
        (entry) =>
          entry.encounterId === encounterPhase.encounterId &&
          entry.slotId === encounterPhase.slotId,
      );
      if (currentEncounterIndex < 0) {
        return null;
      }
      return { currentQueueMapping: mapping, currentEncounterIndex };
    }

    if (
      (run.phase.kind === "ending" || run.phase.kind === "runSummary") &&
      run.day !== 5
    ) {
      return null;
    }

    return { currentQueueMapping: mapping, currentEncounterIndex: null };
  } catch {
    return null;
  }
}

function allowedNewsRole(
  day: Day,
  slot: (typeof NEWS_SLOTS)[number],
  role: string,
): boolean {
  if (slot === "direct") {
    return role === "direct";
  }
  if (slot === "trend") {
    return role === "trend";
  }
  return day === 1
    ? role === "discrepancy" || role === "local"
    : role === "discrepancy";
}

function validateNewsProgression(run: PersistedRunV1): boolean {
  const selectionsByDay = new Map<number, typeof run.newsSelections>();
  const selectedIds = new Set<string>();
  const selectedSlots = new Set<string>();

  for (const selection of run.newsSelections) {
    const article = task5News(selection.newsId);
    if (
      !article ||
      article.day !== selection.day ||
      !allowedNewsRole(selection.day, selection.slot, article.role) ||
      selectedIds.has(selection.newsId)
    ) {
      return false;
    }

    const slotKey = `${selection.day}:${selection.slot}`;
    if (selectedSlots.has(slotKey)) {
      return false;
    }
    selectedSlots.add(slotKey);
    const selections = selectionsByDay.get(selection.day) ?? [];
    selections.push(selection);
    selectionsByDay.set(selection.day, selections);
    selectedIds.add(selection.newsId);
  }

  if (!hasUniqueStrings(run.seenNews) || !hasUniqueStrings(run.readNews)) {
    return false;
  }

  const seenIds = new Set(run.seenNews);
  const readIds = new Set(run.readNews);
  if (seenIds.size !== selectedIds.size || [...seenIds].some((id) => !selectedIds.has(id))) {
    return false;
  }
  if ([...readIds].some((id) => !seenIds.has(id))) {
    return false;
  }

  const currentSelectionMode =
    run.phase.kind === "news"
      ? "partial"
      : run.phase.kind === "ending" || run.phase.kind === "runSummary"
        ? "complete"
        : "none";

  for (let day = 1; day <= 5; day += 1) {
    const selections = selectionsByDay.get(day) ?? [];
    if (day > run.day) {
      if (selections.length > 0) {
        return false;
      }
      continue;
    }

    const expectedCount =
      day < run.day
        ? NEWS_SLOTS.length
        : currentSelectionMode === "none"
          ? 0
          : NEWS_SLOTS.length;
    if (selections.length !== expectedCount) {
      return false;
    }

    if (selections.length > 0) {
      const slots = new Set(selections.map((selection) => selection.slot));
      if (
        slots.size !== NEWS_SLOTS.length ||
        NEWS_SLOTS.some((slot) => !slots.has(slot))
      ) {
        return false;
      }
    }

    if (
      day < run.day ||
      (day === run.day && currentSelectionMode === "complete")
    ) {
      if (selections.some((selection) => !readIds.has(selection.newsId))) {
        return false;
      }
    }
  }

  return true;
}

function permittedRecommendationOutcomeIds(
  encounter: AuthoredEncounter,
  recommendedItemId: string,
): Set<string> {
  const permitted = new Set<string>([encounter.outcomes.defaultRecommend.id]);
  for (const pair of TASK5_CONTENT.recommendationPairs) {
    if (
      pair.customerId !== encounter.customerId ||
      pair.requestedItemId !== encounter.requestedItemId ||
      pair.recommendedItemId !== recommendedItemId
    ) {
      continue;
    }
    permitted.add(
      pair.mode === "append-base-sale"
        ? `${encounter.outcomes.sell.id}::${pair.outcome.id}`
        : pair.outcome.id,
    );
  }
  return permitted;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key)) &&
    keys.length >= required.length &&
    keys.length <= required.length + optional.length
  );
}

function validateEncounterDecisionEvent(
  run: PersistedRunV1,
  event: DomainEvent,
  slot: EncounterSlot,
  slotIndex: number,
): boolean {
  if (!isRecord(event.data)) {
    return false;
  }

  const data = event.data;
  const requiredKeys = [
    "slotId",
    "encounterId",
    "customerId",
    "requestedItemId",
    "decision",
    "outcomeId",
  ];
  const optionalKeys = [
    "recommendedItemId",
    "convergenceAxis",
    "convergenceRefused",
  ];
  if (!exactKeys(data, requiredKeys, optionalKeys)) {
    return false;
  }

  const encounterId = eventDataString(event, "encounterId");
  const encounter = encounterId ? task5Encounter(encounterId) : undefined;
  const decision = eventDataString(event, "decision");
  const outcomeId = eventDataString(event, "outcomeId");
  const recommendedItemId = eventDataString(event, "recommendedItemId");
  if (
    !encounter ||
    !slotAllowsEncounter(slot, encounter.id) ||
    event.id !==
      `${run.runId}:day-${event.day}:slot-${slot.id}:encounter-${encounter.id}:decision` ||
    data.slotId !== slot.id ||
    data.customerId !== encounter.customerId ||
    data.requestedItemId !== encounter.requestedItemId ||
    !decision ||
    !outcomeId ||
    !isDecision(decision)
  ) {
    return false;
  }

  const hasRecommendedItem = hasOwn(data, "recommendedItemId");
  if (decision === "recommend") {
    if (
      !hasRecommendedItem ||
      !recommendedItemId ||
      !encounter.recommendationOptions.some((option) => option.itemId === recommendedItemId) ||
      !permittedRecommendationOutcomeIds(encounter, recommendedItemId).has(outcomeId)
    ) {
      return false;
    }
  } else if (
    hasRecommendedItem ||
    outcomeId !==
      (decision === "sell" ? encounter.outcomes.sell.id : encounter.outcomes.refuse.id)
  ) {
    return false;
  }

  const hasConvergenceAxis = hasOwn(data, "convergenceAxis");
  const hasConvergenceRefused = hasOwn(data, "convergenceRefused");
  const isFinalEncounter =
    event.day === 5 &&
    slotIndex === TASK5_CONTENT.day5Convergence.finalQueueIndex;
  if (!isFinalEncounter) {
    return !hasConvergenceAxis && !hasConvergenceRefused;
  }

  if (hasConvergenceAxis === hasConvergenceRefused) {
    return false;
  }

  const customer = TASK5_CONTENT.customers.find(
    (candidate) => candidate.id === encounter.customerId,
  );
  if (!customer?.axis) {
    return false;
  }

  if (hasConvergenceAxis) {
    return (
      isWorldAxis(data.convergenceAxis) &&
      data.convergenceAxis === customer.axis &&
      (decision === "sell" || decision === "recommend")
    );
  }

  return decision === "refuse" && data.convergenceRefused === true &&
    run.flags.includes(TASK5_CONTENT.day5Convergence.refusalFlagId);
}

function validateEndingEventData(run: PersistedRunV1, event: DomainEvent): boolean {
  if (
    !isRecord(event.data) ||
    event.id !== `${run.runId}:ending` ||
    event.type !== ENDING_RESOLVED_EVENT_TYPE ||
    event.day !== 5
  ) {
    return false;
  }

  const data = event.data;
  const requiredKeys = ["endingId", "title", "priority", "isFallback"];
  if (!exactKeys(data, requiredKeys, ["convergenceAxis"])) {
    return false;
  }
  return (
    isEndingId(data.endingId) &&
    hasTask5Ending(data.endingId) &&
    typeof data.title === "string" &&
    typeof data.priority === "number" &&
    Number.isFinite(data.priority) &&
    typeof data.isFallback === "boolean" &&
    (!hasOwn(data, "convergenceAxis") || isWorldAxis(data.convergenceAxis))
  );
}

function expectedDecisionSlots(
  run: PersistedRunV1,
  context: ResumeContext,
  day: Day,
): Array<{ slotId: string; index: number }> {
  if (day < run.day) {
    return getTask5DayPlan(day).slots.map((slot, index) => ({ slotId: slot.id, index }));
  }
  if (day > run.day || run.phase.kind === "briefing") {
    return [];
  }
  if (run.phase.kind === "encounter") {
    if (context.currentEncounterIndex === null) {
      return [];
    }
    const count =
      context.currentEncounterIndex + (run.phase.subPhase === "result" ? 1 : 0);
    return context.currentQueueMapping
      .slice(0, count)
      .map((entry) => ({ slotId: entry.slotId, index: entry.index }));
  }
  return context.currentQueueMapping.map((entry) => ({
    slotId: entry.slotId,
    index: entry.index,
  }));
}

function validateEventLogAndProgression(
  run: PersistedRunV1,
  context: ResumeContext,
): boolean {
  const decisionSlotsByDay = new Map<number, Set<string>>();
  const lastSlotIndexByDay = new Map<number, number>();
  const eventIds = new Set<string>();
  let previousDay = 0;
  let endingEvent: DomainEvent | undefined;

  for (let eventIndex = 0; eventIndex < run.eventLog.length; eventIndex += 1) {
    const event = run.eventLog[eventIndex];
    if (event.day < previousDay || event.day > run.day || eventIds.has(event.id)) {
      return false;
    }
    previousDay = event.day;
    eventIds.add(event.id);

    if (event.type === ENDING_RESOLVED_EVENT_TYPE) {
      if (
        endingEvent ||
        eventIndex !== run.eventLog.length - 1 ||
        !validateEndingEventData(run, event)
      ) {
        return false;
      }
      endingEvent = event;
      continue;
    }

    if (event.type !== ENCOUNTER_DECISION_EVENT_TYPE) {
      return false;
    }

    const eventSlotId = eventDataString(event, "slotId");
    const eventEncounterId = eventDataString(event, "encounterId");
    if (!eventSlotId || !eventEncounterId) {
      return false;
    }

    let slot: EncounterSlot | undefined;
    let slotIndex = -1;
    if (event.day === run.day) {
      const mapping = context.currentQueueMapping.find(
        (entry) =>
          entry.slotId === eventSlotId && entry.encounterId === eventEncounterId,
      );
      if (!mapping) {
        return false;
      }
      slotIndex = mapping.index;
      slot = getTask5DayPlan(run.day).slots.find(
        (candidate) => candidate.id === mapping.slotId,
      );
    } else {
      const plan = getTask5DayPlan(event.day);
      slotIndex = plan.slots.findIndex(
        (candidate) =>
          candidate.id === eventSlotId && slotAllowsEncounter(candidate, eventEncounterId),
      );
      slot = slotIndex >= 0 ? plan.slots[slotIndex] : undefined;
    }

    if (!slot || slotIndex < 0 || !validateEncounterDecisionEvent(run, event, slot, slotIndex)) {
      return false;
    }

    if (
      lastSlotIndexByDay.has(event.day) &&
      (lastSlotIndexByDay.get(event.day) ?? -1) >= slotIndex
    ) {
      return false;
    }
    lastSlotIndexByDay.set(event.day, slotIndex);
    const slots = decisionSlotsByDay.get(event.day) ?? new Set<string>();
    if (slots.has(eventSlotId)) {
      return false;
    }
    slots.add(eventSlotId);
    decisionSlotsByDay.set(event.day, slots);
  }

  const requiresEnding = run.phase.kind === "ending" || run.phase.kind === "runSummary";
  if (requiresEnding !== (endingEvent !== undefined)) {
    return false;
  }
  if (endingEvent && run.day !== 5) {
    return false;
  }

  for (let day = 1; day <= 5; day += 1) {
    const expected = expectedDecisionSlots(run, context, day as Day);
    const actual = decisionSlotsByDay.get(day) ?? new Set<string>();
    if (actual.size !== expected.length) {
      return false;
    }
    if (expected.some((entry) => !actual.has(entry.slotId))) {
      return false;
    }
  }

  if (run.phase.kind === "encounter" && run.phase.subPhase === "result") {
    if (
      reconstructEncounterResult(
        run as unknown as GameState,
        run.phase.encounterId,
        run.phase.slotId,
      ) === null
    ) {
      return false;
    }
  }

  if (requiresEnding) {
    const ending = reconstructEndingResult(run as unknown as GameState);
    if (
      !ending ||
      (run.phase.kind === "ending" && ending.endingId !== run.phase.endingId)
    ) {
      return false;
    }
  }

  return true;
}

function validateRunSemantics(run: PersistedRunV1): boolean {
  if (
    run.schemaVersion !== SCHEMA_VERSION ||
    run.contentVersion !== TASK5_CONTENT_VERSION ||
    run.runId.trim().length === 0 ||
    !Number.isInteger(run.runNumber) ||
    run.runNumber <= 0 ||
    !hasUniqueStrings(run.flags) ||
    !hasUniqueStrings(run.seenNews) ||
    !hasUniqueStrings(run.readNews) ||
    !hasUniqueStrings(run.resolvedQueue) ||
    !isRuntimeEventLog(run.eventLog) ||
    run.readNews.some((newsId) => !run.seenNews.includes(newsId))
  ) {
    return false;
  }

  if (
    (run.phase.kind === "ending" && !isEndingId(run.phase.endingId)) ||
    (run.phase.kind === "runSummary" && run.day !== 5)
  ) {
    return false;
  }

  if (!validateReferencedCatalogs(run)) {
    return false;
  }

  const context = validatePhaseAndQueue(run);
  if (!context || !validateNewsProgression(run)) {
    return false;
  }

  return validateEventLogAndProgression(run, context);
}

/**
 * Total semantic predicate for the persistence layer. Structural parsing is
 * intentionally repeated here because callers may pass untrusted values at
 * runtime despite the TypeScript signature.
 */
export function validateRunForResume(run: PersistedRunV1): run is GameState {
  try {
    const parsed = PersistedRunV1Schema.safeParse(run);
    return parsed.success && validateRunSemantics(parsed.data);
  } catch {
    return false;
  }
}

function clonePersistedPhase(phase: PersistedGamePhase): GamePhase {
  switch (phase.kind) {
    case "briefing":
      return { kind: "briefing" };
    case "encounter":
      return {
        kind: "encounter",
        subPhase: phase.subPhase === "scan" ? "decision" : phase.subPhase,
        encounterId: phase.encounterId,
        slotId: phase.slotId,
      };
    case "shiftSummary":
      return { kind: "shiftSummary" };
    case "news":
      return { kind: "news" };
    case "ending":
      return { kind: "ending", endingId: phase.endingId as EndingId };
    case "runSummary":
      return { kind: "runSummary" };
  }
}

function clonePersistedRun(run: PersistedRunV1): GameState {
  return {
    schemaVersion: run.schemaVersion,
    contentVersion: run.contentVersion,
    runId: run.runId,
    runNumber: run.runNumber,
    day: run.day,
    phase: clonePersistedPhase(run.phase),
    world: { ...run.world },
    stability: run.stability,
    awareness: run.awareness,
    managerTrust: run.managerTrust,
    revenue: { ...run.revenue },
    flags: [...run.flags],
    customerStates: { ...run.customerStates },
    seenNews: [...run.seenNews],
    readNews: [...run.readNews],
    resolvedQueue: [...run.resolvedQueue],
    newsSelections: run.newsSelections.map((selection) => ({ ...selection })),
    eventLog: run.eventLog.map((event) => ({ ...event, data: { ...event.data } })),
  };
}

function appStateFromValidatedGame(game: GameState): AppState | null {
  const base = {
    game,
    queue: null,
    encounterIndex: 0,
    result: null,
    openNewsId: null,
  } satisfies Omit<AppState, "view">;

  switch (game.phase.kind) {
    case "briefing":
      return { ...base, view: "briefing" };
    case "encounter": {
      const encounterIndex = game.resolvedQueue.indexOf(game.phase.encounterId);
      if (encounterIndex < 0) {
        return null;
      }
      return {
        ...base,
        view: "encounter",
        encounterIndex,
        result:
          game.phase.subPhase === "result"
            ? reconstructEncounterResult(game, game.phase.encounterId, game.phase.slotId)
            : null,
      };
    }
    case "shiftSummary":
      return { ...base, view: "shiftSummary" };
    case "news":
      return { ...base, view: "news" };
    case "ending":
      return { ...base, view: "ending" };
    case "runSummary":
      return { ...base, view: "runSummary" };
  }
}

/** Rehydrates only from a semantically valid, structurally persisted run. */
export function restoreAppStateFromRun(run: PersistedRunV1): AppState | null {
  try {
    if (!validateRunForResume(run)) {
      return null;
    }
    return appStateFromValidatedGame(clonePersistedRun(run));
  } catch {
    return null;
  }
}

function resolveDay5Ending(state: AppState): AppState {
  if (!state.game || state.game.day !== 5 || !isRuntimeEventLog(state.game.eventLog)) {
    return state;
  }
  if (
    state.game.eventLog.some(
      (event) =>
        event !== null &&
        typeof event === "object" &&
        (event.type === ENDING_RESOLVED_EVENT_TYPE ||
          event.id === `${state.game?.runId}:ending`),
    )
  ) {
    return state;
  }

  const convergence = recoverConvergenceFromFinalEvent(state.game);
  if (!convergence.valid) {
    return state;
  }

  try {
    const ending = determineEnding(
      state.game,
      convergence.convergenceAxis
        ? { convergenceAxis: convergence.convergenceAxis }
        : {},
      TASK5_CONTENT.endingRecords.flatMap((record) => record.rules),
    );
    const data: DomainEvent["data"] = {
      endingId: ending.id,
      title: ending.title,
      priority: ending.priority,
      isFallback: ending.isFallback,
    };
    if (convergence.convergenceAxis) {
      data.convergenceAxis = convergence.convergenceAxis;
    }
    const event: DomainEvent = {
      id: `${state.game.runId}:ending`,
      type: ENDING_RESOLVED_EVENT_TYPE,
      day: 5,
      data,
    };
    const nextGame: GameState = {
      ...state.game,
      phase: { kind: "ending", endingId: ending.id },
      eventLog: [...state.game.eventLog, { ...event, data: { ...event.data } }],
    };
    if (!parseEndingEventResult(nextGame, event)) {
      return state;
    }
    return {
      ...state,
      view: "ending",
      game: nextGame,
      queue: null,
      encounterIndex: 0,
      result: null,
      openNewsId: null,
    };
  } catch {
    return state;
  }
}

interface ConvergenceResolution {
  effects: Effect[];
  metadata: EncounterDecisionEventMetadata;
}

function resolveConvergence(
  game: GameState,
  encounterIndex: number,
  encounter: AuthoredEncounter,
  decision: Decision,
): ConvergenceResolution {
  const noConvergence: ConvergenceResolution = { effects: [], metadata: {} };
  const convergence = TASK5_CONTENT.day5Convergence;
  if (game.day !== 5 || encounterIndex !== convergence.finalQueueIndex) {
    return noConvergence;
  }

  if (decision === "refuse") {
    return {
      effects: [
        { kind: "add", target: "stability", amount: convergence.refusalStabilityDelta },
        { kind: "setFlag", id: convergence.refusalFlagId },
      ],
      metadata: { convergenceRefused: true },
    };
  }

  const customer = getTask5Customer(encounter.customerId);
  if (!customer.axis) {
    return noConvergence;
  }

  return {
    effects: [
      {
        kind: "add",
        target: `world.${customer.axis}`,
        amount: convergence.successfulSaleAxisBonus,
      },
    ],
    metadata: { convergenceAxis: customer.axis },
  };
}

function resolveEncounterDecision(
  state: AppState,
  decision: Decision,
  recommendedItemId?: string,
): AppState {
  if (!state.game || state.view !== "encounter" || state.game.phase.kind !== "encounter") {
    return state;
  }
  if (state.game.phase.subPhase !== "decision") {
    return state;
  }

  const encounter = currentEncounter(state);
  if (!encounter || encounter.id !== state.game.phase.encounterId) {
    return state;
  }

  let outcome: Outcome;
  try {
    if (decision === "sell") {
      outcome = encounter.outcomes.sell;
    } else if (decision === "refuse") {
      outcome = encounter.outcomes.refuse;
    } else {
      if (
        !recommendedItemId ||
        !encounter.recommendationOptions.some((option) => option.itemId === recommendedItemId)
      ) {
        return state;
      }
      outcome = resolveRecommendation({
        state: state.game,
        customerId: encounter.customerId,
        requestedItemId: encounter.requestedItemId,
        recommendedItemId,
        pairs: TASK5_CONTENT.recommendationPairs,
        baseSale: encounter.outcomes.sell,
        defaultOutcome: encounter.outcomes.defaultRecommend,
      }).outcome;
    }

    const convergence = resolveConvergence(
      state.game,
      state.encounterIndex,
      encounter,
      decision,
    );
    const combinedOutcome: Outcome = {
      id: outcome.id,
      effects: [...outcome.effects, ...convergence.effects],
    };
    const event = createEncounterDecisionEvent(
      state.game,
      state.game.phase,
      encounter,
      decision,
      outcome,
      decision === "recommend" ? recommendedItemId : undefined,
      convergence.metadata,
    );
    if (state.game.eventLog.some((candidate) => candidate.id === event.id)) {
      return state;
    }

    const nextGame = appendEncounterDecisionEvent(
      applyOutcome(state.game, combinedOutcome),
      event,
    );
    return {
      ...state,
      game: withEncounterPhase(nextGame, state.encounterIndex, "result"),
      result: {
        eventId: event.id,
        encounterId: encounter.id,
        decision,
        ...(decision === "recommend" && recommendedItemId ? { recommendedItemId } : {}),
        outcomeId: outcome.id,
      },
    };
  } catch {
    return state;
  }
}

function advanceToBriefing(state: AppState, nextDay: Day): AppState {
  if (!state.game) {
    return state;
  }

  try {
    const nextPlan = getTask5DayPlan(nextDay);
    const source = state.game;
    const nextGame: GameState = {
      ...source,
      day: nextDay,
      phase: { kind: "briefing" },
      world: { ...source.world },
      revenue: {
        ...source.revenue,
        today: 0,
        dailyTarget: nextPlan.revenueTarget,
      },
      flags: [...source.flags],
      customerStates: { ...source.customerStates },
      seenNews: [...source.seenNews],
      readNews: [...source.readNews],
      resolvedQueue: [],
      newsSelections: source.newsSelections.map((selection) => ({ ...selection })),
      eventLog: source.eventLog.map((event) => ({ ...event, data: { ...event.data } })),
    };
    return {
      ...state,
      view: "briefing",
      game: nextGame,
      queue: null,
      encounterIndex: 0,
      result: null,
      openNewsId: null,
    };
  } catch {
    return state;
  }
}

export function gameReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "RESTORE_RUN": {
      if (state.view !== "title" || state.game !== null) {
        return rejected(state);
      }
      const restored = restoreAppStateFromRun(action.run);
      if (!restored?.game) {
        return rejected(state);
      }
      return {
        ...initialAppState,
        game: restored.game,
      };
    }
    case "CONTINUE_RUN": {
      if (state.view !== "title" || !state.game) {
        return rejected(state);
      }
      return restoreAppStateFromRun(state.game) ?? rejected(state);
    }
    case "START_NEW_RUN": {
      if (
        state.view !== "title" ||
        action.contentVersion !== TASK5_CONTENT_VERSION ||
        typeof action.runId !== "string" ||
        action.runId.trim().length === 0 ||
        (action.runNumber !== undefined &&
          (!Number.isInteger(action.runNumber) || action.runNumber <= 0))
      ) {
        return rejected(state);
      }
      try {
        validateTask5Content(TASK5_CONTENT);
        const game = createInitialGameState({
          runId: action.runId,
          contentVersion: TASK5_CONTENT_VERSION,
          ...(action.runNumber !== undefined ? { runNumber: action.runNumber } : {}),
        });
        return {
          ...initialAppState,
          view: "briefing",
          game,
        };
      } catch {
        return state;
      }
    }
    case "RESET_TO_TITLE":
      if (state.view === "title") {
        return state;
      }
      return {
        ...state,
        view: "title",
        queue: null,
        encounterIndex: 0,
        result: null,
        openNewsId: null,
      };
    case "BEGIN_DAY": {
      if (!state.game || state.view !== "briefing" || state.game.phase.kind !== "briefing") {
        return rejected(state);
      }
      if (state.game.resolvedQueue.length > 0) {
        return rejected(state);
      }

      try {
        const plan = getTask5DayPlan(state.game.day);
        const dayStartState: GameState = {
          ...state.game,
          revenue: {
            ...state.game.revenue,
            dailyTarget: plan.revenueTarget,
          },
          resolvedQueue: [],
        };
        const queue = resolveEncounterQueue(plan, dayStartState);
        if (queue.encounterIds.length !== plan.slots.length) {
          return rejected(state);
        }
        const gameWithQueue: GameState = {
          ...queue.snapshot,
          resolvedQueue: [...queue.encounterIds],
        };
        const game = withEncounterPhase(gameWithQueue, 0, "intro");
        if (game === gameWithQueue) {
          return rejected(state);
        }
        return {
          ...state,
          view: "encounter",
          game,
          queue,
          encounterIndex: 0,
          result: null,
          openNewsId: null,
        };
      } catch {
        return rejected(state);
      }
    }
    case "SCAN_ENCOUNTER":
      if (
        state.view !== "encounter" ||
        !state.game ||
        state.game.phase.kind !== "encounter" ||
        state.game.phase.subPhase !== "intro"
      ) {
        return rejected(state);
      }
      return { ...state, game: withEncounterPhase(state.game, state.encounterIndex, "decision") };
    case "SELL":
      return resolveEncounterDecision(state, "sell");
    case "REFUSE":
      return resolveEncounterDecision(state, "refuse");
    case "RECOMMEND":
      return resolveEncounterDecision(state, "recommend", action.recommendedItemId);
    case "NEXT_ENCOUNTER": {
      if (
        state.view !== "encounter" ||
        !state.game ||
        state.game.phase.kind !== "encounter" ||
        state.game.phase.subPhase !== "result" ||
        !currentEncounterResult(state)
      ) {
        return rejected(state);
      }

      const nextIndex = state.encounterIndex + 1;
      if (nextIndex >= state.game.resolvedQueue.length) {
        return {
          ...state,
          view: "shiftSummary",
          game: { ...state.game, phase: { kind: "shiftSummary" } },
          result: null,
        };
      }

      const nextGame = withEncounterPhase(state.game, nextIndex, "intro");
      if (nextGame === state.game) {
        return rejected(state);
      }
      return {
        ...state,
        game: nextGame,
        encounterIndex: nextIndex,
        result: null,
      };
    }
    case "OPEN_NEWS": {
      if (
        state.view !== "shiftSummary" ||
        !state.game ||
        state.game.phase.kind !== "shiftSummary" ||
        state.game.newsSelections.some((selection) => selection.day === state.game?.day)
      ) {
        return rejected(state);
      }

      try {
        const selections = selectNewsForDay(state.game.day, TASK5_CONTENT.news, state.game);
        const gameWithNews = commitNewsSelections(state.game, selections);
        return {
          ...state,
          view: "news",
          game: { ...gameWithNews, phase: { kind: "news" } },
          openNewsId: null,
        };
      } catch {
        return rejected(state);
      }
    }
    case "READ_NEWS": {
      if (state.view !== "news" || !state.game || state.game.phase.kind !== "news") {
        return rejected(state);
      }
      try {
        const article = getTask5NewsArticle(action.newsId);
        if (
          article.day !== state.game.day ||
          !state.game.newsSelections.some(
            (selection) => selection.day === state.game?.day && selection.newsId === article.id,
          ) ||
          state.game.readNews.includes(article.id)
        ) {
          return rejected(state);
        }
        const result = readNewsArticle(state.game, article);
        return { ...state, game: result.state, openNewsId: article.id };
      } catch {
        return rejected(state);
      }
    }
    case "ADVANCE_DAY": {
      if (
        !state.game ||
        state.view !== "news" ||
        state.game.phase.kind !== "news" ||
        !canAdvanceAfterNews(state.game)
      ) {
        return rejected(state);
      }

      if (state.game.day < 5) {
        return advanceToBriefing(state, (state.game.day + 1) as Day);
      }
      return resolveDay5Ending(state);
    }
    case "OPEN_RUN_SUMMARY": {
      if (
        state.view !== "ending" ||
        !state.game ||
        state.game.phase.kind !== "ending"
      ) {
        return rejected(state);
      }

      const endingResult = reconstructEndingResult(state.game);
      if (!endingResult || endingResult.endingId !== state.game.phase.endingId) {
        return rejected(state);
      }

      return {
        ...state,
        view: "runSummary",
        game: { ...state.game, phase: { kind: "runSummary" } },
      };
    }
    default:
      return rejected(state);
  }
}

export const TASK5_DEFAULT_RUN_ID = "task5-authored-run";
export const TASK5_DEFAULT_CONTENT_VERSION = TASK5_CONTENT_VERSION;

/** Compatibility names retained while the UI transitions to the Task 5 controller. */
export const TASK4_DEFAULT_RUN_ID = TASK5_DEFAULT_RUN_ID;
export const TASK4_DEFAULT_CONTENT_VERSION = TASK5_DEFAULT_CONTENT_VERSION;
