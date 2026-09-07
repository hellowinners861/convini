import { z } from "zod";
import {
  ConditionSchema,
  Day5AnomalySlotSchema,
  ENDING_IDS,
  EffectSchema,
  EndingDefinitionSchema,
  EncounterSlotSchema,
  NewsArticleSchema,
  OutcomeSchema,
  WORLD_AXES,
} from "../domain";
import type { Day, NewsArticle } from "../domain";
import type {
  AuthoredContent,
  AuthoredDayPlan,
  AuthoredEncounter,
  AuthoredOutcome,
  AuthoredRecommendationPair,
  BriefingPresentation,
  ConditionalNarrative,
  CustomerDefinition,
  DailyPresentation,
  Day5ConvergenceMetadata,
  EncounterOutcomeSet,
  ItemDefinition,
  Narrative,
  NarrativeVariant,
  RecommendationOption,
  ResultCopy,
  ShiftSummaryPresentation,
  Task5Content,
} from "./types";
import type {
  EndingRecord,
  GoldenRoute,
  GoldenRouteDecision,
  GoldenRouteFingerprint,
  EndingPresentation,
} from "./endings/contracts";

const NonEmptyTextSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "must not be blank");
const ContentIdSchema = NonEmptyTextSchema;
const FiniteNumberSchema = z.number().finite();
const DaySchema: z.ZodType<Day> = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const WorldAxisSchema = z.enum(WORLD_AXES);

export const NarrativeVariantSchema: z.ZodType<NarrativeVariant> = z
  .object({
    id: ContentIdSchema,
    condition: ConditionSchema,
    priority: FiniteNumberSchema,
    text: NonEmptyTextSchema,
  })
  .strict();

export const ConditionalNarrativeSchema: z.ZodType<ConditionalNarrative> = z
  .object({
    variants: z.array(NarrativeVariantSchema),
    fallback: NonEmptyTextSchema,
  })
  .strict()
  .superRefine((narrative, context) => {
    const ids = new Set<string>();
    for (const [index, variant] of narrative.variants.entries()) {
      if (ids.has(variant.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", index, "id"],
          message: `duplicate narrative variant id ${variant.id}`,
        });
      }
      ids.add(variant.id);
    }
  });

export const NarrativeSchema: z.ZodType<Narrative> = z.union([
  NonEmptyTextSchema,
  ConditionalNarrativeSchema,
]);

export const ResultCopySchema: z.ZodType<ResultCopy> = z
  .object({
    result: NarrativeSchema,
    readback: NarrativeSchema,
    receipt: NarrativeSchema,
  })
  .strict();

export const OrdinaryItemDefinitionSchema = z
  .object({
    id: ContentIdSchema,
    kind: z.literal("ordinary"),
    name: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    price: FiniteNumberSchema.nonnegative(),
  })
  .strict();

export const AbnormalItemDefinitionSchema = z
  .object({
    id: ContentIdSchema,
    kind: z.literal("abnormal"),
    name: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    price: FiniteNumberSchema.nonnegative(),
    axis: WorldAxisSchema,
    anomalyRole: z.enum(["base", "coexist", "runaway"]),
  })
  .strict();

export const ItemDefinitionSchema: z.ZodType<ItemDefinition> = z.discriminatedUnion("kind", [
  OrdinaryItemDefinitionSchema,
  AbnormalItemDefinitionSchema,
]);

export const CustomerDefinitionSchema: z.ZodType<CustomerDefinition> = z
  .object({
    id: ContentIdSchema,
    name: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    axis: WorldAxisSchema.optional(),
    role: z.enum(["major", "incidental", "staff"]),
  })
  .strict();

export const RecommendationOptionSchema: z.ZodType<RecommendationOption> = z
  .object({
    id: ContentIdSchema,
    itemId: ContentIdSchema,
    label: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    resultCopy: ResultCopySchema,
  })
  .strict();

export const AuthoredOutcomeSchema: z.ZodType<AuthoredOutcome> = z
  .object({
    id: ContentIdSchema,
    effects: z.array(EffectSchema),
    copy: ResultCopySchema,
  })
  .strict();

export const AuthoredRecommendationPairSchema: z.ZodType<AuthoredRecommendationPair> = z
  .object({
    id: ContentIdSchema,
    customerId: ContentIdSchema,
    requestedItemId: ContentIdSchema,
    recommendedItemId: ContentIdSchema,
    conditions: ConditionSchema,
    priority: FiniteNumberSchema,
    mode: z.enum(["append-base-sale", "replace-base-sale"]),
    outcome: OutcomeSchema,
  })
  .strict();

