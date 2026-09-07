import { DAYS, type Day } from "../domain/constants";
import type { Effect, RecommendationPair } from "../domain";
import type { AuthoredEncounter, Task5Content } from "./types";

/** The immutable relationship record for one authored runtime slot. */
export interface SemanticReferenceSlot {
  readonly day: Day;
  readonly fallbackEncounterId: string;
  readonly candidateEncounterIds: readonly string[];
}

/**
 * The semantic references that can be produced or referenced by Task 5.
 *
 * All collections returned by the builder are detached from the supplied
 * content, sorted, and deeply frozen. Records intentionally use plain
 * objects rather than Map/Set so the registry is serialisable and stable.
 */
export interface SemanticReferenceRegistry {
  readonly flags: readonly string[];
  readonly customerIds: readonly string[];
  readonly customerStates: Readonly<Record<string, readonly string[]>>;
  readonly goldenRouteIds: readonly string[];
  readonly encounterDays: Readonly<Record<string, Day>>;
  readonly days: Readonly<Record<Day, readonly string[]>>;
  readonly slots: Readonly<Record<string, SemanticReferenceSlot>>;
  readonly newsIds: readonly string[];
  readonly newsDays: Readonly<Record<string, Day>>;

  /** Compatibility aliases keep the underlying contract discoverable by name. */
  readonly producedFlags: readonly string[];
  readonly flagIds: readonly string[];
  readonly statesByCustomer: Readonly<Record<string, readonly string[]>>;
  readonly encounterDayById: Readonly<Record<string, Day>>;
  readonly newsDayById: Readonly<Record<string, Day>>;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function sortedRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  const record: Record<string, T> = {};
  for (const [key, value] of [...entries].sort(([left], [right]) => compareStrings(left, right))) {
    record[key] = value;
  }
  return record;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function sameRecommendation(
  pair: RecommendationPair,
  encounter: AuthoredEncounter,
  recommendedItemId: string,
): boolean {
  return (
    pair.customerId === encounter.customerId &&
    pair.requestedItemId === encounter.requestedItemId &&
    pair.recommendedItemId === recommendedItemId
  );
}

function collectEffects(
  effects: readonly Effect[],
  flags: Set<string>,
  customerStates: Map<string, Set<string>>,
): void {
  for (const effect of effects) {
    if (effect.kind === "setFlag") {
      flags.add(effect.id);
    } else if (effect.kind === "setCustomerState") {
      customerStates.get(effect.customerId)?.add(effect.state);
    }
  }
}

function addOutcomeEffects(
  outcome: { readonly effects: readonly Effect[] },
  flags: Set<string>,
  customerStates: Map<string, Set<string>>,
): void {
  collectEffects(outcome.effects, flags, customerStates);
}

function addEncounterOutcomeEffects(
  content: Task5Content,
  flags: Set<string>,
  customerStates: Map<string, Set<string>>,
): void {
  for (const encounter of content.encounters) {
    addOutcomeEffects(encounter.outcomes.sell, flags, customerStates);
    addOutcomeEffects(encounter.outcomes.refuse, flags, customerStates);
    addOutcomeEffects(encounter.outcomes.defaultRecommend, flags, customerStates);
  }
}

function addRecommendationEffects(
  content: Task5Content,
  flags: Set<string>,
  customerStates: Map<string, Set<string>>,
): void {
  for (const pair of content.recommendationPairs) {
    // A pair's own outcome is authored and therefore always part of the
    // producer graph, even while malformed content is being diagnosed.
    addOutcomeEffects(pair.outcome, flags, customerStates);

    for (const encounter of content.encounters) {
      const matches = encounter.recommendationOptions.some((option) =>
        sameRecommendation(pair, encounter, option.itemId),
      );
      if (!matches || pair.mode !== "append-base-sale") {
        continue;
      }

      // append-base-sale is the effective base sale followed by the pair;
      // replace-base-sale intentionally contributes no base-sale effects.
      addOutcomeEffects(encounter.outcomes.sell, flags, customerStates);
    }
  }
}

function addNewsEffects(
  content: Task5Content,
  flags: Set<string>,
  customerStates: Map<string, Set<string>>,
): void {
  for (const article of content.news) {
    collectEffects(article.effectsOnRead, flags, customerStates);
  }
}

function addConvergenceEffects(
  content: Task5Content,
  flags: Set<string>,
  customerStates: Map<string, Set<string>>,
): void {
  // The refusal effect is synthesized by the Task 5 runtime from metadata.
  flags.add(content.day5Convergence.refusalFlagId);
  void customerStates;
}

function buildEncounterDays(content: Task5Content): Record<string, Day> {
  const encounterDays = new Map<string, Day>();
  const plans = [...content.dayPlans].sort((left, right) => left.day - right.day);
  for (const plan of plans) {
    const slots = [...plan.slots].sort((left, right) => compareStrings(left.id, right.id));
    for (const slot of slots) {
      // Canonical fallback ownership is the only authored day provenance for
      // an encounter. Valid Task 5 content assigns each fallback exactly once.
      if (!encounterDays.has(slot.fallbackEncounterId)) {
        encounterDays.set(slot.fallbackEncounterId, plan.day);
      }
    }
  }
  return sortedRecord(encounterDays.entries());
}

function buildDayAndSlotReferences(content: Task5Content): {
  days: Record<Day, readonly string[]>;
  slots: Record<string, SemanticReferenceSlot>;
} {
  const daySlots = new Map<Day, string[]>();
  for (const day of DAYS) {
    daySlots.set(day, []);
  }

  const slotEntries: Array<readonly [string, SemanticReferenceSlot]> = [];
  const plans = [...content.dayPlans].sort((left, right) => left.day - right.day);
  for (const plan of plans) {
    const slotIds = daySlots.get(plan.day) ?? [];
    for (const slot of plan.slots) {
      slotIds.push(slot.id);
      slotEntries.push([
        slot.id,
        {
          day: plan.day,
          fallbackEncounterId: slot.fallbackEncounterId,
          candidateEncounterIds: sortedStrings(slot.candidates.map((candidate) => candidate.encounterId)),
        },
      ]);
    }
    daySlots.set(plan.day, slotIds);
  }

  const days = {} as Record<Day, readonly string[]>;
  for (const day of DAYS) {
    days[day] = sortedStrings(daySlots.get(day) ?? []);
  }

  return {
    days,
    slots: sortedRecord(slotEntries),
  };
}

function defineAliases(
  registry: Omit<SemanticReferenceRegistry, "producedFlags" | "flagIds" | "statesByCustomer" | "encounterDayById" | "newsDayById">,
): SemanticReferenceRegistry {
  Object.defineProperties(registry, {
    producedFlags: { enumerable: false, value: registry.flags },
    flagIds: { enumerable: false, value: registry.flags },
    statesByCustomer: { enumerable: false, value: registry.customerStates },
    encounterDayById: { enumerable: false, value: registry.encounterDays },
    newsDayById: { enumerable: false, value: registry.newsDays },
  });
  return registry as SemanticReferenceRegistry;
}

/**
 * Builds the detached semantic-reference registry for supplied Task 5 content.
 * No catalog constants are consulted, so the result always follows the input.
 */
export function buildSemanticReferenceRegistry(content: Task5Content): SemanticReferenceRegistry {
  const customerIds = sortedStrings(content.customers.map((customer) => customer.id));
  const knownCustomerIds = new Set(customerIds);
  const customerStateSets = new Map<string, Set<string>>(
    customerIds.map((customerId) => [customerId, new Set<string>()]),
  );
  const flags = new Set<string>();

  // Optional conversations and handed receipts are also producers of durable flags.
  for (const encounter of content.encounters) {
    for (const question of encounter.questions ?? []) {
      flags.add(question.id);
      collectEffects(question.effects, flags, customerStateSets);
    }
    if (encounter.receiptReply) {
      flags.add(`receipt_${encounter.id}`);
      flags.add(`receipt_witness_${encounter.customerId}`);
    }
  }

  addEncounterOutcomeEffects(content, flags, customerStateSets);
  addRecommendationEffects(content, flags, customerStateSets);
  addNewsEffects(content, flags, customerStateSets);
  addConvergenceEffects(content, flags, customerStateSets);

  const customerStates = sortedRecord(
    customerIds.map((customerId) => [
      customerId,
      sortedStrings(customerStateSets.get(customerId) ?? []),
    ] as const),
  );
  const newsEntries = content.news.map((article) => [article.id, article.day] as const);
  const { days, slots } = buildDayAndSlotReferences(content);

  const baseRegistry = {
    flags: sortedStrings(flags),
    customerIds: [...customerIds],
    customerStates,
    goldenRouteIds: sortedStrings(content.goldenRoutes.map((route) => route.id)),
    encounterDays: buildEncounterDays(content),
    days,
    slots,
    newsIds: sortedStrings(content.news.map((article) => article.id)),
    newsDays: sortedRecord(newsEntries),
  };

  // Keep the unused set explicit: it documents that unknown producing effects
  // are intentionally not promoted into a known customer's state provenance.
  void knownCustomerIds;
  return deepFreeze(defineAliases(baseRegistry));
}

/** Task-5-specific spelling retained as the primary integration API. */
export const buildTask5SemanticReferenceRegistry = buildSemanticReferenceRegistry;

/** Readable factory alias for callers that prefer create-style naming. */
export const createSemanticReferenceRegistry = buildSemanticReferenceRegistry;
