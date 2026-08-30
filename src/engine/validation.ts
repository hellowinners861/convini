import { isUnconditionalCondition } from "./conditions";
import { validateOutcomeEffects } from "./effects";
import { ContentValidationError } from "./errors";
import { DAY5_ANOMALY_COUNT, WORLD_AXES } from "../domain/constants";
import type {
  Day,
  Day5AnomalySlot,
  EndingDefinition,
  EncounterSlot,
  NewsArticle,
  RecommendationPair,
  Outcome,
} from "../domain";

export { ContentValidationError } from "./errors";

export function assertUniqueIds<T extends { id: string }>(items: T[], label: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  if (duplicates.size > 0) {
    throw new ContentValidationError(`Duplicate ${label} id`, [...duplicates]);
  }
}

export function validateEncounterSlots(
  slots: EncounterSlot[],
  availableEncounterIds?: Iterable<string>,
): void {
  const issues: string[] = [];
  const seenSlotIds = new Set<string>();
  const availableIds = availableEncounterIds ? new Set(availableEncounterIds) : undefined;

  for (const slot of slots) {
    if (seenSlotIds.has(slot.id)) {
      issues.push(`duplicate slot id ${slot.id}`);
    }
    seenSlotIds.add(slot.id);

    if (slot.fallbackEncounterId.length === 0) {
      issues.push(`slot ${slot.id} is missing fallbackEncounterId`);
    }

    if (availableIds && !availableIds.has(slot.fallbackEncounterId)) {
      issues.push(`slot ${slot.id} references missing fallback ${slot.fallbackEncounterId}`);
    }

    for (const candidate of slot.candidates) {
      if (availableIds && !availableIds.has(candidate.encounterId)) {
        issues.push(`slot ${slot.id} references missing encounter ${candidate.encounterId}`);
      }
    }
  }

  if (issues.length > 0) {
    throw new ContentValidationError("Invalid encounter slots", issues);
  }
}

export function validateDay5AnomalySlots(slots: Day5AnomalySlot[]): void {
  const issues: string[] = [];
  const slotIds = new Set<string>();
  const customerIds = new Set<string>();
  const axes = new Set<string>();

  if (slots.length !== DAY5_ANOMALY_COUNT) {
    issues.push(`day 5 requires ${DAY5_ANOMALY_COUNT} anomaly slots, received ${slots.length}`);
  }

  for (const slot of slots) {
    if (slot.slotId.length === 0) {
      issues.push("day 5 anomaly slot is missing slotId");
    }
    if (slot.customerId.length === 0) {
      issues.push(`day 5 anomaly ${slot.slotId} is missing customerId`);
    }
    if (slotIds.has(slot.slotId)) {
      issues.push(`duplicate day 5 anomaly slot id ${slot.slotId}`);
    }
    if (customerIds.has(slot.customerId)) {
      issues.push(`duplicate day 5 anomaly customer ${slot.customerId}`);
    }
    if (axes.has(slot.axis)) {
      issues.push(`duplicate day 5 anomaly axis ${slot.axis}`);
    }
    if (!Number.isFinite(slot.unresolvedness)) {
      issues.push(`day 5 anomaly ${slot.slotId} has non-finite unresolvedness`);
    }
    slotIds.add(slot.slotId);
    customerIds.add(slot.customerId);
    axes.add(slot.axis);
  }

  if (axes.size === DAY5_ANOMALY_COUNT && WORLD_AXES.some((axis) => !axes.has(axis))) {
    issues.push("day 5 anomaly slots must cover all world axes");
  }

  if (issues.length > 0) {
    throw new ContentValidationError("Invalid day 5 anomaly ordering", issues);
  }
}

export function validateDailyEncounterSlots(
  day: Day,
  slots: EncounterSlot[],
  availableEncounterIds?: Iterable<string>,
): void {
  const issues: string[] = [];
  if (slots.length < 5 || slots.length > 6) {
    issues.push(`day ${day} must have 5 or 6 slots, received ${slots.length}`);
  }

  try {
    validateEncounterSlots(slots, availableEncounterIds);
  } catch (error) {
    if (error instanceof ContentValidationError) {
      issues.push(...error.issues);
    } else {
      throw error;
    }
  }

  if (issues.length > 0) {
    throw new ContentValidationError("Invalid daily encounter plan", issues);
  }
}

export interface RecommendationValidationOptions {
  baseSale?: Outcome;
  defaultOutcome?: Outcome;
}

