import { EndingBundleSchema } from "./contracts";
import type { EndingBundle } from "./contracts";
import { TASK5_ENDING_RECORDS } from "./records";
import { TASK5_GOLDEN_ROUTES } from "./routes";
import { TASK5_ENDINGS_CONTENT_VERSION } from "./contracts";

export * from "./contracts";
export * from "./records";
export * from "./routes";
export { ENDING_RULES } from "../../domain";

/** The complete, strictly parsed T5-C ending and golden-route bundle. */
export const TASK5_ENDING_BUNDLE: EndingBundle = EndingBundleSchema.parse({
  contentVersion: TASK5_ENDINGS_CONTENT_VERSION,
  records: TASK5_ENDING_RECORDS,
  routes: TASK5_GOLDEN_ROUTES,
});

export const ENDING_BUNDLE = TASK5_ENDING_BUNDLE;
