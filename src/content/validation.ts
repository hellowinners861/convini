import {
  DAYS,
  ENDING_IDS,
  ENDING_TITLES,
  NEWS_SLOTS,
  WORLD_AXES,
  type Day,
  type WorldAxis,
} from "../domain/constants";
import type {
  Condition,
  EndingDefinition,
  EndingResolution,
  Effect,
  GameState,
  NewsArticle,
  NewsSelection,
  Outcome,
  RecommendationPair,
} from "../domain";
import { createInitialGameState } from "../domain";
import {
  applyOutcome,
  commitNewsSelections,
  determineEnding,
  readNewsArticle,
  resolveEncounterQueue,
  resolveRecommendation,
  selectNewsForDay,
  validateOutcomeEffects,
} from "../engine";
import { ContentValidationError } from "../engine/errors";
import { isUnconditionalCondition } from "../engine/conditions";
import {
  validateDay5AnomalySlots,
  validateEndingRules,
  validateRecommendationPairs,
} from "../engine/validation";
import { TASK4_CONTENT_VERSION, TASK5_CONTENT_VERSION } from "./config/game";
import {
  AuthoredContentSchema,
  Task5ContentSchema,
} from "./schemas";
import { TASK4_CUSTOMERS } from "./customers";
import { TASK4_DAY5_CONVERGENCE, TASK4_DAY_PLANS } from "./dayPlans";
import { TASK4_ENCOUNTERS } from "./encounters";
import { TASK4_ITEMS } from "./items";
import { TASK4_RECOMMENDATION_PAIRS } from "./pairs";
import { TASK5_NEWS } from "./news";
import { NewsCatalogSchema } from "./news/contracts";
import { EndingBundleSchema } from "./endings/contracts";
import { TASK5_ENDING_RECORDS } from "./endings/records";
import { TASK5_GOLDEN_ROUTES } from "./endings/routes";
import type {
  AuthoredContent,
  AuthoredEncounter,
  AuthoredOutcome,
  Task5Content,
  Narrative,
  ResultCopy,
} from "./types";
import type {
  GoldenRoute,
  GoldenRouteFingerprint,
  GoldenRouteDecision,
} from "./endings/contracts";
import {
  buildTask5SemanticReferenceRegistry,
  type SemanticReferenceRegistry,
} from "./semanticReferences";

const EXPECTED_SLOT_COUNTS: Record<Day, number> = {
  1: 5,
  2: 6,
  3: 6,
  4: 6,
  5: 6,
};

function addEngineIssues(issues: string[], label: string, error: unknown): void {
  if (error instanceof ContentValidationError) {
    issues.push(...error.issues.map((issue) => label + ": " + issue));
    return;
  }
  if (error instanceof Error) {
    issues.push(label + ": " + error.message);
    return;
  }
  issues.push(label + ": " + String(error));
}

function checkUniqueIds(
  values: readonly { id: string }[],
  label: string,
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) {
      issues.push("duplicate " + label + " id " + value.id);
    }
    seen.add(value.id);
  }
}

function visitCondition(
  condition: Condition,
  path: string,
  customerIds: Set<string>,
  issues: string[],
): void {
  if ("all" in condition) {
    condition.all.forEach((child, index) =>
      visitCondition(child, path + ".all[" + index + "]", customerIds, issues),
    );
  } else if ("any" in condition) {
    condition.any.forEach((child, index) =>
      visitCondition(child, path + ".any[" + index + "]", customerIds, issues),
    );
  } else if ("not" in condition) {
    visitCondition(condition.not, path + ".not", customerIds, issues);
  } else if ("customerState" in condition) {
    if (!customerIds.has(condition.customerState.customerId)) {
      issues.push(
        path +
          " references missing customer " +
          condition.customerState.customerId,
      );
    }
  }
}

function visitNarrative(
  narrative: Narrative,
  path: string,
  customerIds: Set<string>,
  issues: string[],
): void {
  if (typeof narrative === "string") {
    return;
  }
  narrative.variants.forEach((variant, index) =>
    visitCondition(
      variant.condition,
      path + ".variants[" + index + "].condition",
      customerIds,
      issues,
    ),
  );
}

function visitCopy(
  copy: ResultCopy,
  path: string,
  customerIds: Set<string>,
  issues: string[],
): void {
  visitNarrative(copy.result, path + ".result", customerIds, issues);
  visitNarrative(copy.readback, path + ".readback", customerIds, issues);
  visitNarrative(copy.receipt, path + ".receipt", customerIds, issues);
}

function checkOutcome(
  outcome: AuthoredOutcome | Outcome,
  path: string,
  customerIds: Set<string>,
  issues: string[],
): void {
  try {
    validateOutcomeEffects(outcome);
  } catch (error) {
    addEngineIssues(issues, path, error);
  }

  for (const [effectIndex, effect] of outcome.effects.entries()) {
    if (effect.kind === "setCustomerState" && !customerIds.has(effect.customerId)) {
      issues.push(
        path +
          ".effects[" +
          effectIndex +
          "] references missing customer " +
          effect.customerId,
      );
    }
  }
}

function checkEncounterReferences(
  content: AuthoredContent,
  itemIds: Set<string>,
  customerIds: Set<string>,
  issues: string[],
): void {
  const authoredOutcomeIds: Array<{ id: string }> = [];
  const recommendationOptionIds: Array<{ id: string }> = [];

  for (const [encounterIndex, encounter] of content.encounters.entries()) {
    if (!customerIds.has(encounter.customerId)) {
      issues.push(
        "encounters[" +
          encounterIndex +
          "] references missing customer " +
          encounter.customerId,
      );
    }
    if (!itemIds.has(encounter.requestedItemId)) {
      issues.push(
        "encounters[" +
          encounterIndex +
          "] references missing requested item " +
          encounter.requestedItemId,
      );
    }

    for (const [optionIndex, option] of encounter.recommendationOptions.entries()) {
      recommendationOptionIds.push(option);
      if (!itemIds.has(option.itemId)) {
        issues.push(
          "encounters[" +
            encounterIndex +
            "].recommendationOptions[" +
            optionIndex +
            "] references missing item " +
            option.itemId,
        );
      }
      visitCopy(
        option.resultCopy,
        "encounters[" + encounterIndex + "].recommendationOptions[" + optionIndex + "].resultCopy",
        customerIds,
        issues,
      );
    }

    for (const outcomeName of ["sell", "refuse", "defaultRecommend"] as const) {
      const outcome = encounter.outcomes[outcomeName];
      authoredOutcomeIds.push(outcome);
      checkOutcome(
        outcome,
        "encounters[" + encounterIndex + "].outcomes." + outcomeName,
        customerIds,
        issues,
      );
      visitCopy(
        outcome.copy,
        "encounters[" + encounterIndex + "].outcomes." + outcomeName + ".copy",
        customerIds,
        issues,
      );
    }

    visitNarrative(
      encounter.intro,
      "encounters[" + encounterIndex + "].intro",
      customerIds,
      issues,
    );
    visitNarrative(
      encounter.scan,
      "encounters[" + encounterIndex + "].scan",
      customerIds,
      issues,
    );
  }

  checkUniqueIds(recommendationOptionIds, "recommendation option", issues);
  checkUniqueIds(authoredOutcomeIds, "authored outcome", issues);
}

