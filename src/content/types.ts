import type {
  Condition,
  Day,
  DayEncounterPlan,
  Outcome,
  RecommendationPair,
  WorldAxis,
} from "../domain";
import type { EndingRecord, GoldenRoute } from "./endings/contracts";
import type { NewsArticle } from "../domain";

/** A stable, authored key. Paths and executable expressions are intentionally not part of content. */
export type ContentId = string;

export interface NarrativeVariant {
  id: ContentId;
  condition: Condition;
  priority: number;
  text: string;
}

/** A conditional piece of copy always has an unconditional fallback string. */
export interface ConditionalNarrative {
  variants: NarrativeVariant[];
  fallback: string;
}

export type Narrative = string | ConditionalNarrative;

export interface ResultCopy {
  result: Narrative;
  readback: Narrative;
  receipt: Narrative;
}

export interface OrdinaryItemDefinition {
  id: ContentId;
  kind: "ordinary";
  name: string;
  description: string;
  price: number;
}

export interface AbnormalItemDefinition {
  id: ContentId;
  kind: "abnormal";
  name: string;
  description: string;
  price: number;
  axis: WorldAxis;
  anomalyRole: "base" | "coexist" | "runaway";
}

export type ItemDefinition = OrdinaryItemDefinition | AbnormalItemDefinition;

export interface CustomerDefinition {
  id: ContentId;
  name: string;
  description: string;
  axis?: WorldAxis;
  role: "major" | "incidental" | "staff";
}

export interface RecommendationOption {
  id: ContentId;
  itemId: ContentId;
  label: string;
  description: string;
  resultCopy: ResultCopy;
}

/** Domain effects remain the source of truth; authored content adds the copy shown after the choice. */
export interface AuthoredOutcome extends Outcome {
  copy: ResultCopy;
}

export type AuthoredRecommendationPair = RecommendationPair;

export interface EncounterOutcomeSet {
  sell: AuthoredOutcome;
  refuse: AuthoredOutcome;
  defaultRecommend: AuthoredOutcome;
}

export interface AuthoredEncounter {
  id: ContentId;
  customerId: ContentId;
  requestedItemId: ContentId;
  intro: Narrative;
  scan: Narrative;
  recommendationOptions: RecommendationOption[];
  outcomes: EncounterOutcomeSet;
}

export interface BriefingPresentation {
  eyebrow: Narrative;
  heading: Narrative;
  body: Narrative;
  checklist: string[];
}

export interface ShiftSummaryPresentation {
  heading: Narrative;
  body: Narrative;
  nextAction: Narrative;
}

export interface DailyPresentation {
  day: Day;
  briefing: BriefingPresentation;
  shiftSummary: ShiftSummaryPresentation;
}

export interface AuthoredDayPlan extends DayEncounterPlan {
  revenueTarget: number;
  presentation: DailyPresentation;
}

export interface Day5ConvergenceMetadata {
  day: 5;
  finalQueueIndex: number;
  successfulSaleAxisBonus: number;
  refusalStabilityDelta: number;
  refusalFlagId: ContentId;
}

export interface AuthoredContent {
  contentVersion: string;
  items: ItemDefinition[];
  customers: CustomerDefinition[];
  encounters: AuthoredEncounter[];
  recommendationPairs: AuthoredRecommendationPair[];
  dayPlans: AuthoredDayPlan[];
  day5Convergence: Day5ConvergenceMetadata;
}

/** The complete Task 5 aggregate: the frozen Task 4 core plus news, endings, and routes. */
export interface Task5Content extends AuthoredContent {
  contentVersion: string;
  news: NewsArticle[];
  endingRecords: EndingRecord[];
  goldenRoutes: GoldenRoute[];
}

// Descriptive aliases keep the contract convenient for catalog modules without introducing new domain types.
export type AuthoredItem = ItemDefinition;
export type OrdinaryItem = OrdinaryItemDefinition;
export type AbnormalItem = AbnormalItemDefinition;
export type AuthoredCustomer = CustomerDefinition;
export type AuthoredDayPlanContent = AuthoredDayPlan;
export type Task4Content = AuthoredContent;
export type ContentCatalog = AuthoredContent;
export type Task5ContentCatalog = Task5Content;
