import type { Day } from "../domain";
import { ContentValidationError } from "../engine/errors";
import { TASK4_CONTENT_VERSION, TASK5_CONTENT_VERSION } from "./config";
import { TASK4_CUSTOMERS } from "./customers";
import { TASK4_DAY5_CONVERGENCE, TASK4_DAY_PLANS } from "./dayPlans";
import { TASK4_ENCOUNTERS } from "./encounters";
import { TASK4_ITEMS } from "./items";
import { TASK4_RECOMMENDATION_PAIRS } from "./pairs";
import { TASK5_NEWS, TASK5_NEWS_CATALOG } from "./news";
import { TASK5_ENDING_BUNDLE, TASK5_ENDING_RECORDS, TASK5_GOLDEN_ROUTES } from "./endings";
import type {
  AuthoredContent,
  AuthoredCustomer,
  AuthoredDayPlan,
  AuthoredEncounter,
  ItemDefinition,
  Task5Content,
} from "./types";
import { validateTask4Content, validateTask5Content } from "./validation";

const assembledTask4Content: AuthoredContent = {
  contentVersion: TASK4_CONTENT_VERSION,
  items: TASK4_ITEMS,
  customers: TASK4_CUSTOMERS,
  encounters: TASK4_ENCOUNTERS,
  recommendationPairs: TASK4_RECOMMENDATION_PAIRS,
  dayPlans: TASK4_DAY_PLANS,
  day5Convergence: TASK4_DAY5_CONVERGENCE,
};

/** The startup-validated Task 4 catalog. */
export const TASK4_CONTENT = validateTask4Content(assembledTask4Content);

export const TASK4_CONTENT_TOTALS = {
  items: TASK4_CONTENT.items.length,
  customers: TASK4_CONTENT.customers.length,
  encounters: TASK4_CONTENT.encounters.length,
  recommendationPairs: TASK4_CONTENT.recommendationPairs.length,
  dayPlans: TASK4_CONTENT.dayPlans.length,
  slots: TASK4_CONTENT.dayPlans.reduce((total, plan) => total + plan.slots.length, 0),
} as const;

export const TASK4_TOTALS = TASK4_CONTENT_TOTALS;

function missingLookup(label: string, id: string, catalog = "Task 4"): never {
  throw new ContentValidationError(catalog + " " + label + " lookup failed", [
    "missing " + label + " id " + String(id),
  ]);
}

function lookupById<T extends { id: string }>(
  values: readonly T[],
  id: string,
  label: string,
  catalog = "Task 4",
): T {
  const value = values.find((candidate) => candidate.id === id);
  return value ?? missingLookup(label, id, catalog);
}

export function getTask4Item(id: string): ItemDefinition {
  return lookupById(TASK4_CONTENT.items, id, "item");
}

export function getTask4Customer(id: string): AuthoredCustomer {
  return lookupById(TASK4_CONTENT.customers, id, "customer");
}

export function getTask4Encounter(id: string): AuthoredEncounter {
  return lookupById(TASK4_CONTENT.encounters, id, "encounter");
}

export function getTask4DayPlan(day: Day): AuthoredDayPlan {
  const plan = TASK4_CONTENT.dayPlans.find((candidate) => candidate.day === day);
  return plan ?? missingLookup("day plan", String(day));
}

const assembledTask5Content: Task5Content = {
  contentVersion: TASK5_CONTENT_VERSION,
  items: TASK4_CONTENT.items,
  customers: TASK4_CONTENT.customers,
  encounters: TASK4_CONTENT.encounters,
  recommendationPairs: TASK4_CONTENT.recommendationPairs,
  dayPlans: TASK4_CONTENT.dayPlans,
  day5Convergence: TASK4_CONTENT.day5Convergence,
  news: TASK5_NEWS,
  endingRecords: TASK5_ENDING_RECORDS,
  goldenRoutes: TASK5_GOLDEN_ROUTES,
};

if (
  TASK5_NEWS_CATALOG.contentVersion !== TASK5_CONTENT_VERSION ||
  TASK5_ENDING_BUNDLE.contentVersion !== TASK5_CONTENT_VERSION
) {
  throw new ContentValidationError("Task 5 content bundle version mismatch", [
    TASK5_NEWS_CATALOG.contentVersion,
    TASK5_ENDING_BUNDLE.contentVersion,
  ]);
}

/** The startup-validated Task 5 aggregate catalog. */
export const TASK5_CONTENT = validateTask5Content(assembledTask5Content);

export const TASK5_CONTENT_TOTALS = {
  items: TASK5_CONTENT.items.length,
  customers: TASK5_CONTENT.customers.length,
  encounters: TASK5_CONTENT.encounters.length,
  recommendationPairs: TASK5_CONTENT.recommendationPairs.length,
  dayPlans: TASK5_CONTENT.dayPlans.length,
  slots: TASK5_CONTENT.dayPlans.reduce((total, plan) => total + plan.slots.length, 0),
  news: TASK5_CONTENT.news.length,
  endingRecords: TASK5_CONTENT.endingRecords.length,
  goldenRoutes: TASK5_CONTENT.goldenRoutes.length,
} as const;

export const TASK5_TOTALS = TASK5_CONTENT_TOTALS;
export const CONTENT = TASK5_CONTENT;

export function getTask5Item(id: string): ItemDefinition {
  return lookupById(TASK5_CONTENT.items, id, "item", "Task 5");
}

export function getTask5Customer(id: string): AuthoredCustomer {
  return lookupById(TASK5_CONTENT.customers, id, "customer", "Task 5");
}

export function getTask5Encounter(id: string): AuthoredEncounter {
  return lookupById(TASK5_CONTENT.encounters, id, "encounter", "Task 5");
}

export function getTask5DayPlan(day: Day): AuthoredDayPlan {
  const plan = TASK5_CONTENT.dayPlans.find((candidate) => candidate.day === day);
  return plan ?? missingLookup("day plan", String(day), "Task 5");
}

export function getTask5NewsArticle(id: string) {
  return lookupById(TASK5_CONTENT.news, id, "news", "Task 5");
}

export function getTask5EndingRecord(id: string) {
  return lookupById(TASK5_CONTENT.endingRecords, id, "ending record", "Task 5");
}

export function getTask5GoldenRoute(id: string) {
  return lookupById(TASK5_CONTENT.goldenRoutes, id, "golden route", "Task 5");
}