function checkPlanReferences(
  content: AuthoredContent,
  encounterIds: Set<string>,
  issues: string[],
): void {
  const slots = content.dayPlans.flatMap((plan) => plan.slots);
  checkUniqueIds(slots, "encounter slot", issues);

  const fallbackCounts = new Map<string, number>();
  for (const [planIndex, plan] of content.dayPlans.entries()) {
    for (const [slotIndex, slot] of plan.slots.entries()) {
      if (!slot.fallbackEncounterId.trim()) {
        issues.push(
          "dayPlans[" + planIndex + "].slots[" + slotIndex + "] is missing fallback encounter",
        );
      }
      fallbackCounts.set(
        slot.fallbackEncounterId,
        (fallbackCounts.get(slot.fallbackEncounterId) ?? 0) + 1,
      );
      if (!encounterIds.has(slot.fallbackEncounterId)) {
        issues.push(
          "dayPlans[" +
            planIndex +
            "].slots[" +
            slotIndex +
            "] references missing fallback " +
            slot.fallbackEncounterId,
        );
      }

      for (const [candidateIndex, candidate] of slot.candidates.entries()) {
        if (!encounterIds.has(candidate.encounterId)) {
          issues.push(
            "dayPlans[" +
              planIndex +
              "].slots[" +
              slotIndex +
              "].candidates[" +
              candidateIndex +
              "] references missing encounter " +
              candidate.encounterId,
          );
        }
        visitCondition(
          candidate.conditions,
          "dayPlans[" +
            planIndex +
            "].slots[" +
            slotIndex +
            "].candidates[" +
            candidateIndex +
            "].conditions",
          new Set(content.customers.map((customer) => customer.id)),
          issues,
        );
      }
    }
    visitNarrative(
      plan.presentation.briefing.eyebrow,
      "dayPlans[" + planIndex + "].presentation.briefing.eyebrow",
      new Set(content.customers.map((customer) => customer.id)),
      issues,
    );
    visitNarrative(
      plan.presentation.briefing.heading,
      "dayPlans[" + planIndex + "].presentation.briefing.heading",
      new Set(content.customers.map((customer) => customer.id)),
      issues,
    );
    visitNarrative(
      plan.presentation.briefing.body,
      "dayPlans[" + planIndex + "].presentation.briefing.body",
      new Set(content.customers.map((customer) => customer.id)),
      issues,
    );
    visitNarrative(
      plan.presentation.shiftSummary.heading,
      "dayPlans[" + planIndex + "].presentation.shiftSummary.heading",
      new Set(content.customers.map((customer) => customer.id)),
      issues,
    );
    visitNarrative(
      plan.presentation.shiftSummary.body,
      "dayPlans[" + planIndex + "].presentation.shiftSummary.body",
      new Set(content.customers.map((customer) => customer.id)),
      issues,
    );
    visitNarrative(
      plan.presentation.shiftSummary.nextAction,
      "dayPlans[" + planIndex + "].presentation.shiftSummary.nextAction",
      new Set(content.customers.map((customer) => customer.id)),
      issues,
    );
  }

  for (const encounter of content.encounters) {
    const fallbackCount = fallbackCounts.get(encounter.id) ?? 0;
    if (fallbackCount !== 1) {
      issues.push(
        "encounter " +
          encounter.id +
          " must be assigned exactly once by a plan fallback; received " +
          fallbackCount,
      );
    }
  }
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

function checkRecommendationSemantics(
  content: AuthoredContent,
  itemIds: Set<string>,
  customerIds: Set<string>,
  issues: string[],
): void {
  try {
    validateRecommendationPairs(content.recommendationPairs);
  } catch (error) {
    addEngineIssues(issues, "recommendationPairs", error);
  }

  for (const [pairIndex, pair] of content.recommendationPairs.entries()) {
    if (!customerIds.has(pair.customerId)) {
      continue;
    }
    const customer = content.customers.find((candidate) => candidate.id === pair.customerId);
    const requestedItem = content.items.find((item) => item.id === pair.requestedItemId);
    const recommendedItem = content.items.find((item) => item.id === pair.recommendedItemId);

    if (!itemIds.has(pair.requestedItemId) || !itemIds.has(pair.recommendedItemId)) {
      continue;
    }
    if (!customer?.axis) {
      issues.push(
        "recommendationPairs[" + pairIndex + "] customer " + pair.customerId + " has no anomaly axis",
      );
    }
    if (requestedItem?.kind !== "abnormal" || requestedItem.anomalyRole !== "base") {
      issues.push(
        "recommendationPairs[" +
          pairIndex +
          "] must request an abnormal base item",
      );
    }
    if (
      recommendedItem?.kind !== "abnormal" ||
      (recommendedItem.anomalyRole !== "coexist" && recommendedItem.anomalyRole !== "runaway")
    ) {
      issues.push(
        "recommendationPairs[" +
          pairIndex +
          "] must recommend an abnormal coexist or runaway item",
      );
    }
    if (
      customer?.axis &&
      requestedItem?.kind === "abnormal" &&
      recommendedItem?.kind === "abnormal" &&
      (requestedItem.axis !== customer.axis || recommendedItem.axis !== customer.axis)
    ) {
      issues.push(
        "recommendationPairs[" + pairIndex + "] crosses the customer's world axis",
      );
    }

    checkOutcome(
      pair.outcome,
      "recommendationPairs[" + pairIndex + "].outcome",
      customerIds,
      issues,
    );

    const matchingEncounters = content.encounters.filter((encounter) =>
      encounter.recommendationOptions.some((option) =>
        sameRecommendation(pair, encounter, option.itemId),
      ),
    );
    if (matchingEncounters.length === 0) {
      issues.push(
        "recommendationPairs[" +
          pairIndex +
          "] has no matching encounter recommendation option",
      );
    }
    for (const encounter of matchingEncounters) {
      try {
        validateRecommendationPairs([pair], {
          baseSale: encounter.outcomes.sell,
          defaultOutcome: encounter.outcomes.defaultRecommend,
        });
      } catch (error) {
        addEngineIssues(
          issues,
          "recommendationPairs[" + pairIndex + "] effective outcome",
          error,
        );
      }
    }
  }

  for (const [encounterIndex, encounter] of content.encounters.entries()) {
    const requestedItem = content.items.find((item) => item.id === encounter.requestedItemId);
    if (!requestedItem) {
      continue;
    }
    for (const [optionIndex, option] of encounter.recommendationOptions.entries()) {
      const matches = content.recommendationPairs.filter((pair) =>
        sameRecommendation(pair, encounter, option.itemId),
      );
      if (requestedItem.kind === "abnormal") {
        if (encounter.recommendationOptions.length !== 2) {
          issues.push(
            "encounters[" +
              encounterIndex +
              "] abnormal encounter must have exactly two recommendation options",
          );
        }
        if (matches.filter((pair) => isUnconditionalCondition(pair.conditions)).length !== 1) {
          issues.push(
            "encounters[" +
              encounterIndex +
              "].recommendationOptions[" +
              optionIndex +
              "] must match exactly one unconditional global recommendation pair; received " +
              matches.length,
          );
        }
      } else if (matches.length !== 0) {
        issues.push(
          "encounters[" +
            encounterIndex +
            "].recommendationOptions[" +
            optionIndex +
            "] ordinary recommendation has an unexpected global pair",
        );
      }
    }
  }
}

function checkCatalogRoles(content: AuthoredContent, issues: string[]): void {
  const abnormalItems = content.items.filter((item) => item.kind === "abnormal");
  const ordinaryItems = content.items.filter((item) => item.kind === "ordinary");
  if (content.items.length !== 20) {
    issues.push("expected exactly 20 items; received " + content.items.length);
  }
  if (abnormalItems.length !== 12) {
    issues.push("expected exactly 12 abnormal items; received " + abnormalItems.length);
  }
  if (ordinaryItems.length !== 8) {
    issues.push("expected exactly 8 ordinary items; received " + ordinaryItems.length);
  }

  for (const axis of WORLD_AXES) {
    for (const role of ["base", "coexist", "runaway"] as const) {
      const matches = abnormalItems.filter(
        (item) => item.axis === axis && item.anomalyRole === role,
      );
      if (matches.length !== 1) {
        issues.push(
          "expected exactly one " + axis + " " + role + " abnormal item; received " + matches.length,
        );
      }
    }
  }

  const majorCustomers = content.customers.filter((customer) => customer.role === "major");
  const staffCustomers = content.customers.filter((customer) => customer.role === "staff");
  const incidentalCustomers = content.customers.filter(
    (customer) => customer.role === "incidental",
  );
  if (content.customers.length !== 10) {
    issues.push("expected exactly 10 customers; received " + content.customers.length);
  }
  if (majorCustomers.length !== 6) {
    issues.push("expected exactly 6 major customers; received " + majorCustomers.length);
  }
  if (staffCustomers.length !== 1) {
    issues.push("expected exactly one staff customer; received " + staffCustomers.length);
  }
  if (incidentalCustomers.length !== 3) {
    issues.push("expected exactly 3 incidental customers; received " + incidentalCustomers.length);
  }

  const manager = content.customers.find((customer) => customer.id === "manager");
  if (!manager || manager.role !== "staff") {
    issues.push("customer manager must be the single staff manager");
  }
  for (const customer of content.customers) {
    if (customer.role !== "major" && customer.axis !== undefined) {
      issues.push("non-major customer " + customer.id + " must not have an anomaly axis");
    }
  }
  const axisCustomers = content.customers.filter(
    (customer) => customer.axis !== undefined,
  );
  if (axisCustomers.length !== WORLD_AXES.length) {
    issues.push(
      "expected exactly four axis-bearing major customers; received " + axisCustomers.length,
    );
  }
  for (const axis of WORLD_AXES) {
    const matches = axisCustomers.filter((customer) => customer.axis === axis);
    if (matches.length !== 1) {
      issues.push(
        "expected exactly one axis-bearing customer for " + axis + "; received " + matches.length,
      );
    }
  }
}

function checkPlansAndDays(content: AuthoredContent, issues: string[]): void {
  if (content.dayPlans.length !== 5) {
    issues.push("expected exactly 5 day plans; received " + content.dayPlans.length);
  }
  if (content.encounters.length !== 29) {
    issues.push("expected exactly 29 encounters; received " + content.encounters.length);
  }
  if (content.recommendationPairs.length !== 11) {
    issues.push(
      "expected exactly 11 recommendation pairs; received " + content.recommendationPairs.length,
    );
  }

  const plansByDay = new Map<Day, typeof content.dayPlans>();
  for (const plan of content.dayPlans) {
    const sameDay = plansByDay.get(plan.day) ?? [];
    sameDay.push(plan);
    plansByDay.set(plan.day, sameDay);
  }
  for (const day of DAYS) {
    const plans = plansByDay.get(day) ?? [];
    if (plans.length === 0) {
      issues.push("missing day plan " + day);
      continue;
    }
    if (plans.length > 1) {
      issues.push("duplicate day plan " + day);
    }
    if (plans[0].slots.length !== EXPECTED_SLOT_COUNTS[day]) {
      issues.push(
        "day " +
          day +
          " must have exactly " +
          EXPECTED_SLOT_COUNTS[day] +
          " slots; received " +
          plans[0].slots.length,
      );
    }
  }
  const totalSlots = content.dayPlans.reduce((total, plan) => total + plan.slots.length, 0);
  if (totalSlots !== 29) {
    issues.push("expected exactly 29 total runtime slots; received " + totalSlots);
  }
  for (const plan of content.dayPlans) {
    if (plan.day !== 5 && plan.day5AnomalyOrder !== undefined) {
      issues.push("only day 5 may contain anomaly ordering metadata");
    }
  }
}

function checkDay5Metadata(content: AuthoredContent, issues: string[]): void {
  const day5 = content.dayPlans.find((plan) => plan.day === 5);
  const anomalyCustomers = content.customers.filter(
    (customer) => customer.axis !== undefined,
  );
  if (!day5) {
    issues.push("missing day 5 plan for anomaly ordering validation");
    return;
  }
  const entries = day5.day5AnomalyOrder;
  if (!entries) {
    issues.push("day 5 is missing anomaly ordering metadata");
    return;
  }

  try {
    validateDay5AnomalySlots(entries);
  } catch (error) {
    addEngineIssues(issues, "day 5 anomaly ordering", error);
  }

  const customerIds = new Set(content.customers.map((customer) => customer.id));
  const slotIds = new Set(day5.slots.map((slot) => slot.id));
  const anomalyEntrySlotIds = new Set(entries.map((entry) => entry.slotId));
  const anomalyEntryCustomerIds = new Set(entries.map((entry) => entry.customerId));
  const anomalyEntryAxes = new Set(entries.map((entry) => entry.axis));
  const expectedCustomerIds = new Set(anomalyCustomers.map((customer) => customer.id));
  const expectedAxes = new Set(WORLD_AXES);

  if (anomalyEntryCustomerIds.size !== expectedCustomerIds.size) {
    issues.push("day 5 anomaly metadata must cover exactly the four axis-bearing customers");
  }
  for (const customerId of expectedCustomerIds) {
    if (!anomalyEntryCustomerIds.has(customerId)) {
      issues.push("day 5 anomaly metadata is missing customer " + customerId);
    }
  }
  for (const customerId of anomalyEntryCustomerIds) {
    if (!customerIds.has(customerId) || !expectedCustomerIds.has(customerId)) {
      issues.push("day 5 anomaly metadata has unexpected customer " + customerId);
    }
  }
  for (const axis of WORLD_AXES) {
    if (!anomalyEntryAxes.has(axis)) {
      issues.push("day 5 anomaly metadata is missing axis " + axis);
    }
  }
  for (const axis of anomalyEntryAxes) {
    if (!expectedAxes.has(axis)) {
      issues.push("day 5 anomaly metadata has unexpected axis " + axis);
    }
  }

  const expectedAnomalySlotIds = new Set<string>();
  for (const slot of day5.slots) {
    const fallback = content.encounters.find(
      (encounter) => encounter.id === slot.fallbackEncounterId,
    );
    const customer = fallback
      ? content.customers.find((candidate) => candidate.id === fallback.customerId)
      : undefined;
    if (customer?.axis !== undefined) {
      expectedAnomalySlotIds.add(slot.id);
    }
  }
  if (anomalyEntrySlotIds.size !== expectedAnomalySlotIds.size) {
    issues.push("day 5 anomaly metadata must cover exactly the four anomaly slots");
  }
  for (const slotId of expectedAnomalySlotIds) {
    if (!anomalyEntrySlotIds.has(slotId)) {
      issues.push("day 5 anomaly metadata is missing slot " + slotId);
    }
  }
  for (const slotId of anomalyEntrySlotIds) {
    if (!slotIds.has(slotId)) {
      issues.push("day 5 anomaly metadata references missing slot " + slotId);
    } else if (!expectedAnomalySlotIds.has(slotId)) {
      issues.push("day 5 anomaly metadata references a non-anomaly slot " + slotId);
    }
  }

  for (const [entryIndex, entry] of entries.entries()) {
    const slot = day5.slots.find((candidate) => candidate.id === entry.slotId);
    const customer = content.customers.find(
      (candidate) => candidate.id === entry.customerId,
    );
    const fallback = slot
      ? content.encounters.find(
          (encounter) => encounter.id === slot.fallbackEncounterId,
        )
      : undefined;
    if (!customer) {
      continue;
    }
    if (customer.axis !== entry.axis) {
      issues.push(
        "day5AnomalyOrder[" +
          entryIndex +
          "] axis does not match customer " +
          entry.customerId,
      );
    }
    if (fallback && fallback.customerId !== entry.customerId) {
      issues.push(
        "day5AnomalyOrder[" +
          entryIndex +
          "] customer does not match its slot fallback encounter",
      );
    }
  }
}

function checkConvergence(content: AuthoredContent, issues: string[]): void {
  const convergence = content.day5Convergence;
  const day5 = content.dayPlans.find((plan) => plan.day === 5);
  if (convergence.day !== 5) {
    issues.push("day 5 convergence metadata must target day 5");
  }
  if (convergence.finalQueueIndex !== 5) {
    issues.push("day 5 convergence finalQueueIndex must be exactly 5");
  }
  if (convergence.successfulSaleAxisBonus !== 2) {
    issues.push("day 5 convergence successfulSaleAxisBonus must be exactly 2");
  }
  if (convergence.refusalStabilityDelta !== -2) {
    issues.push("day 5 convergence refusalStabilityDelta must be exactly -2");
  }
  if (convergence.refusalFlagId !== "convergence_refused") {
    issues.push("day 5 convergence refusalFlagId must be convergence_refused");
  }
  if (
    day5 &&
    (convergence.finalQueueIndex < 0 ||
      convergence.finalQueueIndex >= day5.slots.length)
  ) {
    issues.push(
      "day 5 convergence finalQueueIndex " +
        convergence.finalQueueIndex +
        " is outside the day 5 queue range",
    );
  }
}

function collectSemanticIssues(content: AuthoredContent): string[] {
  const issues: string[] = [];
  if (content.contentVersion !== TASK4_CONTENT_VERSION) {
    issues.push(
      "contentVersion must be " +
        TASK4_CONTENT_VERSION +
        "; received " +
        content.contentVersion,
    );
  }

  checkCatalogRoles(content, issues);
  checkPlansAndDays(content, issues);
  checkUniqueIds(content.items, "item", issues);
  checkUniqueIds(content.customers, "customer", issues);
  checkUniqueIds(content.encounters, "encounter", issues);
  checkUniqueIds(content.encounters.flatMap((encounter) => encounter.questions ?? []), "question", issues);
  checkUniqueIds(content.recommendationPairs, "recommendation pair", issues);

  const itemIds = new Set(content.items.map((item) => item.id));
  const customerIds = new Set(content.customers.map((customer) => customer.id));
  const encounterIds = new Set(content.encounters.map((encounter) => encounter.id));

  checkEncounterReferences(content, itemIds, customerIds, issues);
  checkPlanReferences(content, encounterIds, issues);

  for (const [pairIndex, pair] of content.recommendationPairs.entries()) {
    visitCondition(
      pair.conditions,
      "recommendationPairs[" + pairIndex + "].conditions",
      customerIds,
      issues,
    );
  }
  for (const [planIndex, plan] of content.dayPlans.entries()) {
    for (const [slotIndex, slot] of plan.slots.entries()) {
      for (const [candidateIndex, candidate] of slot.candidates.entries()) {
        visitCondition(
          candidate.conditions,
          "dayPlans[" +
            planIndex +
            "].slots[" +
            slotIndex +
            "].candidates[" +
            candidateIndex +
            "].conditions",
          customerIds,
          issues,
        );
      }
    }
  }

  checkRecommendationSemantics(content, itemIds, customerIds, issues);
  checkDay5Metadata(content, issues);
  checkConvergence(content, issues);

  return issues;
}

/**
 * Parses strict authored contracts first, then applies Task 4 runtime semantics.
 * The parser returns a detached value and every semantic check is read-only.
 */
export function validateTask4Content(input: unknown): AuthoredContent {
  const content = AuthoredContentSchema.parse(input);
  const issues = collectSemanticIssues(content);
  if (issues.length > 0) {
    throw new ContentValidationError("Invalid Task 4 content", issues);
  }
  return content;
}

const EXPECTED_NEWS_COUNTS: Record<Day, number> = {
  1: 6,
  2: 6,
  3: 5,
  4: 5,
  5: 8,
};

const EXPECTED_NEWS_ROLE_TOTALS: Record<NewsArticle["role"], number> = {
  direct: 10,
  trend: 15,
  discrepancy: 4,
  local: 1,
};

const EXPECTED_NEWS_FALLBACKS: Record<string, string> = {
  "1:direct": "news_d1_direct_fallback",
  "1:trend": "news_d1_trend_fallback",
  "1:discrepancy": "news_d1_local_clock_fallback",
  "2:direct": "news_d2_direct_fallback",
  "2:trend": "news_d2_trend_fallback",
  "2:discrepancy": "news_d2_discrepancy_hospital_fallback",
  "3:direct": "news_d3_direct_fallback",
  "3:trend": "news_d3_trend_fallback",
  "3:discrepancy": "news_d3_discrepancy_hospital_history_fallback",
  "4:direct": "news_d4_direct_fallback",
  "4:trend": "news_d4_trend_fallback",
  "4:discrepancy": "news_d4_discrepancy_first_train_fallback",
  "5:direct": "news_d5_direct_fallback",
  "5:trend": "news_d5_trend_fallback",
  "5:discrepancy": "news_d5_discrepancy_receipt_count_fallback",
};

const EXPECTED_NEWS_GROUPS: Record<string, readonly string[]> = {
  d1_spirit_boundary: [
    "news_d1_direct_hotaru_boundary",
    "news_d1_trend_spirit_reflection",
  ],
  d2_machine_network: [
    "news_d2_direct_hako3_self_repair",
    "news_d2_trend_machine_delivery",
  ],
  d3_boundary_collision: [
    "news_d3_direct_hotaru_photo",
    "news_d3_trend_system_collision",
  ],
  d4_town_state: ["news_d4_direct_four_systems", "news_d4_trend_coexistence"],
  d5_dominant_axis: [
    "news_d5_trend_undead",
    "news_d5_trend_machine",
    "news_d5_trend_cosmic",
    "news_d5_trend_spirit",
  ],
};

const EXPECTED_TASK5_NEWS_IDS = new Set(TASK5_NEWS.map((article) => article.id));

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  }
  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return (
      sameValue(leftKeys, rightKeys) &&
      leftKeys.every((key) => sameValue(leftRecord[key], rightRecord[key]))
    );
  }
  return false;
}