export function validateRecommendationPairs(
  pairs: RecommendationPair[],
  options: RecommendationValidationOptions = {},
): void {
  assertUniqueIds(pairs, "recommendation pair");
  const issues: string[] = [];
  const samePriorityTriples = new Set<string>();

  const validateOutcome = (outcome: Outcome, label: string): void => {
    try {
      validateOutcomeEffects(outcome);
    } catch (error) {
      if (error instanceof ContentValidationError) {
        issues.push(...error.issues.map((issue) => `${label}: ${issue}`));
      } else {
        throw error;
      }
    }
  };

  if (options.baseSale) {
    validateOutcome(options.baseSale, `base sale ${options.baseSale.id}`);
  }
  if (options.defaultOutcome) {
    validateOutcome(options.defaultOutcome, `default outcome ${options.defaultOutcome.id}`);
  }

  for (const pair of pairs) {
    const triple = `${pair.customerId}\u0000${pair.requestedItemId}\u0000${pair.recommendedItemId}`;
    const priorityKey = `${triple}\u0000${pair.priority}`;
    if (samePriorityTriples.has(priorityKey)) {
      issues.push(`ambiguous same-priority pair ${pair.id} for ${triple}`);
    }
    samePriorityTriples.add(priorityKey);
    validateOutcome(pair.outcome, `pair ${pair.id}`);

    if (pair.mode === "append-base-sale" && options.baseSale) {
      validateOutcome(
        {
          id: `${options.baseSale.id}::${pair.outcome.id}`,
          effects: [...options.baseSale.effects, ...pair.outcome.effects],
        },
        `effective pair ${pair.id}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new ContentValidationError("Invalid recommendation pairs", issues);
  }
}

export function validateNewsCatalog(articles: NewsArticle[], days: Day[]): void {
  assertUniqueIds(articles, "news");
  const issues: string[] = [];

  for (const article of articles) {
    if (article.role === "local" && article.day !== 1) {
      issues.push(`local news ${article.id} is only allowed on day 1`);
    }
    if (article.isFallback && !isUnconditionalCondition(article.conditions)) {
      issues.push(`fallback news ${article.id} must have an unconditional condition`);
    }
    try {
      validateOutcomeEffects({ id: article.id, effects: article.effectsOnRead });
    } catch (error) {
      if (error instanceof ContentValidationError) {
        issues.push(...error.issues.map((issue) => `news ${article.id}: ${issue}`));
      } else {
        throw error;
      }
    }
  }

  for (const day of days) {
    const dayArticles = articles.filter((article) => article.day === day);
    const slotRoles = ["direct", "trend", "discrepancy"] as const;

    for (const slot of slotRoles) {
      const allowedRoles = day === 1 && slot === "discrepancy" ? [slot, "local"] : [slot];
      const fallbacks = dayArticles.filter(
        (article) => article.isFallback && allowedRoles.includes(article.role as (typeof allowedRoles)[number]),
      );

      if (fallbacks.length === 0) {
        issues.push(`day ${day} slot ${slot} is missing fallback`);
      } else if (fallbacks.length > 1) {
        issues.push(`day ${day} slot ${slot} has multiple fallbacks`);
      }
    }

  }

  if (issues.length > 0) {
    throw new ContentValidationError("Invalid news catalog", issues);
  }
}

export function validateEndingRules(rules: EndingDefinition[]): void {
  const fallbackRules = rules.filter((rule) => rule.isFallback === true);
  const issues: string[] = [];

  if (fallbackRules.length !== 1) {
    issues.push(`expected exactly one ending fallback, received ${fallbackRules.length}`);
  }

  if (fallbackRules.some((rule) => !isUnconditionalCondition(rule.condition))) {
    issues.push("ending fallback must have an unconditional condition");
  }

  const seenIds = new Map<string, EndingDefinition[]>();
  for (const rule of rules) {
    const sameId = seenIds.get(rule.id) ?? [];
    sameId.push(rule);
    seenIds.set(rule.id, sameId);
  }

  for (const [id, sameId] of seenIds) {
    if (sameId.length > 1 && sameId.filter((rule) => rule.isFallback !== true).length > 1) {
      issues.push(`duplicate non-fallback ending id ${id}`);
    }
  }

  if (issues.length > 0) {
    throw new ContentValidationError("Invalid ending rules", issues);
  }
}