export const EncounterOutcomeSetSchema: z.ZodType<EncounterOutcomeSet> = z
  .object({
    sell: AuthoredOutcomeSchema,
    refuse: AuthoredOutcomeSchema,
    defaultRecommend: AuthoredOutcomeSchema,
  })
  .strict();

export const AuthoredEncounterSchema: z.ZodType<AuthoredEncounter> = z
  .object({
    id: ContentIdSchema,
    customerId: ContentIdSchema,
    requestedItemId: ContentIdSchema,
    intro: NarrativeSchema,
    scan: NarrativeSchema,
    recommendationOptions: z.array(RecommendationOptionSchema).min(1),
    outcomes: EncounterOutcomeSetSchema,
    questions: z.array(z.object({
      id: ContentIdSchema,
      label: NonEmptyTextSchema,
      reply: NonEmptyTextSchema,
      conditions: ConditionSchema,
      effects: z.array(EffectSchema),
    }).strict()).optional(),
    receiptReply: NarrativeSchema.optional(),
  })
  .strict();

export const BriefingPresentationSchema: z.ZodType<BriefingPresentation> = z
  .object({
    eyebrow: NarrativeSchema,
    heading: NarrativeSchema,
    body: NarrativeSchema,
    checklist: z.array(NonEmptyTextSchema).min(1),
  })
  .strict();

export const ShiftSummaryPresentationSchema: z.ZodType<ShiftSummaryPresentation> = z
  .object({
    heading: NarrativeSchema,
    body: NarrativeSchema,
    nextAction: NarrativeSchema,
  })
  .strict();

export const DailyPresentationSchema: z.ZodType<DailyPresentation> = z
  .object({
    day: DaySchema,
    briefing: BriefingPresentationSchema,
    shiftSummary: ShiftSummaryPresentationSchema,
  })
  .strict();

export const AuthoredDayPlanSchema: z.ZodType<AuthoredDayPlan> = z
  .object({
    day: DaySchema,
    slots: z.array(EncounterSlotSchema),
    day5AnomalyOrder: z.array(Day5AnomalySlotSchema).optional(),
    revenueTarget: FiniteNumberSchema.nonnegative(),
    presentation: DailyPresentationSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.presentation.day !== plan.day) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["presentation", "day"],
        message: "presentation day must match plan day",
      });
    }
    if (plan.day === 5 && !plan.day5AnomalyOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["day5AnomalyOrder"],
        message: "day 5 plans require anomaly ordering metadata",
      });
    }
    if (plan.day !== 5 && plan.day5AnomalyOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["day5AnomalyOrder"],
        message: "day 5 anomaly ordering is only valid on day 5",
      });
    }
  });

export const Day5ConvergenceMetadataSchema: z.ZodType<Day5ConvergenceMetadata> = z
  .object({
    day: z.literal(5),
    finalQueueIndex: FiniteNumberSchema.int().nonnegative(),
    successfulSaleAxisBonus: FiniteNumberSchema,
    refusalStabilityDelta: FiniteNumberSchema,
    refusalFlagId: ContentIdSchema,
  })
  .strict();

const AuthoredContentSchemaBase = z
  .object({
    contentVersion: ContentIdSchema,
    items: z.array(ItemDefinitionSchema).min(1),
    customers: z.array(CustomerDefinitionSchema).min(1),
    encounters: z.array(AuthoredEncounterSchema).min(1),
    recommendationPairs: z.array(AuthoredRecommendationPairSchema),
    dayPlans: z.array(AuthoredDayPlanSchema).min(1),
    day5Convergence: Day5ConvergenceMetadataSchema,
  })
  .strict();

const Task5NewsArticleSchema: z.ZodType<NewsArticle> = NewsArticleSchema.superRefine(
  (article, context) => {
    for (const field of ["id", "notificationHeadline", "headline", "body"] as const) {
      if (article[field].trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "must not be blank",
        });
      }
    }
    if (article.exclusiveGroup !== undefined && article.exclusiveGroup.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exclusiveGroup"],
        message: "must not be blank",
      });
    }
  },
);

const Task5EndingPresentationSchema: z.ZodType<EndingPresentation> = z
  .object({
    title: NonEmptyTextSchema,
    lead: NarrativeSchema,
    body: ConditionalNarrativeSchema,
    finalLine: ConditionalNarrativeSchema,
    runSummary: NarrativeSchema,
  })
  .strict();