function normalizeNewsText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function checkCanonicalTask4Core(content: Task5Content, issues: string[]): void {
  const canonicalCore = {
    items: TASK4_ITEMS,
    customers: TASK4_CUSTOMERS,
    encounters: TASK4_ENCOUNTERS,
    recommendationPairs: TASK4_RECOMMENDATION_PAIRS,
    dayPlans: TASK4_DAY_PLANS,
    day5Convergence: TASK4_DAY5_CONVERGENCE,
  };

  for (const key of Object.keys(canonicalCore) as Array<keyof typeof canonicalCore>) {
    if (!sameValue(content[key], canonicalCore[key])) {
      issues.push("Task 5 core field " + key + " does not match the accepted Task 4 catalog");
    }
  }
}

function visitTask5Condition(
  condition: Condition,
  path: string,
  customerIds: Set<string>,
  newsIds: Set<string>,
  issues: string[],
): void {
  if ("all" in condition) {
    condition.all.forEach((child, index) =>
      visitTask5Condition(child, `${path}.all[${index}]`, customerIds, newsIds, issues),
    );
    return;
  }
  if ("any" in condition) {
    condition.any.forEach((child, index) =>
      visitTask5Condition(child, `${path}.any[${index}]`, customerIds, newsIds, issues),
    );
    return;
  }
  if ("not" in condition) {
    visitTask5Condition(condition.not, `${path}.not`, customerIds, newsIds, issues);
    return;
  }
  if ("customerState" in condition && !customerIds.has(condition.customerState.customerId)) {
    issues.push(
      `${path} references missing customer ${condition.customerState.customerId}`,
    );
    return;
  }
  if ("seenNews" in condition && !newsIds.has(condition.seenNews.id)) {
    issues.push(`${path} references missing news ${condition.seenNews.id}`);
    return;
  }
  if ("readNews" in condition && !newsIds.has(condition.readNews.id)) {
    issues.push(`${path} references missing news ${condition.readNews.id}`);
  }
}

