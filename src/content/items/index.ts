import { TASK4_ABNORMAL_ITEMS } from "./abnormal";
import { TASK4_ORDINARY_ITEMS } from "./ordinary";

export * from "./abnormal";
export * from "./ordinary";

/** The runtime item catalog, assembled without cloning or redefining leaf data. */
export const TASK4_ITEMS = [...TASK4_ORDINARY_ITEMS, ...TASK4_ABNORMAL_ITEMS];
export const TASK4_ITEM_CATALOG = TASK4_ITEMS;
