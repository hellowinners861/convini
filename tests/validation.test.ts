import { describe, expect, it } from "vitest";
import {
  assertUniqueIds,
  validateEncounterSlots,
  validateRecommendationPairs,
} from "../src/engine";
import type { RecommendationPair } from "../src/domain";
import { alwaysTrue } from "./fixtures/state";

describe("content validation boundaries", () => {
  it("detects duplicate IDs and missing encounter references", () => {
    expect(() => assertUniqueIds([{ id: "same" }, { id: "same" }], "fixture")).toThrow(/same/);
    expect(() =>
      validateEncounterSlots(
        [
          {
            id: "slot",
            candidates: [{ encounterId: "missing", conditions: alwaysTrue, priority: 1 }],
            fallbackEncounterId: "fallback",
          },
        ],
        ["other"],
      ),
    ).toThrow(/missing/);
  });

  it("detects ambiguous same-priority pair triples before runtime resolution", () => {
    const makePair = (id: string): RecommendationPair => ({
      id,
      customerId: "customer",
      requestedItemId: "requested",
      recommendedItemId: "recommended",
      conditions: alwaysTrue,
      priority: 1,
      mode: "append-base-sale",
      outcome: { id: `outcome-${id}`, effects: [] },
    });

    expect(() => validateRecommendationPairs([makePair("a"), makePair("b")])).toThrow(/ambiguous/);
  });
});
