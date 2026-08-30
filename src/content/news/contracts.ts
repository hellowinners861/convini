import { z } from "zod";
import { NEWS_SLOTS, NewsArticleSchema } from "../../domain";
import type { Day, NewsArticle, NewsRole, NewsSlot } from "../../domain";

/** The content version shared by the Task 5 news and ending bundles. */
export const TASK5_NEWS_CONTENT_VERSION = "task5-authored-v1" as const;
export const TASK5_CONTENT_VERSION = TASK5_NEWS_CONTENT_VERSION;
export const NEWS_CONTENT_VERSION = TASK5_NEWS_CONTENT_VERSION;

/** Frozen news-catalog shape expected by the later aggregate validator. */
export const TASK5_NEWS_TOTAL = 30 as const;
export const TASK5_NEWS_PER_DAY_COUNTS = {
  1: 6,
  2: 6,
  3: 5,
  4: 5,
  5: 8,
} as const satisfies Record<Day, number>;
export const TASK5_NEWS_ROLE_TOTALS = {
  direct: 10,
  trend: 15,
  discrepancy: 4,
  local: 1,
} as const satisfies Record<NewsRole, number>;
export const TASK5_NEWS_SELECTED_PER_DAY = 3 as const;
export const TASK5_NEWS_SELECTED_TOTAL = 15 as const;
export const TASK5_NEWS_READ_TOTAL = 15 as const;
export const TASK5_NEWS_FALLBACK_PRIORITY = -100 as const;
export const TASK5_NEWS_NORMAL_PRIORITY = 200 as const;
export const TASK5_NEWS_FINAL_REFUSAL_PRIORITY = 300 as const;
export const TASK5_NEWS_CANONICAL_SLOTS = NEWS_SLOTS satisfies readonly NewsSlot[];

export const TASK5_NEWS_CONTRACT = {
  contentVersion: TASK5_NEWS_CONTENT_VERSION,
  total: TASK5_NEWS_TOTAL,
  perDayCounts: TASK5_NEWS_PER_DAY_COUNTS,
  roleTotals: TASK5_NEWS_ROLE_TOTALS,
  selectedPerDay: TASK5_NEWS_SELECTED_PER_DAY,
  selectedTotal: TASK5_NEWS_SELECTED_TOTAL,
  readTotal: TASK5_NEWS_READ_TOTAL,
  priorities: {
    fallback: TASK5_NEWS_FALLBACK_PRIORITY,
    normal: TASK5_NEWS_NORMAL_PRIORITY,
    finalRefusal: TASK5_NEWS_FINAL_REFUSAL_PRIORITY,
  },
  canonicalSlots: TASK5_NEWS_CANONICAL_SLOTS,
} as const;

// Short aliases keep the structural constants convenient for catalog modules.
export const NEWS_TOTAL = TASK5_NEWS_TOTAL;
export const NEWS_PER_DAY_COUNTS = TASK5_NEWS_PER_DAY_COUNTS;
export const NEWS_ROLE_TOTALS = TASK5_NEWS_ROLE_TOTALS;
export const NEWS_SELECTED_PER_DAY = TASK5_NEWS_SELECTED_PER_DAY;
export const NEWS_SELECTED_TOTAL = TASK5_NEWS_SELECTED_TOTAL;
export const NEWS_READ_TOTAL = TASK5_NEWS_READ_TOTAL;
export const NEWS_FALLBACK_PRIORITY = TASK5_NEWS_FALLBACK_PRIORITY;
export const NEWS_NORMAL_PRIORITY = TASK5_NEWS_NORMAL_PRIORITY;
export const NEWS_FINAL_REFUSAL_PRIORITY = TASK5_NEWS_FINAL_REFUSAL_PRIORITY;
export const NEWS_CANONICAL_SLOTS = TASK5_NEWS_CANONICAL_SLOTS;

export interface NewsCatalog {
  contentVersion: string;
  articles: NewsArticle[];
}

export type Task5NewsCatalog = NewsCatalog;
export type NewsCatalogContent = NewsCatalog;

const NonBlankTextSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "must not be blank");

const NewsArticleContentSchema: z.ZodType<NewsArticle> = NewsArticleSchema.superRefine(
  (article, context) => {
    for (const field of ["id", "notificationHeadline", "headline", "body"] as const) {
      if (article[field].trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "must not be blank",
        });
      }
    }
    if (article.exclusiveGroup !== undefined && article.exclusiveGroup.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exclusiveGroup"],
        message: "must not be blank",
      });
    }
  },
);

/**
 * A wrapper contract only: article semantics stay owned by the closed domain
 * NewsArticleSchema, and aggregate counts/references are validated later.
 */
export const NewsCatalogSchema: z.ZodType<NewsCatalog> = z
  .object({
    contentVersion: NonBlankTextSchema,
    articles: z.array(NewsArticleContentSchema).min(1),
  })
  .strict();

export const Task5NewsCatalogSchema = NewsCatalogSchema;

export function parseNewsCatalog(input: unknown): NewsCatalog {
  return NewsCatalogSchema.parse(input);
}

export const parseTask5NewsCatalog = parseNewsCatalog;
