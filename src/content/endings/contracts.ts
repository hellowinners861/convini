import { z } from "zod";
import { ENDING_IDS, EndingDefinitionSchema, WORLD_AXES } from "../../domain";
import type { EndingDefinition, EndingId, WorldAxis } from "../../domain";
import {
  ConditionalNarrativeSchema,
  NarrativeSchema,
} from "../schemas";
import type { ConditionalNarrative, Narrative } from "../types";

/** The content version shared by the Task 5 news and ending bundles. */
export const TASK5_ENDINGS_CONTENT_VERSION = "task5-authored-v1" as const;
export const TASK5_CONTENT_VERSION = TASK5_ENDINGS_CONTENT_VERSION;
export const ENDINGS_CONTENT_VERSION = TASK5_ENDINGS_CONTENT_VERSION;

export interface EndingPresentation {
  title: string;
  lead: Narrative;
  body: ConditionalNarrative;
  finalLine: ConditionalNarrative;
  runSummary: Narrative;
}

export interface EndingRecord {
  id: EndingId;
  rules: EndingDefinition[];
  presentation: EndingPresentation;
}

export type AuthoredEndingRecord = EndingRecord;
export type Task5EndingRecord = EndingRecord;

export interface GoldenRouteDecision {
  encounterId: string;
  recommendedItemId: string;
}

export interface GoldenRouteFingerprint {
  endingId: EndingId;
  world: Record<WorldAxis, number>;
  stability: number;
  awareness: number;
  convergenceAxis: WorldAxis;
  customerStates: Record<string, string>;
  flags: string[];
  encounterDecisionCount: number;
  completedDayCount: number;
  selectedNewsCount: number;
  readNewsCount: number;
}

export interface GoldenRoute {
  id: string;
  decisions: GoldenRouteDecision[];
  expected: GoldenRouteFingerprint;
}

export type Task5GoldenRoute = GoldenRoute;
export type GoldenRouteExpectedFingerprint = GoldenRouteFingerprint;

export interface EndingBundle {
  contentVersion: string;
  records: EndingRecord[];
  routes: GoldenRoute[];
}

export type Task5EndingBundle = EndingBundle;
export type EndingContentBundle = EndingBundle;

const NonBlankTextSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "must not be blank");
const ContentIdSchema = NonBlankTextSchema;
const FiniteNumberSchema = z.number().finite();
const NonNegativeIntegerSchema = FiniteNumberSchema.int().nonnegative();
const EndingIdSchema = z.enum(ENDING_IDS);
const WorldAxisSchema = z.enum(WORLD_AXES);

export const EndingPresentationSchema: z.ZodType<EndingPresentation> = z
  .object({
    title: NonBlankTextSchema,
    lead: NarrativeSchema,
    body: ConditionalNarrativeSchema,
    finalLine: ConditionalNarrativeSchema,
    runSummary: NarrativeSchema,
  })
  .strict();

const EndingRecordSchemaBase = z
  .object({
    id: EndingIdSchema,
    rules: z.array(EndingDefinitionSchema).min(1),
    presentation: EndingPresentationSchema,
  })
  .strict();

/** A record owns its rules, but rule-count and cross-record checks stay later. */
export const EndingRecordSchema: z.ZodType<EndingRecord> = EndingRecordSchemaBase.superRefine(
  (record, context) => {
    const ruleKeys = new Set<string>();
    for (const [index, rule] of record.rules.entries()) {
      // The domain's inventory_mixup pair intentionally has one matching
      // non-fallback rule and the sole fallback rule with the same ending id.
      const ruleKey = `${rule.id}\u0000${rule.isFallback === true ? "fallback" : "normal"}`;
      if (ruleKeys.has(ruleKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", index, "id"],
          message: `duplicate ending rule id ${rule.id}`,
        });
      }
      ruleKeys.add(ruleKey);
    }
  },
);

export const AuthoredEndingRecordSchema = EndingRecordSchema;
export const Task5EndingRecordSchema = EndingRecordSchema;
export const EndingPresentationContractSchema = EndingPresentationSchema;

export const GoldenRouteDecisionSchema: z.ZodType<GoldenRouteDecision> = z
  .object({
    encounterId: ContentIdSchema,
    recommendedItemId: ContentIdSchema,
  })
  .strict();

export const WorldScoresSchema: z.ZodType<Record<WorldAxis, number>> = z
  .object({
    undead: FiniteNumberSchema,
    machine: FiniteNumberSchema,
    cosmic: FiniteNumberSchema,
    spirit: FiniteNumberSchema,
  })
  .strict();

export const CustomerStatesSchema: z.ZodType<Record<string, string>> = z.record(
  NonBlankTextSchema,
  NonBlankTextSchema,
);

const GoldenRouteFingerprintSchemaBase = z
  .object({
    endingId: EndingIdSchema,
    world: WorldScoresSchema,
    stability: FiniteNumberSchema,
    awareness: FiniteNumberSchema,
    convergenceAxis: WorldAxisSchema,
    customerStates: CustomerStatesSchema,
    flags: z.array(NonBlankTextSchema),
    encounterDecisionCount: NonNegativeIntegerSchema,
    completedDayCount: NonNegativeIntegerSchema,
    selectedNewsCount: NonNegativeIntegerSchema,
    readNewsCount: NonNegativeIntegerSchema,
  })
  .strict();

export const GoldenRouteFingerprintSchema: z.ZodType<GoldenRouteFingerprint> =
  GoldenRouteFingerprintSchemaBase;
export const GoldenRouteExpectedFingerprintSchema = GoldenRouteFingerprintSchema;

const GoldenRouteSchemaBase = z
  .object({
    id: ContentIdSchema,
    decisions: z.array(GoldenRouteDecisionSchema).min(1),
    expected: GoldenRouteFingerprintSchema,
  })
  .strict();

/** Route-local determinism: one encounter may only receive one recommendation. */
export const GoldenRouteSchema: z.ZodType<GoldenRoute> = GoldenRouteSchemaBase.superRefine(
  (route, context) => {
    const encounterIds = new Set<string>();
    for (const [index, decision] of route.decisions.entries()) {
      if (encounterIds.has(decision.encounterId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decisions", index, "encounterId"],
          message: `duplicate golden route encounter id ${decision.encounterId}`,
        });
      }
      encounterIds.add(decision.encounterId);
    }
  },
);

export const Task5GoldenRouteSchema = GoldenRouteSchema;

const EndingBundleSchemaBase = z
  .object({
    contentVersion: NonBlankTextSchema,
    records: z.array(EndingRecordSchema).min(1),
    routes: z.array(GoldenRouteSchema).min(1),
  })
  .strict();

export const EndingBundleSchema: z.ZodType<EndingBundle> = EndingBundleSchemaBase;
export const Task5EndingBundleSchema = EndingBundleSchema;

export function parseEndingBundle(input: unknown): EndingBundle {
  return EndingBundleSchema.parse(input);
}

export const parseTask5EndingBundle = parseEndingBundle;
