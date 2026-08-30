import type { AuthoredEncounter } from "../types";
import { TASK4_DAY1_ENCOUNTERS } from "./day1";
import { TASK4_DAY2_ENCOUNTERS } from "./day2";
import { TASK4_DAY3_ENCOUNTERS } from "./day3";
import { TASK4_DAY4_ENCOUNTERS } from "./day4";
import { TASK4_DAY5_ENCOUNTERS } from "./day5";

export * from "./day1";
export * from "./day2";
export * from "./day3";
export * from "./day4";
export * from "./day5";

/** All 29 authored encounters in runtime day order. */
export const TASK4_ENCOUNTERS: AuthoredEncounter[] = [
  ...TASK4_DAY1_ENCOUNTERS,
  ...TASK4_DAY2_ENCOUNTERS,
  ...TASK4_DAY3_ENCOUNTERS,
  ...TASK4_DAY4_ENCOUNTERS,
  ...TASK4_DAY5_ENCOUNTERS,
];
export const TASK4_ENCOUNTER_CATALOG = TASK4_ENCOUNTERS;