function visitTask5Narrative(
  narrative: Narrative,
  path: string,
  customerIds: Set<string>,
  newsIds: Set<string>,
  issues: string[],
): void {
  if (typeof narrative === "string") {
    return;
  }
  narrative.variants.forEach((variant, index) =>
    visitTask5Condition(
      variant.condition,
      `${path}.variants[${index}].condition`,
      customerIds,
      newsIds,
      issues,
    ),
  );
}

function checkTask5NewsEffects(
  article: NewsArticle,
  customerIds: Set<string>,
  newsIds: Set<string>,
  issues: string[],
): void {
  visitTask5Condition(
    article.conditions,
    `news.${article.id}.conditions`,
    customerIds,
    newsIds,
    issues,
  );

  try {
    validateOutcomeEffects({ id: article.id, effects: article.effectsOnRead });
  } catch (error) {
    addEngineIssues(issues, `news ${article.id}`, error);
  }

  const flagEffects = article.effectsOnRead.filter(
    (effect): effect is Extract<Effect, { kind: "setFlag" }> => effect.kind === "setFlag",
  );
  const awarenessEffects = article.effectsOnRead.filter(
    (effect): effect is Extract<Effect, { kind: "add" }> =>
      effect.kind === "add" && effect.target === "awareness",
  );
  if (flagEffects.length !== 1 || flagEffects[0]?.id !== `read_${article.id}`) {
    issues.push(`news ${article.id} must set exactly read_${article.id}`);
  }

  for (const effect of article.effectsOnRead) {
    if (effect.kind === "setFlag") {
      continue;
    }
    if (
      effect.kind === "add" &&
      effect.target === "awareness" &&
      effect.amount === 1 &&
      (article.role === "discrepancy" || article.role === "local")
    ) {
      continue;
    }
    issues.push(`news ${article.id} has an ending-relevant read effect`);
  }

  const shouldRaiseAwareness = article.role === "discrepancy" || article.role === "local";
  if (shouldRaiseAwareness) {
    if (awarenessEffects.length !== 1 || awarenessEffects[0].amount !== 1) {
      issues.push(`news ${article.id} must add awareness exactly once`);
    }
  } else if (awarenessEffects.length !== 0) {
    issues.push(`news ${article.id} must not add awareness`);
  }

  for (const effect of article.effectsOnRead) {
    if (effect.kind === "setCustomerState") {
      if (!customerIds.has(effect.customerId)) {
        issues.push(`news ${article.id} references missing customer ${effect.customerId}`);
      }
    }
  }
}

