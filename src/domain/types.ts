import type {
  ComparisonOperator,
  Day,
  EndingId,
  EncounterSubPhase,
  NewsRole,
  NewsSlot,
  NumericEffectTarget,
  NumericReference,
  WorldAxis,
} from "./constants";

export type GamePhase =
  | { kind: "briefing" }
  | { kind: "encounter"; subPhase: EncounterSubPhase; encounterId: string; slotId: string }
  | { kind: "shiftSummary" }
  | { kind: "news" }
  | { kind: "ending"; endingId: EndingId }
  | { kind: "runSummary" };

export interface RevenueState {
  total: number;
  today: number;
  dailyTarget: number;
}

export interface DomainEvent {
  id: string;
  type: string;
  day: Day;
  data: Record<string, string | number | boolean>;
}

export interface NewsSelection {
  day: Day;
  slot: NewsSlot;
  newsId: string;
}

export interface GameState {
  schemaVersion: 1;
  contentVersion: string;
  runId: string;
  runNumber: number;
  day: Day;
  phase: GamePhase;
  world: Record<WorldAxis, number>;
  stability: number;
  awareness: number;
  managerTrust: number;
  revenue: RevenueState;
  flags: string[];
  customerStates: Record<string, string>;
  seenNews: string[];
  readNews: string[];
  resolvedQueue: string[];
  newsSelections: NewsSelection[];
  eventLog: DomainEvent[];
}

export type Condition =
  | { true: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | {
      numeric: {
        reference: NumericReference;
        operator: ComparisonOperator;
        value: number;
      };
    }
  | { flag: { id: string; present?: boolean } }
  | { customerState: { customerId: string; state: string } }
  | { seenNews: { id: string; present?: boolean } }
  | { readNews: { id: string; present?: boolean } }
  | { leadingAxis: { axis: WorldAxis } };

export type Effect =
  | { kind: "add"; target: NumericEffectTarget; amount: number }
  | { kind: "setFlag"; id: string }
  | { kind: "setCustomerState"; customerId: string; state: string };

export interface Outcome {
  id: string;
  effects: Effect[];
}

export interface EncounterCandidate {
  encounterId: string;
  conditions: Condition;
  priority: number;
}

export interface EncounterSlot {
  id: string;
  candidates: EncounterCandidate[];
  fallbackEncounterId: string;
}

export interface Day5AnomalySlot {
  slotId: string;
  customerId: string;
  axis: WorldAxis;
  /** Higher values mean more unresolved and are ordered first on ties. */
  unresolvedness: number;
  /** Compared using the fixed WORLD_AXES order; no event-log lookup is performed. */
  lastAffectedAxis: WorldAxis;
}

export interface DayEncounterPlan {
  day: Day;
  slots: EncounterSlot[];
  day5AnomalyOrder?: Day5AnomalySlot[];
}

export interface ResolvedEncounterQueue {
  day: Day;
  snapshot: GameState;
  encounterIds: string[];
}

export type RecommendationMode = "append-base-sale" | "replace-base-sale";

export interface RecommendationPair {
  id: string;
  customerId: string;
  requestedItemId: string;
  recommendedItemId: string;
  conditions: Condition;
  priority: number;
  mode: RecommendationMode;
  outcome: Outcome;
}

export interface RecommendationResolution {
  source: "pair" | "default";
  mode: RecommendationMode | "default";
  pairId?: string;
  outcome: Outcome;
}

export interface NewsArticle {
  id: string;
  day: Day;
  role: NewsRole;
  notificationHeadline: string;
  headline: string;
  body: string;
  conditions: Condition;
  priority: number;
  effectsOnRead: Effect[];
  exclusiveGroup?: string;
  isFallback: boolean;
}

export interface NewsReadResult {
  state: GameState;
  applied: boolean;
}

export interface EndingDefinition {
  id: EndingId;
  title: string;
  priority: number;
  condition: Condition;
  isFallback?: boolean;
}

export interface EndingResolution {
  id: EndingId;
  title: string;
  priority: number;
  isFallback: boolean;
}
