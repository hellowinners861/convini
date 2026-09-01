export * from "./types";
export * from "./schemas";
export * from "./narrative";
export * from "./config";
export * from "./items";
export * from "./customers";
export * from "./pairs";
export * from "./encounters";
export * from "./dayPlans";
export * from "./catalog";
export * from "./validation";

// The leaf bundles intentionally export their own TASK5_CONTENT_VERSION aliases.
// Keep the aggregate root explicit so those parallel contracts cannot collide.
export {
  NewsCatalogSchema,
  Task5NewsCatalogSchema,
  parseNewsCatalog,
  parseTask5NewsCatalog,
  TASK5_NEWS,
  TASK5_NEWS_CATALOG,
  TASK5_NEWS_CONTENT_VERSION,
  NEWS_CONTENT_VERSION,
} from "./news";
export type { NewsCatalog, Task5NewsCatalog } from "./news";
export {
  EndingBundleSchema,
  Task5EndingBundleSchema,
  EndingRecordSchema,
  GoldenRouteSchema,
  parseEndingBundle,
  parseTask5EndingBundle,
  TASK5_ENDING_BUNDLE,
  TASK5_ENDING_RECORDS,
  TASK5_ENDING_RULES,
  TASK5_GOLDEN_ROUTES,
  TASK5_ENDINGS_CONTENT_VERSION,
  ENDINGS_CONTENT_VERSION,
  ENDING_BUNDLE,
  ENDING_RULES,
} from "./endings";
export type {
  EndingBundle,
  Task5EndingBundle,
  EndingRecord,
  GoldenRoute,
  GoldenRouteDecision,
  GoldenRouteFingerprint,
} from "./endings";
export * from "./presentationAssets";
