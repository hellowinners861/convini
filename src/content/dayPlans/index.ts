import type { AuthoredDayPlan } from "../types";
import { TASK4_DAY1_PLAN } from "./day1";
import { TASK4_DAY2_PLAN } from "./day2";
import { TASK4_DAY3_PLAN } from "./day3";
import { TASK4_DAY4_PLAN } from "./day4";
import { TASK4_DAY5_PLAN } from "./day5";

export * from "./day1";
export * from "./day2";
export * from "./day3";
export * from "./day4";
export * from "./day5";

/** All five authored day plans in runtime day order. */
export const TASK4_DAY_PLANS: AuthoredDayPlan[] = [
  TASK4_DAY1_PLAN,
  TASK4_DAY2_PLAN,
  TASK4_DAY3_PLAN,
  TASK4_DAY4_PLAN,
  TASK4_DAY5_PLAN,
];
export const TASK4_DAY_PLAN_CATALOG = TASK4_DAY_PLANS;
