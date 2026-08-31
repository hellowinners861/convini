import type { Day } from "../../domain";
import { TASK4_CUSTOMERS } from "../customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../items/ordinary";

export const TASK4_CONTENT_VERSION = "task4-authored-v2" as const;
export const TASK5_CONTENT_VERSION = "task5-authored-v1" as const;
export const CONTENT_VERSION = TASK5_CONTENT_VERSION;

export const TASK4_DAILY_REVENUE_TARGETS = {
  1: 1200,
  2: 1900,
  3: 1900,
  4: 2000,
  5: 2000,
} as const satisfies Record<Day, number>;

export const DAILY_REVENUE_TARGETS = TASK4_DAILY_REVENUE_TARGETS;
export const DAILY_TARGETS = TASK4_DAILY_REVENUE_TARGETS;

export const TASK4_DAY_COUNT = 5 as const;
export const TASK4_CUSTOMER_COUNT = TASK4_CUSTOMERS.length;
export const TASK4_MAJOR_CUSTOMER_COUNT = TASK4_CUSTOMERS.filter(
  (customer) => customer.role === "major",
).length;
export const TASK4_STAFF_CUSTOMER_COUNT = TASK4_CUSTOMERS.filter(
  (customer) => customer.role === "staff",
).length;
export const TASK4_INCIDENTAL_CUSTOMER_COUNT = TASK4_CUSTOMERS.filter(
  (customer) => customer.role === "incidental",
).length;
export const TASK4_ABNORMAL_ITEM_COUNT = TASK4_ABNORMAL_ITEMS.length;
export const TASK4_ORDINARY_ITEM_COUNT = TASK4_ORDINARY_ITEMS.length;
export const TASK4_ITEM_COUNT = TASK4_ABNORMAL_ITEM_COUNT + TASK4_ORDINARY_ITEM_COUNT;

export const CATALOG_COUNTS = {
  days: TASK4_DAY_COUNT,
  customers: TASK4_CUSTOMER_COUNT,
  majorCustomers: TASK4_MAJOR_CUSTOMER_COUNT,
  staffCustomers: TASK4_STAFF_CUSTOMER_COUNT,
  incidentalCustomers: TASK4_INCIDENTAL_CUSTOMER_COUNT,
  abnormalItems: TASK4_ABNORMAL_ITEM_COUNT,
  ordinaryItems: TASK4_ORDINARY_ITEM_COUNT,
  items: TASK4_ITEM_COUNT,
} as const;

export const TASK4_GAME_CONFIG = {
  contentVersion: TASK4_CONTENT_VERSION,
  dailyRevenueTargets: TASK4_DAILY_REVENUE_TARGETS,
  counts: CATALOG_COUNTS,
} as const;

export const TASK5_GAME_CONFIG = {
  contentVersion: TASK5_CONTENT_VERSION,
  dailyRevenueTargets: TASK4_DAILY_REVENUE_TARGETS,
  counts: CATALOG_COUNTS,
} as const;