function checkTask5News(content: Task5Content, issues: string[]): void {
  const articles = content.news;
  if (articles.length !== 30) {
    issues.push(`expected exactly 30 news articles; received ${articles.length}`);
  }

  checkUniqueIds(articles, "news", issues);
  const customerIds = new Set(content.customers.map((customer) => customer.id));
  const newsIds = new Set(articles.map((article) => article.id));

  const actualIds = new Set(articles.map((article) => article.id));
  for (const expectedId of EXPECTED_TASK5_NEWS_IDS) {
    if (!actualIds.has(expectedId)) {
      issues.push(`missing canonical news article ${expectedId}`);
    }
  }
  for (const actualId of actualIds) {
    if (!EXPECTED_TASK5_NEWS_IDS.has(actualId)) {
      issues.push(`unexpected canonical news article ${actualId}`);
    }
  }

  const roleCounts: Record<NewsArticle["role"], number> = {
    direct: 0,
    trend: 0,
    discrepancy: 0,
    local: 0,
  };
  for (const article of articles) {
    roleCounts[article.role] += 1;
    if (!article.id.startsWith(`news_d${article.day}_${article.role}_`)) {
      issues.push(`news ${article.id} does not match its day/role naming`);
    }
    if (article.role === "local" && article.day !== 1) {
      issues.push(`local news ${article.id} is only allowed on day 1`);
    }
    if (article.isFallback) {
      if (article.priority !== -100) {
        issues.push(`fallback news ${article.id} must have priority -100`);
      }
      if (!isUnconditionalCondition(article.conditions)) {
        issues.push(`fallback news ${article.id} must have an unconditional condition`);
      }
      if (article.exclusiveGroup !== undefined) {
        issues.push(`fallback news ${article.id} must not have an exclusive group`);
      }
    } else if (
      article.priority !== 200 &&
      !(article.id === "news_d5_direct_convergence_refused" && article.priority === 300)
    ) {
      issues.push(`nonfallback news ${article.id} has an invalid priority`);
    }
    if (
      article.id === "news_d5_direct_convergence_refused" &&
      (article.day !== 5 ||
        article.role !== "direct" ||
        article.isFallback ||
        article.priority !== 300 ||
        !sameValue(article.conditions, { flag: { id: "convergence_refused" } }))
    ) {
      issues.push("final refusal news must be the nonfallback Day 5 direct article");
    }
    const normalizedNotification = normalizeNewsText(article.notificationHeadline);
    const normalizedHeadline = normalizeNewsText(article.headline);
    const normalizedBody = normalizeNewsText(article.body);
    for (const field of [normalizedNotification, normalizedHeadline, normalizedBody]) {
      if (field.length === 0) {
        issues.push(`news ${article.id} has blank article text`);
      }
    }
    if (normalizedNotification === normalizedHeadline || normalizedNotification === normalizedBody) {
      issues.push(`news ${article.id} notification must differ from headline and body`);
    }
    checkTask5NewsEffects(article, customerIds, newsIds, issues);
  }

  for (const role of ["direct", "trend", "discrepancy", "local"] as const) {
    if (roleCounts[role] !== EXPECTED_NEWS_ROLE_TOTALS[role]) {
      issues.push(
        `expected ${EXPECTED_NEWS_ROLE_TOTALS[role]} ${role} news articles; received ${roleCounts[role]}`,
      );
    }
  }

  for (const day of DAYS) {
    const dayArticles = articles.filter((article) => article.day === day);
    if (dayArticles.length !== EXPECTED_NEWS_COUNTS[day]) {
      issues.push(`day ${day} must have exactly ${EXPECTED_NEWS_COUNTS[day]} news articles`);
    }
    for (const slot of NEWS_SLOTS) {
      const allowedRoles = day === 1 && slot === "discrepancy" ? [slot, "local"] : [slot];
      const fallbacks = dayArticles.filter(
        (article) => article.isFallback && allowedRoles.includes(article.role),
      );
      if (fallbacks.length !== 1) {
        issues.push(`day ${day} slot ${slot} must have exactly one fallback`);
      }
      const expectedId = EXPECTED_NEWS_FALLBACKS[`${day}:${slot}`];
      if (fallbacks[0]?.id !== expectedId) {
        issues.push(`day ${day} slot ${slot} has the wrong fallback article`);
      }
    }
  }

  const groupMembers = new Map<string, string[]>();
  for (const article of articles) {
    if (!article.exclusiveGroup) {
      continue;
    }
    const members = groupMembers.get(article.exclusiveGroup) ?? [];
    members.push(article.id);
    groupMembers.set(article.exclusiveGroup, members);
    if (members.some((memberId) => articles.find((candidate) => candidate.id === memberId)?.day !== article.day)) {
      issues.push(`exclusive group ${article.exclusiveGroup} must be day-local`);
    }
  }
  for (const [group, members] of groupMembers) {
    if (members.length < 2) {
      issues.push(`exclusive group ${group} must have at least two members`);
    }
    const expected = EXPECTED_NEWS_GROUPS[group];
    if (!expected || !sameValue([...members].sort(), [...expected].sort())) {
      issues.push(`exclusive group ${group} does not match the authored group`);
    }
  }
  for (const [group, expected] of Object.entries(EXPECTED_NEWS_GROUPS)) {
    if (!groupMembers.has(group)) {
      issues.push(`missing exclusive group ${group}`);
    } else if (!sameValue([...groupMembers.get(group)!].sort(), [...expected].sort())) {
      issues.push(`exclusive group ${group} has the wrong members`);
    }
  }
}

function task5WitnessState(
  content: Task5Content,
  day: Day,
  overrides: Partial<Pick<GameState, "world" | "stability" | "flags" | "customerStates">> = {},
): GameState {
  const initial = createInitialGameState({
    runId: `task5-news-witness-${day}`,
    contentVersion: content.contentVersion,
  });
  return {
    ...initial,
    day,
    world: { ...initial.world, ...(overrides.world ?? {}) },
    stability: overrides.stability ?? initial.stability,
    flags: [...(overrides.flags ?? initial.flags)],
    customerStates: { ...(overrides.customerStates ?? initial.customerStates) },
    revenue: { ...initial.revenue, dailyTarget: content.dayPlans[day - 1].revenueTarget },
  };
}

function task5NewsWitnesses(content: Task5Content, day: Day): GameState[] {
  const witnesses: GameState[] = [task5WitnessState(content, day)];
  const axisStates = WORLD_AXES.map((axis) =>
    task5WitnessState(content, day, {
      world: Object.fromEntries(
        WORLD_AXES.map((candidate) => [candidate, candidate === axis ? 10 : 0]),
      ) as GameState["world"],
    }),
  );
  witnesses.push(...axisStates);
  witnesses.push(
    task5WitnessState(content, day, { customerStates: { hotaru: "sealed" } }),
    task5WitnessState(content, day, { customerStates: { hako3: "self_modified" } }),
    task5WitnessState(content, day, { stability: -6 }),
    task5WitnessState(content, day, {
      world: { undead: 4, machine: 4, cosmic: 4, spirit: 4 },
      stability: -6,
    }),
    task5WitnessState(content, day, { stability: 6 }),
    task5WitnessState(content, day, { flags: ["convergence_refused"] }),
  );
  return witnesses;
}

function checkTask5NewsSelectionWitnesses(content: Task5Content, issues: string[]): void {
  for (const day of DAYS) {
    const baseline = task5WitnessState(content, day);
    try {
      const selections = selectNewsForDay(day, content.news, baseline);
      if (selections.length !== NEWS_SLOTS.length) {
        issues.push(`day ${day} does not fill all three news slots`);
      }
    } catch (error) {
      addEngineIssues(issues, `day ${day} news fillability`, error);
    }

    for (const article of content.news.filter(
      (candidate) => candidate.day === day && !candidate.isFallback,
    )) {
      const selected = task5NewsWitnesses(content, day).some((witness) => {
        try {
          const selections = selectNewsForDay(day, content.news, witness);
          return selections.some((selection) => selection.newsId === article.id);
        } catch {
          return false;
        }
      });
      if (!selected) {
        issues.push(`nonfallback news ${article.id} has no selectable witness`);
      }
    }
  }
}

function checkTask5CoreConditionReferences(content: Task5Content, issues: string[]): void {
  const customerIds = new Set(content.customers.map((customer) => customer.id));
  const newsIds = new Set(content.news.map((article) => article.id));
  for (const [encounterIndex, encounter] of content.encounters.entries()) {
    visitTask5Narrative(
      encounter.intro,
      `encounters[${encounterIndex}].intro`,
      customerIds,
      newsIds,
      issues,
    );
    visitTask5Narrative(
      encounter.scan,
      `encounters[${encounterIndex}].scan`,
      customerIds,
      newsIds,
      issues,
    );
    for (const [optionIndex, option] of encounter.recommendationOptions.entries()) {
      for (const [copyName, narrative] of Object.entries(option.resultCopy)) {
        visitTask5Narrative(
          narrative,
          `encounters[${encounterIndex}].recommendationOptions[${optionIndex}].resultCopy.${copyName}`,
          customerIds,
          newsIds,
          issues,
        );
      }
    }
    for (const [outcomeName, outcome] of Object.entries(encounter.outcomes)) {
      for (const copyName of ["result", "readback", "receipt"] as const) {
        const narrative = outcome.copy[copyName];
        visitTask5Narrative(
          narrative,
          `encounters[${encounterIndex}].outcomes.${outcomeName}.copy.${copyName}`,
          customerIds,
          newsIds,
          issues,
        );
      }
    }
  }
  for (const [pairIndex, pair] of content.recommendationPairs.entries()) {
    visitTask5Condition(
      pair.conditions,
      `recommendationPairs[${pairIndex}].conditions`,
      customerIds,
      newsIds,
      issues,
    );
  }
  for (const [planIndex, plan] of content.dayPlans.entries()) {
    for (const [slotIndex, slot] of plan.slots.entries()) {
      for (const [candidateIndex, candidate] of slot.candidates.entries()) {
        visitTask5Condition(
          candidate.conditions,
          `dayPlans[${planIndex}].slots[${slotIndex}].candidates[${candidateIndex}].conditions`,
          customerIds,
          newsIds,
          issues,
        );
      }
    }
    const presentations = [
      ["briefing.eyebrow", plan.presentation.briefing.eyebrow],
      ["briefing.heading", plan.presentation.briefing.heading],
      ["briefing.body", plan.presentation.briefing.body],
      ["shiftSummary.heading", plan.presentation.shiftSummary.heading],
      ["shiftSummary.body", plan.presentation.shiftSummary.body],
      ["shiftSummary.nextAction", plan.presentation.shiftSummary.nextAction],
    ] as const;
    for (const [presentationPath, narrative] of presentations) {
      visitTask5Narrative(
        narrative,
        `dayPlans[${planIndex}].presentation.${presentationPath}`,
        customerIds,
        newsIds,
        issues,
      );
    }
  }
}

function visitTask7Condition(
  condition: Condition,
  path: string,
  registry: SemanticReferenceRegistry,
  issues: string[],
  day?: Day,
): void {
  if ("all" in condition) {
    condition.all.forEach((child, index) =>
      visitTask7Condition(child, `${path}.all[${index}]`, registry, issues, day),
    );
    return;
  }
  if ("any" in condition) {
    condition.any.forEach((child, index) =>
      visitTask7Condition(child, `${path}.any[${index}]`, registry, issues, day),
    );
    return;
  }
  if ("not" in condition) {
    visitTask7Condition(condition.not, `${path}.not`, registry, issues, day);
    return;
  }
  if ("flag" in condition) {
    if (!registry.flags.includes(condition.flag.id)) {
      issues.push(`${path} references unproducible flag ${condition.flag.id}`);
    }
    return;
  }
  if ("customerState" in condition) {
    const states = registry.customerStates[condition.customerState.customerId];
    if (states && !states.includes(condition.customerState.state)) {
      issues.push(
        `${path} references unproducible customer state ${condition.customerState.customerId}:${condition.customerState.state}`,
      );
    }
    return;
  }
  if ("seenNews" in condition || "readNews" in condition) {
    const reference = "seenNews" in condition ? condition.seenNews : condition.readNews;
    const referencedDay = registry.newsDays[reference.id];
    if (day !== undefined && referencedDay !== undefined && referencedDay >= day) {
      issues.push(
        `${path} may reference only earlier-day news; ${reference.id} is authored on day ${referencedDay} for day ${day}`,
      );
    }
  }
}

