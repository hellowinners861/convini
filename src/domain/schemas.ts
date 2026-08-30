import { z } from "zod";
import {
  COMPARISON_OPERATORS,
  EFFECT_NUMERIC_TARGETS,
  ENDING_IDS,
  ENCOUNTER_SUB_PHASES,
  NEWS_ROLES,
  NEWS_SLOTS,
  NUMERIC_REFERENCES,
  SCHEMA_VERSION,
  WORLD_AXES,
} from "./constants";
import type {
  Condition,
  Day5AnomalySlot,
  DayEncounterPlan,
  Effect,
  GameState,
  GamePhase,
} from "./types";

const NonEmptyStringSchema = z.string().min(1);
const DaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const NumericConditionSchema = z
  .object({
    reference: z.enum(NUMERIC_REFERENCES),
    operator: z.enum(COMPARISON_OPERATORS),
    value: z.number().finite(),
  })
  .strict();

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ true: z.literal(true) }).strict(),
    z.object({ all: z.array(ConditionSchema) }).strict(),
    z.object({ any: z.array(ConditionSchema) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z.object({ numeric: NumericConditionSchema }).strict(),
    z
      .object({
        flag: z.object({ id: NonEmptyStringSchema, present: z.boolean().optional() }).strict(),
      })
      .strict(),
    z
      .object({
        customerState: z
          .object({ customerId: NonEmptyStringSchema, state: NonEmptyStringSchema })
          .strict(),
      })
      .strict(),
    z
      .object({
        seenNews: z
          .object({ id: NonEmptyStringSchema, present: z.boolean().optional() })
          .strict(),
      })
      .strict(),
    z
      .object({
        readNews: z
          .object({ id: NonEmptyStringSchema, present: z.boolean().optional() })
          .strict(),
      })
      .strict(),
    z
      .object({ leadingAxis: z.object({ axis: z.enum(WORLD_AXES) }).strict() })
      .strict(),
  ]),
);

export const EffectSchema: z.ZodType<Effect> = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("add"),
      target: z.enum(EFFECT_NUMERIC_TARGETS),
      amount: z.number().finite(),
    })
    .strict(),
  z
    .object({ kind: z.literal("setFlag"), id: NonEmptyStringSchema })
    .strict(),
  z
    .object({
      kind: z.literal("setCustomerState"),
      customerId: NonEmptyStringSchema,
      state: NonEmptyStringSchema,
    })
    .strict(),
]);

export const OutcomeSchema = z
  .object({ id: NonEmptyStringSchema, effects: z.array(EffectSchema) })
  .strict();

export const GamePhaseSchema: z.ZodType<GamePhase> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("briefing") }).strict(),
  z
    .object({
      kind: z.literal("encounter"),
      subPhase: z.enum(ENCOUNTER_SUB_PHASES),
      encounterId: NonEmptyStringSchema,
      slotId: NonEmptyStringSchema,
    })
    .strict(),
  z.object({ kind: z.literal("shiftSummary") }).strict(),
  z.object({ kind: z.literal("news") }).strict(),
  z.object({ kind: z.literal("ending"), endingId: z.enum(ENDING_IDS) }).strict(),
  z.object({ kind: z.literal("runSummary") }).strict(),
]);

export const RevenueStateSchema = z
  .object({
    total: z.number().finite(),
    today: z.number().finite(),
    dailyTarget: z.number().finite(),
  })
  .strict();

export const DomainEventSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: NonEmptyStringSchema,
    day: DaySchema,
    data: z.record(z.union([z.string(), z.number().finite(), z.boolean()])),
  })
  .strict();

export const NewsSelectionSchema = z
  .object({ day: DaySchema, slot: z.enum(NEWS_SLOTS), newsId: NonEmptyStringSchema })
  .strict();

export const GameStateSchema: z.ZodType<GameState> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    contentVersion: NonEmptyStringSchema,
    runId: NonEmptyStringSchema,
    runNumber: z.number().int().positive(),
    day: DaySchema,
    phase: GamePhaseSchema,
    world: z
      .object({
        undead: z.number().finite(),
        machine: z.number().finite(),
        cosmic: z.number().finite(),
        spirit: z.number().finite(),
      })
      .strict(),
    stability: z.number().finite(),
    awareness: z.number().finite(),
    managerTrust: z.number().finite(),
    revenue: RevenueStateSchema,
    flags: z.array(NonEmptyStringSchema),
    customerStates: z.record(NonEmptyStringSchema, NonEmptyStringSchema),
    seenNews: z.array(NonEmptyStringSchema),
    readNews: z.array(NonEmptyStringSchema),
    resolvedQueue: z.array(NonEmptyStringSchema),
    newsSelections: z.array(NewsSelectionSchema),
    eventLog: z.array(DomainEventSchema),
  })
  .strict();

export const EncounterCandidateSchema = z
  .object({ encounterId: NonEmptyStringSchema, conditions: ConditionSchema, priority: z.number().finite() })
  .strict();

export const EncounterSlotSchema = z
  .object({
    id: NonEmptyStringSchema,
    candidates: z.array(EncounterCandidateSchema),
    fallbackEncounterId: NonEmptyStringSchema,
  })
  .strict();

export const Day5AnomalySlotSchema: z.ZodType<Day5AnomalySlot> = z
  .object({
    slotId: NonEmptyStringSchema,
    customerId: NonEmptyStringSchema,
    axis: z.enum(WORLD_AXES),
    unresolvedness: z.number().finite(),
    lastAffectedAxis: z.enum(WORLD_AXES),
  })
  .strict();

export const DayEncounterPlanSchema: z.ZodType<DayEncounterPlan> = z
  .object({
    day: DaySchema,
    slots: z.array(EncounterSlotSchema),
    day5AnomalyOrder: z.array(Day5AnomalySlotSchema).optional(),
  })
  .strict();

export const RecommendationPairSchema = z
  .object({
    id: NonEmptyStringSchema,
    customerId: NonEmptyStringSchema,
    requestedItemId: NonEmptyStringSchema,
    recommendedItemId: NonEmptyStringSchema,
    conditions: ConditionSchema,
    priority: z.number().finite(),
    mode: z.enum(["append-base-sale", "replace-base-sale"]),
    outcome: OutcomeSchema,
  })
  .strict();

export const NewsArticleSchema = z
  .object({
    id: NonEmptyStringSchema,
    day: DaySchema,
    role: z.enum(NEWS_ROLES),
    notificationHeadline: z.string(),
    headline: z.string(),
    body: z.string(),
    conditions: ConditionSchema,
    priority: z.number().finite(),
    effectsOnRead: z.array(EffectSchema),
    exclusiveGroup: NonEmptyStringSchema.optional(),
    isFallback: z.boolean(),
  })
  .strict();

export const EndingDefinitionSchema = z
  .object({
    id: z.enum(ENDING_IDS),
    title: NonEmptyStringSchema,
    priority: z.number().finite(),
    condition: ConditionSchema,
    isFallback: z.boolean().optional(),
  })
  .strict();