const Task5EndingRecordSchema: z.ZodType<EndingRecord> = z
  .object({
    id: z.enum(ENDING_IDS),
    rules: z.array(EndingDefinitionSchema).min(1),
    presentation: Task5EndingPresentationSchema,
  })
  .strict()
  .superRefine((record, context) => {
    const ruleKeys = new Set<string>();
    for (const [index, rule] of record.rules.entries()) {
      const key = `${rule.id}\u0000${rule.isFallback === true ? "fallback" : "normal"}`;
      if (ruleKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", index, "id"],
          message: `duplicate ending rule id ${rule.id}`,
        });
      }
      ruleKeys.add(key);
    }
  });

const Task5GoldenRouteDecisionSchema: z.ZodType<GoldenRouteDecision> = z
  .object({
    encounterId: ContentIdSchema,
    recommendedItemId: ContentIdSchema,
  })
  .strict();

const Task5WorldScoresSchema = z
  .object({
    undead: FiniteNumberSchema,
    machine: FiniteNumberSchema,
    cosmic: FiniteNumberSchema,
    spirit: FiniteNumberSchema,
  })
  .strict();

const Task5CustomerStatesSchema = z.record(NonEmptyTextSchema, NonEmptyTextSchema);

const Task5GoldenRouteFingerprintSchema: z.ZodType<GoldenRouteFingerprint> = z
  .object({
    endingId: z.enum(ENDING_IDS),
    world: Task5WorldScoresSchema,
    stability: FiniteNumberSchema,
    awareness: FiniteNumberSchema,
    convergenceAxis: WorldAxisSchema,
    customerStates: Task5CustomerStatesSchema,
    flags: z.array(NonEmptyTextSchema),
    encounterDecisionCount: FiniteNumberSchema.int().nonnegative(),
    completedDayCount: FiniteNumberSchema.int().nonnegative(),
    selectedNewsCount: FiniteNumberSchema.int().nonnegative(),
    readNewsCount: FiniteNumberSchema.int().nonnegative(),
  })
  .strict();

const Task5GoldenRouteSchema: z.ZodType<GoldenRoute> = z
  .object({
    id: ContentIdSchema,
    decisions: z.array(Task5GoldenRouteDecisionSchema).min(1),
    expected: Task5GoldenRouteFingerprintSchema,
  })
  .strict()
  .superRefine((route, context) => {
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
  });

const Task5ContentSchemaBase = z
  .object({
    contentVersion: ContentIdSchema,
    items: z.array(ItemDefinitionSchema).min(1),
    customers: z.array(CustomerDefinitionSchema).min(1),
    encounters: z.array(AuthoredEncounterSchema).min(1),
    recommendationPairs: z.array(AuthoredRecommendationPairSchema),
    dayPlans: z.array(AuthoredDayPlanSchema).min(1),
    day5Convergence: Day5ConvergenceMetadataSchema,
    news: z.array(Task5NewsArticleSchema).min(1),
    endingRecords: z.array(Task5EndingRecordSchema).min(1),
    goldenRoutes: z.array(Task5GoldenRouteSchema).min(1),
  })
  .strict();

function addReferenceIssue(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

function checkUniqueIds(
  values: Array<{ id: string }>,
  label: string,
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value.id)) {
      addReferenceIssue(context, [...path, index, "id"], `duplicate ${label} id ${value.id}`);
    }
    seen.add(value.id);
  }
}

