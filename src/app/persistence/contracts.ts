import { z } from "zod";
import {
  NEWS_SLOTS,
  SCHEMA_VERSION,
  type Day,
  type DomainEvent,
  type GameState,
  type NewsSelection,
} from "../../domain";

/** The only keys owned by the persistence layer. */
export const RUN_STORAGE_KEY = "last-convenience:run:v1" as const;
export const META_STORAGE_KEY = "last-convenience:meta:v1" as const;
export const SETTINGS_STORAGE_KEY = "last-convenience:settings:v1" as const;

export const STORAGE_KEYS = {
  run: RUN_STORAGE_KEY,
  meta: META_STORAGE_KEY,
  settings: SETTINGS_STORAGE_KEY,
} as const;

/** Alias used by callers that prefer the persistence-specific name. */
export const PERSISTENCE_KEYS = STORAGE_KEYS;

export type PersistenceKey = keyof typeof STORAGE_KEYS;

const NonBlankTextSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "must not be blank");
const FiniteNumberSchema = z.number().finite();
const DaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const NewsSlotSchema = z.enum(NEWS_SLOTS);

/**
 * The persisted phase deliberately does not restrict ending IDs to today's
 * catalog. A run from an older content version must remain structurally
 * loadable so that the caller can decide how to handle it.
 */
export type PersistedGamePhase =
  | { kind: "briefing" }
  | {
      kind: "encounter";
      subPhase: "intro" | "scan" | "decision" | "result";
      encounterId: string;
      slotId: string;
    }
  | { kind: "shiftSummary" }
  | { kind: "news" }
  | { kind: "ending"; endingId: string }
  | { kind: "runSummary" };

const PersistedGamePhaseSchema: z.ZodType<PersistedGamePhase> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("briefing") }).strict(),
  z
    .object({
      kind: z.literal("encounter"),
      subPhase: z.enum(["intro", "scan", "decision", "result"]),
      encounterId: NonBlankTextSchema,
      slotId: NonBlankTextSchema,
    })
    .strict(),
  z.object({ kind: z.literal("shiftSummary") }).strict(),
  z.object({ kind: z.literal("news") }).strict(),
  z.object({ kind: z.literal("ending"), endingId: NonBlankTextSchema }).strict(),
  z.object({ kind: z.literal("runSummary") }).strict(),
]);

const EventDataValueSchema = z.union([
  NonBlankTextSchema,
  FiniteNumberSchema,
  z.boolean(),
]);

const PersistedDomainEventSchema: z.ZodType<DomainEvent> = z
  .object({
    id: NonBlankTextSchema,
    type: NonBlankTextSchema,
    day: DaySchema,
    data: z.record(NonBlankTextSchema, EventDataValueSchema),
  })
  .strict();

const PersistedNewsSelectionSchema: z.ZodType<NewsSelection> = z
  .object({
    day: DaySchema,
    slot: NewsSlotSchema,
    newsId: NonBlankTextSchema,
  })
  .strict();

const WorldSchema = z
  .object({
    undead: FiniteNumberSchema,
    machine: FiniteNumberSchema,
    cosmic: FiniteNumberSchema,
    spirit: FiniteNumberSchema,
  })
  .strict();

const RevenueSchema = z
  .object({
    total: FiniteNumberSchema,
    today: FiniteNumberSchema,
    dailyTarget: FiniteNumberSchema,
  })
  .strict();

/**
 * PersistedRunV1 is structurally the existing GameState shape. AppState's
 * queue, encounterIndex, result, and openNewsId are intentionally absent.
 */
export type PersistedRunV1 = Omit<GameState, "phase"> & {
  phase: PersistedGamePhase;
};