function visitTask7Narrative(
  narrative: Narrative,
  path: string,
  registry: SemanticReferenceRegistry,
  issues: string[],
  day?: Day,
): void {
  if (typeof narrative === "string") {
    return;
  }
  narrative.variants.forEach((variant, index) =>
    visitTask7Condition(
      variant.condition,
      `${path}.variants[${index}].condition`,
      registry,
      issues,
      day,
    ),
  );
}

function checkTask7SemanticReferences(
  content: Task5Content,
  registry: SemanticReferenceRegistry,
  issues: string[],
): void {
  for (const [encounterIndex, encounter] of content.encounters.entries()) {
    const day = registry.encounterDays[encounter.id];
    visitTask7Narrative(encounter.intro, `encounters[${encounterIndex}].intro`, registry, issues, day);
    visitTask7Narrative(encounter.scan, `encounters[${encounterIndex}].scan`, registry, issues, day);
    for (const [questionIndex, question] of (encounter.questions ?? []).entries()) {
      visitTask7Condition(question.conditions, `encounters[${encounterIndex}].questions[${questionIndex}].conditions`, registry, issues, day);
      checkOutcome({ id: question.id, effects: question.effects }, `question ${question.id}`, new Set(registry.customerIds), issues);
    }
    if (encounter.receiptReply) {
      visitTask7Narrative(encounter.receiptReply, `encounters[${encounterIndex}].receiptReply`, registry, issues, day);
    }
    for (const [optionIndex, option] of encounter.recommendationOptions.entries()) {
      for (const [copyName, narrative] of Object.entries(option.resultCopy)) {
        visitTask7Narrative(
          narrative,
          `encounters[${encounterIndex}].recommendationOptions[${optionIndex}].resultCopy.${copyName}`,
          registry,
          issues,
          day,
        );
      }
    }
    for (const [outcomeName, outcome] of Object.entries(encounter.outcomes)) {
      for (const copyName of ["result", "readback", "receipt"] as const) {
        visitTask7Narrative(
          outcome.copy[copyName],
          `encounters[${encounterIndex}].outcomes.${outcomeName}.copy.${copyName}`,
          registry,
          issues,
          day,
        );
      }
    }
  }

  // Recommendation pairs are global authored rules. They have provenance
  // checks, but no fabricated day context for news conditions.
  for (const [pairIndex, pair] of content.recommendationPairs.entries()) {
    visitTask7Condition(
      pair.conditions,
      `recommendationPairs[${pairIndex}].conditions`,
      registry,
      issues,
    );
  }

  for (const [planIndex, plan] of content.dayPlans.entries()) {
    for (const [slotIndex, slot] of plan.slots.entries()) {
      for (const [candidateIndex, candidate] of slot.candidates.entries()) {
        const ownerDay = registry.encounterDays[candidate.encounterId];
        if (ownerDay !== undefined && ownerDay !== plan.day) {
          issues.push(
            `dayPlans[${planIndex}].slots[${slotIndex}].candidates[${candidateIndex}] encounter ${candidate.encounterId} is owned by day ${ownerDay}, not day ${plan.day}`,
          );
        }
        visitTask7Condition(
          candidate.conditions,
          `dayPlans[${planIndex}].slots[${slotIndex}].candidates[${candidateIndex}].conditions`,
          registry,
          issues,
          plan.day,
        );
      }
    }
    const presentations = [
      ["briefing.eyebrow", plan.presentation.briefing.eyebrow],
      ["briefing.heading", plan.presentation.briefing.heading],
      ["briefing.body", plan.presentation.briefing.body],
      ["shiftSummary.heading", plan.presentation.shiftSummary.heading],
      ["shiftSummary.body", plan.presentation.shiftSummary.body],
      ["shiftSummary.nextAction", plan.presentation.shiftSummary.nextAction],
    ] as const;
    for (const [presentationPath, narrative] of presentations) {
      visitTask7Narrative(
        narrative,
        `dayPlans[${planIndex}].presentation.${presentationPath}`,
        registry,
        issues,
        plan.day,
      );
    }
  }

  for (const article of content.news) {
    visitTask7Condition(article.conditions, `news.${article.id}.conditions`, registry, issues, article.day);
  }

  // Endings run after Day 5. Their news references are therefore allowed for
  // any authored day in the registry, including Day 5.
  for (const record of content.endingRecords) {
    for (const [ruleIndex, rule] of record.rules.entries()) {
      visitTask7Condition(
        rule.condition,
        `endingRecords.${record.id}.rules[${ruleIndex}].condition`,
        registry,
        issues,
      );
    }
    for (const [presentationPath, narrative] of [
      ["lead", record.presentation.lead],
      ["body", record.presentation.body],
      ["finalLine", record.presentation.finalLine],
      ["runSummary", record.presentation.runSummary],
    ] as const) {
      visitTask7Narrative(
        narrative,
        `endingRecords.${record.id}.presentation.${presentationPath}`,
        registry,
        issues,
      );
    }
  }
}

function sameEndingRule(left: EndingDefinition, right: EndingDefinition): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.priority === right.priority &&
    left.isFallback === right.isFallback &&
    sameValue(left.condition, right.condition)
  );
}

function checkTask5NarrativeReferences(
  narrative: Narrative,
  path: string,
  customerIds: Set<string>,
  newsIds: Set<string>,
  issues: string[],
): void {
  visitTask5Narrative(narrative, path, customerIds, newsIds, issues);
}

function checkTask5EndingRecords(content: Task5Content, issues: string[]): void {
  const records = content.endingRecords;
  if (records.length !== ENDING_IDS.length) {
    issues.push(`expected exactly five ending records; received ${records.length}`);
  }

  checkUniqueIds(records, "ending record", issues);
  const recordIds = new Set(records.map((record) => record.id));
  for (const endingId of ENDING_IDS) {
    if (!recordIds.has(endingId)) {
      issues.push(`missing ending record ${endingId}`);
    }
  }
  for (const recordId of recordIds) {
    if (!ENDING_IDS.includes(recordId as (typeof ENDING_IDS)[number])) {
      issues.push(`unexpected ending record ${recordId}`);
    }
  }

  const expectedRuleCounts: Record<(typeof ENDING_IDS)[number], number> = {
    undead_dawnless_city: 1,
    fully_automated_business: 1,
    final_departure: 1,
    city_whole_beyond: 1,
    inventory_mixup: 2,
  };
  const flattenedRules = records.flatMap((record) => record.rules);
  if (flattenedRules.length !== 6) {
    issues.push(`expected exactly six ending rules; received ${flattenedRules.length}`);
  }
  const customerIds = new Set(content.customers.map((customer) => customer.id));
  const newsIds = new Set(content.news.map((article) => article.id));
  for (const record of records) {
    if (record.presentation.title !== ENDING_TITLES[record.id]) {
      issues.push(`ending ${record.id} has the wrong title`);
    }
    if (record.rules.length !== expectedRuleCounts[record.id]) {
      issues.push(
        `ending ${record.id} must own ${expectedRuleCounts[record.id]} rule(s); received ${record.rules.length}`,
      );
    }
    if (record.rules.some((rule) => rule.id !== record.id)) {
      issues.push(`ending ${record.id} owns a rule for another ending`);
    }
    for (const [ruleIndex, rule] of record.rules.entries()) {
      visitTask5Condition(
        rule.condition,
        `endingRecords.${record.id}.rules[${ruleIndex}].condition`,
        customerIds,
        newsIds,
        issues,
      );
    }
    checkTask5NarrativeReferences(
      record.presentation.lead,
      `endingRecords.${record.id}.presentation.lead`,
      customerIds,
      newsIds,
      issues,
    );
    checkTask5NarrativeReferences(
      record.presentation.body,
      `endingRecords.${record.id}.presentation.body`,
      customerIds,
      newsIds,
      issues,
    );
    checkTask5NarrativeReferences(
      record.presentation.finalLine,
      `endingRecords.${record.id}.presentation.finalLine`,
      customerIds,
      newsIds,
      issues,
    );
    checkTask5NarrativeReferences(
      record.presentation.runSummary,
      `endingRecords.${record.id}.presentation.runSummary`,
      customerIds,
      newsIds,
      issues,
    );
  }

  const fallbackRules = flattenedRules.filter((rule) => rule.isFallback === true);
  if (
    fallbackRules.length !== 1 ||
    fallbackRules[0]?.id !== "inventory_mixup" ||
    fallbackRules[0]?.priority !== 0 ||
    !fallbackRules[0] ||
    !isUnconditionalCondition(fallbackRules[0].condition)
  ) {
    issues.push("ending rules must have exactly one unconditional inventory_mixup fallback at priority 0");
  }
  const nonfallbackMixups = flattenedRules.filter(
    (rule) => rule.id === "inventory_mixup" && rule.isFallback !== true,
  );
  if (nonfallbackMixups.length !== 1 || nonfallbackMixups[0]?.priority !== 300) {
    issues.push("ending rules must have exactly one nonfallback inventory_mixup rule at priority 300");
  }
  for (const rule of flattenedRules) {
    if (rule.id !== "inventory_mixup" && rule.priority !== 100) {
      issues.push(`single-axis ending ${rule.id} must have priority 100`);
    }
  }

  try {
    validateEndingRules(flattenedRules);
  } catch (error) {
    addEngineIssues(issues, "ending rules", error);
  }

  for (const expectedRule of TASK5_ENDING_RECORDS.flatMap((record) => record.rules)) {
    if (!flattenedRules.some((rule) => sameEndingRule(rule, expectedRule))) {
      issues.push(`missing canonical ending rule ${expectedRule.id}`);
    }
  }
  for (const actualRule of flattenedRules) {
    if (!TASK5_ENDING_RECORDS.flatMap((record) => record.rules).some((rule) => sameEndingRule(rule, actualRule))) {
      issues.push(`unexpected ending rule ${actualRule.id}`);
    }
  }
}

