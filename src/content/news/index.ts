import type { NewsArticle } from "../../domain";
import {
  NewsCatalogSchema,
  TASK5_NEWS_CONTENT_VERSION,
  type NewsCatalog,
} from "./contracts";
import { TASK5_DAY1_NEWS } from "./day1";
import { TASK5_DAY2_NEWS } from "./day2";
import { TASK5_DAY3_NEWS } from "./day3";
import { TASK5_DAY4_NEWS } from "./day4";
import { TASK5_DAY5_NEWS } from "./day5";

export * from "./contracts";
export * from "./day1";
export * from "./day2";
export * from "./day3";
export * from "./day4";
export * from "./day5";

/** All 30 authored Task 5 news candidates in day order. */
export const TASK5_NEWS: NewsArticle[] = [
  ...TASK5_DAY1_NEWS,
  ...TASK5_DAY2_NEWS,
  ...TASK5_DAY3_NEWS,
  ...TASK5_DAY4_NEWS,
  ...TASK5_DAY5_NEWS,
];

/** The frozen Task 5 news wrapper validated at module load. */
export const TASK5_NEWS_CATALOG: NewsCatalog = NewsCatalogSchema.parse({
  contentVersion: TASK5_NEWS_CONTENT_VERSION,
  articles: TASK5_NEWS,
});