export const PersistedRunV1Schema: z.ZodType<PersistedRunV1> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    contentVersion: NonBlankTextSchema,
    runId: NonBlankTextSchema,
    runNumber: FiniteNumberSchema.int().positive(),
    day: DaySchema,
    phase: PersistedGamePhaseSchema,
    world: WorldSchema,
    stability: FiniteNumberSchema,
    awareness: FiniteNumberSchema,
    managerTrust: FiniteNumberSchema,
    revenue: RevenueSchema,
    flags: z.array(NonBlankTextSchema),
    customerStates: z.record(NonBlankTextSchema, NonBlankTextSchema),
    seenNews: z.array(NonBlankTextSchema),
    readNews: z.array(NonBlankTextSchema),
    resolvedQueue: z.array(NonBlankTextSchema),
    newsSelections: z.array(PersistedNewsSelectionSchema),
    eventLog: z.array(PersistedDomainEventSchema),
  })
  .strict();

export interface EndingHistoryEntry {
  runId: string;
  runNumber: number;
  contentVersion: string;
  endingId: string;
}

export interface NewsHistoryEntry {
  runId: string;
  runNumber: number;
  contentVersion: string;
  day: Day;
  newsId: string;
  status: "seen" | "read";
}

export interface PersistedMetaV1 {
  schemaVersion: 1;
  endingHistory: EndingHistoryEntry[];
  newsHistory: NewsHistoryEntry[];
}

const EndingHistoryEntrySchema: z.ZodType<EndingHistoryEntry> = z
  .object({
    runId: NonBlankTextSchema,
    runNumber: FiniteNumberSchema.int().positive(),
    contentVersion: NonBlankTextSchema,
    endingId: NonBlankTextSchema,
  })
  .strict();

const NewsHistoryEntrySchema: z.ZodType<NewsHistoryEntry> = z
  .object({
    runId: NonBlankTextSchema,
    runNumber: FiniteNumberSchema.int().positive(),
    contentVersion: NonBlankTextSchema,
    day: DaySchema,
    newsId: NonBlankTextSchema,
    status: z.enum(["seen", "read"]),
  })
  .strict();

export const PersistedMetaV1Schema: z.ZodType<PersistedMetaV1> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    endingHistory: z.array(EndingHistoryEntrySchema),
    newsHistory: z.array(NewsHistoryEntrySchema),
  })
  .strict();

export interface PersistedSettingsV1 {
  schemaVersion: 1;
  audioMuted: boolean;
}

export const PersistedSettingsV1Schema: z.ZodType<PersistedSettingsV1> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    audioMuted: z.boolean(),
  })
  .strict();

export const DEFAULT_PERSISTED_META_V1: PersistedMetaV1 = {
  schemaVersion: SCHEMA_VERSION,
  endingHistory: [],
  newsHistory: [],
};

export const DEFAULT_META = DEFAULT_PERSISTED_META_V1;

export const DEFAULT_PERSISTED_SETTINGS_V1: PersistedSettingsV1 = {
  schemaVersion: SCHEMA_VERSION,
  audioMuted: false,
};

export const DEFAULT_SETTINGS = DEFAULT_PERSISTED_SETTINGS_V1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type CorruptReason = "json" | "schema" | "unsupported-schema" | "semantic";
export type StorageFailureReason = "security" | "quota" | "unknown";

export type LoadResult<T> =
  | { kind: "missing" }
  | { kind: "valid"; value: T }
  | {
      kind: "incompatible-content";
      foundContentVersion: string;
      expectedContentVersion: string;
    }
  | { kind: "corrupt"; reason: CorruptReason }
  | { kind: "unavailable"; operation: "read"; reason: "security" | "unknown" };

export type SaveResult =
  | { kind: "saved" }
  | { kind: "failed"; operation: "write"; reason: StorageFailureReason };

export type RemoveResult =
  | { kind: "removed" }
  | { kind: "failed"; operation: "remove"; reason: "security" | "unknown" };

export type RunSemanticValidator = (
  run: PersistedRunV1,
) => boolean | { valid: boolean } | void;

export interface MetaCatalogOptions {
  currentContentVersion?: string;
  currentEndingIds?: readonly string[];
  currentNewsIds?: readonly string[];
}