const DEFAULT_TASK5_CONTENT: Task5Content = {
  contentVersion: TASK5_CONTENT_VERSION,
  items: TASK4_ITEMS,
  customers: TASK4_CUSTOMERS,
  encounters: TASK4_ENCOUNTERS,
  recommendationPairs: TASK4_RECOMMENDATION_PAIRS,
  dayPlans: TASK4_DAY_PLANS,
  day5Convergence: TASK4_DAY5_CONVERGENCE,
  news: TASK5_NEWS,
  endingRecords: TASK5_ENDING_RECORDS,
  goldenRoutes: TASK5_GOLDEN_ROUTES,
};

export type Task5SimulationDecision =
  | { encounterId: string; decision: "sell" }
  | { encounterId: string; decision: "refuse" }
  | { encounterId: string; decision: "recommend"; recommendedItemId: string };

export interface Task5SimulationResult {
  routeId: string;
  state: GameState;
  ending: EndingResolution;
  fingerprint: GoldenRouteFingerprint;
  decisions: Task5SimulationDecision[];
  selectedNews: NewsSelection[];
  readNews: string[];
  completedDayCount: number;
  convergenceAxis?: WorldAxis;
}

function task5SimulationError(message: string, details: string[] = []): ContentValidationError {
  return new ContentValidationError(message, details);
}

function task5EncounterMap(content: Task5Content): Map<string, AuthoredEncounter> {
  return new Map(content.encounters.map((encounter) => [encounter.id, encounter]));
}

function simulateTask5Decisions(
  decisions: readonly Task5SimulationDecision[],
  content: Task5Content,
  routeId: string,
): Task5SimulationResult {
  const encounterMap = task5EncounterMap(content);
  const decisionsByEncounter = new Map<string, Task5SimulationDecision>();
  for (const decision of decisions) {
    if (decisionsByEncounter.has(decision.encounterId)) {
      throw task5SimulationError("Duplicate Task 5 simulation decision", [decision.encounterId]);
    }
    if (!encounterMap.has(decision.encounterId)) {
      throw task5SimulationError("Task 5 simulation references missing encounter", [decision.encounterId]);
    }
    decisionsByEncounter.set(decision.encounterId, { ...decision });
  }
  if (decisionsByEncounter.size !== content.encounters.length) {
    throw task5SimulationError("Task 5 simulation must decide every encounter", [
      `expected ${content.encounters.length}`,
      `received ${decisionsByEncounter.size}`,
    ]);
  }

  const firstPlan = content.dayPlans.find((plan) => plan.day === 1);
  if (!firstPlan) {
    throw task5SimulationError("Task 5 simulation is missing day 1");
  }
  let state = createInitialGameState({
    runId: routeId,
    contentVersion: content.contentVersion,
    dailyTarget: firstPlan.revenueTarget,
  });
  let convergenceAxis: WorldAxis | undefined;
  let finalQueueAxis: WorldAxis | undefined;
  let completedDayCount = 0;
  const executionDecisions: Task5SimulationDecision[] = [];
  const selectedNews: NewsSelection[] = [];

  for (const plan of content.dayPlans) {
    const dayStartState: GameState = {
      ...state,
      day: plan.day,
      phase: { kind: "briefing" },
      revenue: {
        ...state.revenue,
        dailyTarget: plan.revenueTarget,
      },
      resolvedQueue: [],
    };
    const queue = resolveEncounterQueue(plan, dayStartState);
    state = {
      ...queue.snapshot,
      resolvedQueue: [...queue.encounterIds],
      phase: queue.encounterIds.length
        ? {
            kind: "encounter",
            subPhase: "intro",
            encounterId: queue.encounterIds[0],
            slotId: plan.slots.find((slot) => slot.fallbackEncounterId === queue.encounterIds[0])?.id ?? "unknown",
          }
        : { kind: "briefing" },
    };

    for (const [encounterIndex, encounterId] of queue.encounterIds.entries()) {
      const encounter = encounterMap.get(encounterId);
      if (!encounter) {
        throw task5SimulationError("Task 5 queue resolved a missing encounter", [encounterId]);
      }
      const decision = decisionsByEncounter.get(encounterId);
      if (!decision) {
        throw task5SimulationError("Task 5 simulation is missing queued encounter", [encounterId]);
      }

      let outcome: Outcome;
      if (decision.decision === "sell") {
        outcome = encounter.outcomes.sell;
      } else if (decision.decision === "refuse") {
        outcome = encounter.outcomes.refuse;
      } else {
        if (
          !encounter.recommendationOptions.some(
            (option) => option.itemId === decision.recommendedItemId,
          )
        ) {
          throw task5SimulationError("Task 5 route recommends an unavailable item", [
            encounterId,
            decision.recommendedItemId,
          ]);
        }
        outcome = resolveRecommendation({
          state,
          customerId: encounter.customerId,
          requestedItemId: encounter.requestedItemId,
          recommendedItemId: decision.recommendedItemId,
          pairs: content.recommendationPairs,
          baseSale: encounter.outcomes.sell,
          defaultOutcome: encounter.outcomes.defaultRecommend,
        }).outcome;
      }

      state = applyOutcome(state, outcome);
      if (plan.day === 5 && encounterIndex === content.day5Convergence.finalQueueIndex) {
        const customer = content.customers.find(
          (candidate) => candidate.id === encounter.customerId,
        );
        if (!customer?.axis) {
          throw task5SimulationError("Task 5 convergence encounter has no axis", [encounterId]);
        }
        finalQueueAxis = customer.axis;
        if (decision.decision === "refuse") {
          state = applyOutcome(state, {
            id: "task5-convergence-refusal",
            effects: [
              {
                kind: "add",
                target: "stability",
                amount: content.day5Convergence.refusalStabilityDelta,
              },
              { kind: "setFlag", id: content.day5Convergence.refusalFlagId },
            ],
          });
        } else {
          convergenceAxis = customer.axis;
          state = applyOutcome(state, {
            id: "task5-convergence-sale",
            effects: [
              {
                kind: "add",
                target: `world.${customer.axis}`,
                amount: content.day5Convergence.successfulSaleAxisBonus,
              },
            ],
          });
        }
      }
      executionDecisions.push({ ...decision });
    }

    const selections = selectNewsForDay(plan.day, content.news, state);
    state = commitNewsSelections(state, selections);
    selectedNews.push(...selections.map((selection) => ({ ...selection })));
    for (const selection of selections) {
      const article = content.news.find((candidate) => candidate.id === selection.newsId);
      if (!article) {
        throw task5SimulationError("Task 5 selected a missing news article", [selection.newsId]);
      }
      const readResult = readNewsArticle(state, article);
      if (!readResult.applied) {
        throw task5SimulationError("Task 5 news article was not read exactly once", [article.id]);
      }
      state = readResult.state;
    }
    completedDayCount += 1;

    if (plan.day < 5) {
      const nextPlan = content.dayPlans.find((candidate) => candidate.day === plan.day + 1);
      if (!nextPlan) {
        throw task5SimulationError("Task 5 simulation is missing the next day plan", [
          String(plan.day + 1),
        ]);
      }
      state = {
        ...state,
        day: (plan.day + 1) as Day,
        phase: { kind: "briefing" },
        revenue: {
          ...state.revenue,
          today: 0,
          dailyTarget: nextPlan.revenueTarget,
        },
        resolvedQueue: [],
      };
    }
  }

  const endingRules = content.endingRecords.flatMap((record) => record.rules);
  const ending = determineEnding(
    state,
    convergenceAxis ? { convergenceAxis } : {},
    endingRules,
  );
  state = { ...state, phase: { kind: "ending", endingId: ending.id } };
  const effectiveConvergenceAxis = convergenceAxis ?? finalQueueAxis;
  if (!effectiveConvergenceAxis) {
    throw task5SimulationError("Task 5 simulation did not resolve a convergence axis");
  }

  const fingerprint: GoldenRouteFingerprint = {
    endingId: ending.id,
    world: { ...state.world },
    stability: state.stability,
    awareness: state.awareness,
    convergenceAxis: effectiveConvergenceAxis,
    customerStates: { ...state.customerStates },
    flags: [...state.flags],
    encounterDecisionCount: executionDecisions.length,
    completedDayCount,
    selectedNewsCount: selectedNews.length,
    readNewsCount: state.readNews.length,
  };

  return {
    routeId,
    state,
    ending,
    fingerprint,
    decisions: executionDecisions,
    selectedNews,
    readNews: [...state.readNews],
    completedDayCount,
    convergenceAxis,
  };
}

