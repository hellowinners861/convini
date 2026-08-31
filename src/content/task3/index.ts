import {
  assertUniqueIds,
  validateDailyEncounterSlots,
  validateNewsCatalog,
  validateOutcomeEffects,
  validateRecommendationPairs,
} from "../../engine";
import { TASK3_DAY1_SLOTS, TASK3_ENCOUNTERS } from "./encounters";
import { TASK3_NEWS } from "./news";
import type { FixtureEncounter } from "./types";

export const TASK3_FIXTURE_CONTENT_VERSION = "task3-fixture-v1";

export { TASK3_BRIEFING, TASK3_DAY2_PLACEHOLDER, TASK3_SHIFT_SUMMARY } from "./briefing";
export { TASK3_DAY1_SLOTS, TASK3_ENCOUNTERS } from "./encounters";
export { TASK3_NEWS } from "./news";
export { TASK3_ENCOUNTER_UI, TASK3_NEWS_UI } from "./ui";
export type {
  FixtureBriefing,
  FixtureDay2Placeholder,
  FixtureDecision,
  FixtureEncounter,
  FixtureItem,
  FixtureNewsReadEffect,
  FixtureRecommendation,
  FixtureShiftSummary,
} from "./types";

export function validateTask3FixtureContent(): void {
  assertUniqueIds(TASK3_ENCOUNTERS, "task 3 encounter");
  validateDailyEncounterSlots(
    1,
    TASK3_DAY1_SLOTS,
    TASK3_ENCOUNTERS.map((encounter) => encounter.id),
  );

  for (const encounter of TASK3_ENCOUNTERS) {
    validateOutcomeEffects(encounter.baseSale);
    validateOutcomeEffects(encounter.refuse);
    validateOutcomeEffects(encounter.defaultRecommendation);
    validateRecommendationPairs(encounter.recommendationPairs, {
      baseSale: encounter.baseSale,
      defaultOutcome: encounter.defaultRecommendation,
    });
  }

  validateNewsCatalog(TASK3_NEWS, [1]);
}

export function getTask3Encounter(encounterId: string): FixtureEncounter | undefined {
  return TASK3_ENCOUNTERS.find((encounter) => encounter.id === encounterId);
}

export function getTask3NewsArticle(newsId: string) {
  return TASK3_NEWS.find((article) => article.id === newsId);
}
