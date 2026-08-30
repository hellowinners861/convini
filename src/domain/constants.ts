export const SCHEMA_VERSION = 1 as const;

export const DAYS = [1, 2, 3, 4, 5] as const;
export type Day = (typeof DAYS)[number];

export const WORLD_AXES = ["undead", "machine", "cosmic", "spirit"] as const;
export type WorldAxis = (typeof WORLD_AXES)[number];

export const ENCOUNTER_SUB_PHASES = ["intro", "scan", "decision", "result"] as const;
export type EncounterSubPhase = (typeof ENCOUNTER_SUB_PHASES)[number];

export const NEWS_SLOTS = ["direct", "trend", "discrepancy"] as const;
export type NewsSlot = (typeof NEWS_SLOTS)[number];
export const NEWS_SELECTION_COUNT = NEWS_SLOTS.length;

export const NEWS_ROLES = ["direct", "trend", "discrepancy", "local"] as const;
export type NewsRole = (typeof NEWS_ROLES)[number];

export const COMPARISON_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const NUMERIC_REFERENCES = [
  "world.undead",
  "world.machine",
  "world.cosmic",
  "world.spirit",
  "stability",
  "awareness",
  "managerTrust",
  "revenue.total",
  "revenue.today",
  "revenue.dailyTarget",
  "day",
  "leadingValue",
  "secondValue",
  "axisDifference",
  "strongAxisCount",
] as const;
export type NumericReference = (typeof NUMERIC_REFERENCES)[number];

export const EFFECT_NUMERIC_TARGETS = [
  "world.undead",
  "world.machine",
  "world.cosmic",
  "world.spirit",
  "stability",
  "awareness",
  "managerTrust",
  "revenue.total",
  "revenue.today",
  "revenue.dailyTarget",
] as const;
export type NumericEffectTarget = (typeof EFFECT_NUMERIC_TARGETS)[number];

export const STRONG_AXIS_THRESHOLD = 4;
export const DAY5_ANOMALY_COUNT = 4;
export const MIXUP_AXIS_THRESHOLD = 7;
export const MIXUP_MAX_AXIS_DIFFERENCE = 2;
export const MIXUP_MAX_STABILITY = -4;

export const DEFAULT_RUN_NUMBER = 1;
export const DEFAULT_DAILY_TARGET = 0;

export const ENDING_IDS = [
  "undead_dawnless_city",
  "fully_automated_business",
  "final_departure",
  "city_whole_beyond",
  "inventory_mixup",
] as const;
export type EndingId = (typeof ENDING_IDS)[number];

export const ENDING_TITLES: Record<EndingId, string> = {
  undead_dawnless_city: "夜明けのない街",
  fully_automated_business: "完全自動営業",
  final_departure: "最終便",
  city_whole_beyond: "街全体が彼岸",
  inventory_mixup: "在庫混線",
};