export function simulateTask5GoldenRoute(
  route: GoldenRoute,
  content: Task5Content = DEFAULT_TASK5_CONTENT,
): Task5SimulationResult {
  const decisions: Task5SimulationDecision[] = route.decisions.map((decision: GoldenRouteDecision) => ({
    encounterId: decision.encounterId,
    decision: "recommend",
    recommendedItemId: decision.recommendedItemId,
  }));
  return simulateTask5Decisions(decisions, content, route.id);
}

export function simulateTask5AllRefusal(
  content: Task5Content = DEFAULT_TASK5_CONTENT,
): Task5SimulationResult {
  const decisions: Task5SimulationDecision[] = content.encounters.map((encounter) => ({
    encounterId: encounter.id,
    decision: "refuse",
  }));
  return simulateTask5Decisions(decisions, content, "task5-all-refusal-boundary");
}

function sameCustomerStates(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return sameValue(leftKeys, rightKeys) && leftKeys.every((key) => left[key] === right[key]);
}

function sameGoldenRouteFingerprint(
  actual: GoldenRouteFingerprint,
  expected: GoldenRouteFingerprint,
): boolean {
  return (
    actual.endingId === expected.endingId &&
    WORLD_AXES.every((axis) => actual.world[axis] === expected.world[axis]) &&
    actual.stability === expected.stability &&
    actual.awareness === expected.awareness &&
    actual.convergenceAxis === expected.convergenceAxis &&
    sameCustomerStates(actual.customerStates, expected.customerStates) &&
    sameValue(actual.flags, expected.flags) &&
    actual.encounterDecisionCount === expected.encounterDecisionCount &&
    actual.completedDayCount === expected.completedDayCount &&
    actual.selectedNewsCount === expected.selectedNewsCount &&
    actual.readNewsCount === expected.readNewsCount
  );
}

function checkTask5RouteDefinitions(content: Task5Content, issues: string[]): void {
  const routes = content.goldenRoutes;
  if (routes.length !== ENDING_IDS.length) {
    issues.push(`expected exactly five golden routes; received ${routes.length}`);
  }
  checkUniqueIds(routes, "golden route", issues);

  const expectedEndingIds = new Set<string>();
  const canonicalEncounterIds = new Set(content.encounters.map((encounter) => encounter.id));
  const reachedEndingIds = new Map<string, string[]>();
  for (const route of routes) {
    if (expectedEndingIds.has(route.expected.endingId)) {
      issues.push(`duplicate golden route ending ${route.expected.endingId}`);
    }
    expectedEndingIds.add(route.expected.endingId);
    if (route.decisions.length !== content.encounters.length) {
      issues.push(`route ${route.id} must contain exactly 29 decisions`);
    }
    const routeEncounterIds = new Set<string>();
    for (const decision of route.decisions) {
      if (!canonicalEncounterIds.has(decision.encounterId)) {
        issues.push(`route ${route.id} references missing encounter ${decision.encounterId}`);
        continue;
      }
      if (routeEncounterIds.has(decision.encounterId)) {
        issues.push(`route ${route.id} repeats encounter ${decision.encounterId}`);
      }
      routeEncounterIds.add(decision.encounterId);
      const encounter = content.encounters.find(
        (candidate) => candidate.id === decision.encounterId,
      );
      if (
        encounter &&
        !encounter.recommendationOptions.some(
          (option) => option.itemId === decision.recommendedItemId,
        )
      ) {
        issues.push(
          `route ${route.id} recommends ${decision.recommendedItemId} for an unavailable option`,
        );
      }
    }
    if (!sameValue([...routeEncounterIds].sort(), [...canonicalEncounterIds].sort())) {
      issues.push(`route ${route.id} must cover every canonical encounter exactly once`);
    }

    try {
      const simulation = simulateTask5GoldenRoute(route, content);
      if (!sameGoldenRouteFingerprint(simulation.fingerprint, route.expected)) {
        issues.push(`route ${route.id} expected fingerprint does not match simulation`);
      }
      if (simulation.selectedNews.length !== 15) {
        issues.push(`route ${route.id} must select exactly 15 news articles`);
      }
      if (new Set(simulation.selectedNews.map((selection) => selection.newsId)).size !== 15) {
        issues.push(`route ${route.id} must select 15 unique news articles`);
      }
      if (simulation.readNews.length !== 15 || new Set(simulation.readNews).size !== 15) {
        issues.push(`route ${route.id} must read each selected article exactly once`);
      }
      for (const day of DAYS) {
        const selections = simulation.selectedNews.filter((selection) => selection.day === day);
        if (
          selections.length !== NEWS_SLOTS.length ||
          !NEWS_SLOTS.every((slot) => selections.some((selection) => selection.slot === slot))
        ) {
          issues.push(`route ${route.id} must fill all three news slots on day ${day}`);
        }
      }
      const endingRoutes = reachedEndingIds.get(simulation.ending.id) ?? [];
      endingRoutes.push(route.id);
      reachedEndingIds.set(simulation.ending.id, endingRoutes);
    } catch (error) {
      addEngineIssues(issues, `route ${route.id}`, error);
    }
  }

  for (const endingId of ENDING_IDS) {
    const routeIds = reachedEndingIds.get(endingId) ?? [];
    if (routeIds.length !== 1) {
      issues.push(`ending ${endingId} must be reached by exactly one golden route`);
    }
  }
  for (const endingId of expectedEndingIds) {
    if (!ENDING_IDS.includes(endingId as (typeof ENDING_IDS)[number])) {
      issues.push(`golden routes reference unexpected ending ${endingId}`);
    }
  }
}

function collectTask5SemanticIssues(content: Task5Content): string[] {
  const issues: string[] = [];
  if (content.contentVersion !== TASK5_CONTENT_VERSION) {
    issues.push(
      `contentVersion must be ${TASK5_CONTENT_VERSION}; received ${content.contentVersion}`,
    );
  }

  try {
    NewsCatalogSchema.parse({
      contentVersion: TASK5_CONTENT_VERSION,
      articles: content.news,
    });
  } catch (error) {
    addEngineIssues(issues, "news catalog contract", error);
  }
  try {
    EndingBundleSchema.parse({
      contentVersion: TASK5_CONTENT_VERSION,
      records: content.endingRecords,
      routes: content.goldenRoutes,
    });
  } catch (error) {
    addEngineIssues(issues, "ending bundle contract", error);
  }

  const task4Core: AuthoredContent = {
    contentVersion: TASK4_CONTENT_VERSION,
    items: content.items,
    customers: content.customers,
    encounters: content.encounters,
    recommendationPairs: content.recommendationPairs,
    dayPlans: content.dayPlans,
    day5Convergence: content.day5Convergence,
  };
  try {
    validateTask4Content(task4Core);
  } catch (error) {
    addEngineIssues(issues, "accepted Task 4 core", error);
  }

  checkCanonicalTask4Core(content, issues);
  checkTask5News(content, issues);
  checkTask5CoreConditionReferences(content, issues);
  const semanticReferences = buildTask5SemanticReferenceRegistry(content);
  checkTask7SemanticReferences(content, semanticReferences, issues);
  checkTask5NewsSelectionWitnesses(content, issues);
  checkTask5EndingRecords(content, issues);
  checkTask5RouteDefinitions(content, issues);

  return issues;
}

/**
 * Parses and semantically validates the complete Task 5 aggregate.
 * The returned value is the strict parser's detached clone; neither input
 * objects nor the startup catalogs are mutated by validation or simulation.
 */
export function validateTask5Content(input: unknown): Task5Content {
  const content = Task5ContentSchema.parse(input);
  const issues = collectTask5SemanticIssues(content);
  if (issues.length > 0) {
    throw new ContentValidationError("Invalid Task 5 content", issues);
  }
  return content;
}

export { ContentValidationError };

export {
  buildSemanticReferenceRegistry,
  buildTask5SemanticReferenceRegistry,
  createSemanticReferenceRegistry,
} from "./semanticReferences";
export type { SemanticReferenceRegistry, SemanticReferenceSlot } from "./semanticReferences";
