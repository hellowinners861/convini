import type { EncounterSlot, Effect, Outcome, RecommendationPair } from "../../domain";

export interface FixtureItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface FixtureRecommendation extends FixtureItem {
  shortLabel: string;
}

export type FixtureDecision = "sell" | "refuse" | "recommend";

export interface FixtureEncounter {
  id: string;
  slot: EncounterSlot;
  customerId: string;
  customerName: string;
  intro: string;
  scanText: string;
  requestedItem: FixtureItem;
  recommendations: FixtureRecommendation[];
  baseSale: Outcome;
  refuse: Outcome;
  defaultRecommendation: Outcome;
  recommendationPairs: RecommendationPair[];
  resultText: Record<"sell" | "refuse", string>;
  recommendationResultText: Record<string, string>;
  receiptLabel: string;
  readback: string;
}

export interface FixtureBriefing {
  eyebrow: string;
  heading: string;
  body: string;
  checklist: string[];
}

export interface FixtureShiftSummary {
  heading: string;
  body: string;
  nextAction: string;
}

export interface FixtureDay2Placeholder {
  eyebrow: string;
  heading: string;
  body: string;
  note: string;
}

export interface FixtureNewsReadEffect {
  effects: Effect[];
}
