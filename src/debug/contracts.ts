import type {
  ComparisonOperator,
  Day,
  NewsRole,
  NewsSlot,
  NumericReference,
  NumericEffectTarget,
  WorldAxis,
} from "../domain/constants";
import type { EndingResolution } from "../domain/types";

export interface AxisRankEvidence {
  readonly axis: WorldAxis;
  readonly value: number;
}

export type ConditionTrace =
  | {
      readonly kind: "true";
      readonly result: boolean;
    }
  | {
      readonly kind: "all";
      readonly result: boolean;
      readonly children: readonly ConditionTrace[];
      readonly matchedIndexes: readonly number[];
      readonly failedIndexes: readonly number[];
    }
  | {
      readonly kind: "any";
      readonly result: boolean;
      readonly children: readonly ConditionTrace[];
      readonly matchedIndexes: readonly number[];
      readonly failedIndexes: readonly number[];
    }
  | {
      readonly kind: "not";
      readonly result: boolean;
      readonly child: ConditionTrace;
    }
  | {
      readonly kind: "numeric";
      readonly result: boolean;
      readonly ref: NumericReference;
      readonly actual: number;
      readonly op: ComparisonOperator;
      readonly expected: number;
    }
  | {
      readonly kind: "flag";
      readonly result: boolean;
      readonly flag: string;
      readonly expected: boolean;
      readonly actual: boolean;
    }
  | {
      readonly kind: "customer-state";
      readonly result: boolean;
      readonly customerId: string;
      readonly expected: string;
      readonly actual: string | null;
    }
  | {
      readonly kind: "seen-news";
      readonly result: boolean;
      readonly newsId: string;
      readonly actual: boolean;
    }
  | {
      readonly kind: "read-news";
      readonly result: boolean;
      readonly newsId: string;
      readonly actual: boolean;
    }
  | {
      readonly kind: "leading-axis";
      readonly result: boolean;
      readonly expected: WorldAxis;
      readonly actual: WorldAxis;
      readonly tieBreakerAxis: WorldAxis | null;
      readonly ranking: readonly AxisRankEvidence[];
    };

export type NewsTraceExclusionCode =
  | "wrong-day"
  | "role-not-allowed"
  | "already-seen"
  | "already-selected"
  | "exclusive-conflict"
  | "condition-failed"
  | "lower-priority";

export interface NewsCandidateTrace {
  readonly id: string;
  readonly role: NewsRole;
  readonly priority: number;
  readonly conditionTrace: ConditionTrace;
  readonly eligibility: boolean;
  readonly selected: boolean;
  readonly exclusionCode: NewsTraceExclusionCode | null;
}

export interface NewsSlotTrace {
  readonly slot: NewsSlot;
  readonly allowedRoles: readonly NewsRole[];
  readonly selectedId: string;
  readonly candidates: readonly NewsCandidateTrace[];
}

export interface NewsTrace {
  readonly day: Day;
  readonly selections: readonly {
    readonly day: Day;
    readonly slot: NewsSlot;
    readonly newsId: string;
  }[];
  readonly slots: readonly NewsSlotTrace[];
}

export type EndingTraceExclusionCode =
  | "fallback-only"
  | "tie-without-convergence"
  | "condition-failed"
  | "lower-priority";

export interface EndingRuleTrace {
  readonly id: string;
  readonly priority: number;
  readonly isFallback: boolean;
  readonly conditionTrace: ConditionTrace;
  readonly eligibility: boolean;
  readonly selected: boolean;
  readonly exclusionCode: EndingTraceExclusionCode | null;
  readonly selectedResolution: EndingResolution | null;
}

export interface EndingTrace {
  readonly selectedResolution: EndingResolution;
  readonly rules: readonly EndingRuleTrace[];
}

export interface NumericEffectTrace {
  readonly target: NumericEffectTarget;
  readonly before: number;
  readonly delta: number;
  readonly after: number;
}

export interface FlagEffectTrace {
  readonly id: string;
  readonly before: boolean;
  readonly after: boolean;
  readonly changed: boolean;
}

export interface CustomerStateEffectTrace {
  readonly customerId: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly changed: boolean;
}

export interface EffectsTrace {
  readonly numeric: readonly NumericEffectTrace[];
  readonly flags: readonly FlagEffectTrace[];
  readonly customerStates: readonly CustomerStateEffectTrace[];
}

export type EffectTrace = EffectsTrace;