function refineAuthoredContentShape(
  content: AuthoredContent,
  context: z.RefinementCtx,
): void {
    checkUniqueIds(content.items, "item", context, ["items"]);
    checkUniqueIds(content.customers, "customer", context, ["customers"]);
    checkUniqueIds(content.encounters, "encounter", context, ["encounters"]);
    checkUniqueIds(content.recommendationPairs, "recommendation pair", context, ["recommendationPairs"]);

    const itemIds = new Set(content.items.map((item) => item.id));
    const customerIds = new Set(content.customers.map((customer) => customer.id));
    const encounterIds = new Set(content.encounters.map((encounter) => encounter.id));
    const planDays = new Set<Day>();
    const planSlotIds = new Set<string>();

    for (const [encounterIndex, encounter] of content.encounters.entries()) {
      if (!customerIds.has(encounter.customerId)) {
        addReferenceIssue(
          context,
          ["encounters", encounterIndex, "customerId"],
          `unknown customer ${encounter.customerId}`,
        );
      }
      if (!itemIds.has(encounter.requestedItemId)) {
        addReferenceIssue(
          context,
          ["encounters", encounterIndex, "requestedItemId"],
          `unknown requested item ${encounter.requestedItemId}`,
        );
      }

      checkUniqueIds(
        encounter.recommendationOptions,
        "recommendation option",
        context,
        ["encounters", encounterIndex, "recommendationOptions"],
      );
      for (const [optionIndex, option] of encounter.recommendationOptions.entries()) {
        if (!itemIds.has(option.itemId)) {
          addReferenceIssue(
            context,
            ["encounters", encounterIndex, "recommendationOptions", optionIndex, "itemId"],
            `unknown recommendation item ${option.itemId}`,
          );
        }
      }

      const outcomeIds = new Set<string>();
      const outcomes = [
        ["sell", encounter.outcomes.sell],
        ["refuse", encounter.outcomes.refuse],
        ["defaultRecommend", encounter.outcomes.defaultRecommend],
      ] as const;
      for (const [outcomeName, outcome] of outcomes) {
        if (outcomeIds.has(outcome.id)) {
          addReferenceIssue(
            context,
            ["encounters", encounterIndex, "outcomes", outcomeName, "id"],
            `duplicate encounter outcome id ${outcome.id}`,
          );
        }
        outcomeIds.add(outcome.id);
      }

    }

    const pairKeys = new Set<string>();
    for (const [pairIndex, pair] of content.recommendationPairs.entries()) {
      if (!customerIds.has(pair.customerId)) {
        addReferenceIssue(
          context,
          ["recommendationPairs", pairIndex, "customerId"],
          `unknown recommendation customer ${pair.customerId}`,
        );
      }
      if (!itemIds.has(pair.requestedItemId)) {
        addReferenceIssue(
          context,
          ["recommendationPairs", pairIndex, "requestedItemId"],
          `unknown recommendation requested item ${pair.requestedItemId}`,
        );
      }
      if (!itemIds.has(pair.recommendedItemId)) {
        addReferenceIssue(
          context,
          ["recommendationPairs", pairIndex, "recommendedItemId"],
          `unknown recommendation item ${pair.recommendedItemId}`,
        );
      }

      const key = [
        pair.customerId,
        pair.requestedItemId,
        pair.recommendedItemId,
        pair.priority,
      ].join("\u0000");
      if (pairKeys.has(key)) {
        addReferenceIssue(
          context,
          ["recommendationPairs", pairIndex],
          "ambiguous same-priority recommendation pair",
        );
      }
      pairKeys.add(key);

      const hasMatchingOption = content.encounters.some(
        (encounter) =>
          encounter.customerId === pair.customerId &&
          encounter.requestedItemId === pair.requestedItemId &&
          encounter.recommendationOptions.some((option) => option.itemId === pair.recommendedItemId),
      );
      if (!hasMatchingOption) {
        addReferenceIssue(
          context,
          ["recommendationPairs", pairIndex],
          "recommendation pair has no matching encounter and option",
        );
      }
    }

    for (const [planIndex, plan] of content.dayPlans.entries()) {
      if (planDays.has(plan.day)) {
        addReferenceIssue(context, ["dayPlans", planIndex, "day"], `duplicate day plan ${plan.day}`);
      }
      planDays.add(plan.day);

      for (const [slotIndex, slot] of plan.slots.entries()) {
        if (planSlotIds.has(slot.id)) {
          addReferenceIssue(
            context,
            ["dayPlans", planIndex, "slots", slotIndex, "id"],
            `duplicate encounter slot id ${slot.id}`,
          );
        }
        planSlotIds.add(slot.id);

        if (!encounterIds.has(slot.fallbackEncounterId)) {
          addReferenceIssue(
            context,
            ["dayPlans", planIndex, "slots", slotIndex, "fallbackEncounterId"],
            `unknown fallback encounter ${slot.fallbackEncounterId}`,
          );
        }
        for (const [candidateIndex, candidate] of slot.candidates.entries()) {
          if (!encounterIds.has(candidate.encounterId)) {
            addReferenceIssue(
              context,
              ["dayPlans", planIndex, "slots", slotIndex, "candidates", candidateIndex, "encounterId"],
              `unknown candidate encounter ${candidate.encounterId}`,
            );
          }
        }
      }
    }

}

export const AuthoredContentSchema: z.ZodType<AuthoredContent> =
  AuthoredContentSchemaBase.superRefine(refineAuthoredContentShape);

export const Task5ContentSchema: z.ZodType<Task5Content> = Task5ContentSchemaBase.superRefine(
  (content, context) => refineAuthoredContentShape(content, context),
);

export const AuthoredItemSchema = ItemDefinitionSchema;
export const AuthoredCustomerSchema = CustomerDefinitionSchema;
export const AuthoredRecommendationOptionSchema = RecommendationOptionSchema;
export const DailyPlanSchema = AuthoredDayPlanSchema;
export const Task4ContentSchema = AuthoredContentSchema;

export function parseAuthoredContent(input: unknown): AuthoredContent {
  return AuthoredContentSchema.parse(input);
}

export function parseTask5Content(input: unknown): Task5Content {
  return Task5ContentSchema.parse(input);
}
