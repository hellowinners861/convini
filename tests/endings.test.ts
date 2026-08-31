import { describe, expect, it } from "vitest";
import { determineEnding, validateEndingRules } from "../src/engine";
import { ENDING_RULES } from "../src/domain";
import type { EndingDefinition } from "../src/domain";
import { makeState } from "./fixtures/state";

describe("ending determination", () => {
  it.each([
    ["undead", "undead_dawnless_city"],
    ["machine", "fully_automated_business"],
    ["cosmic", "final_departure"],
    ["spirit", "city_whole_beyond"],
  ] as const)("selects the single leading axis: %s", (axis, endingId) => {
    expect(determineEnding(makeState({ world: { [axis]: 8 } })).id).toBe(endingId);
  });

  it("selects inventory mixup at the exact two-axis and stability boundary", () => {
    const state = makeState({
      world: { undead: 9, machine: 7, cosmic: 0, spirit: 0 },
      stability: -4,
    });

    expect(determineEnding(state).id).toBe("inventory_mixup");
  });

  it("keeps the non-fallback inventory rule ahead of complete-tie handling", () => {
    const state = makeState({
      world: { undead: 7, machine: 7, cosmic: 7, spirit: 7 },
      stability: -4,
    });

    expect(determineEnding(state)).toMatchObject({
      id: "inventory_mixup",
      priority: 300,
      isFallback: false,
    });
  });

  it("keeps inventory thresholds strict at the complete-tie boundary", () => {
    expect(
      determineEnding(
        makeState({
          world: { undead: 7, machine: 7, cosmic: 7, spirit: 7 },
          stability: -3,
        }),
      ).isFallback,
    ).toBe(true);
    expect(
      determineEnding(
        makeState({
          world: { undead: 6, machine: 6, cosmic: 6, spirit: 6 },
          stability: -4,
        }),
      ).isFallback,
    ).toBe(true);
  });

  it("checks final refusal mixup before complete-tie suppression", () => {
    expect(
      determineEnding(
        makeState({
          world: { undead: 4, machine: 4, cosmic: 4, spirit: 4 },
          flags: ["convergence_refused"],
        }),
      ),
    ).toMatchObject({ id: "inventory_mixup", priority: 300, isFallback: false });
  });

  it("does not select inventory mixup when a boundary is just outside", () => {
    const state = makeState({
      world: { undead: 9, machine: 7, cosmic: 0, spirit: 0 },
      stability: -3,
    });

    expect(determineEnding(state).id).toBe("undead_dawnless_city");
  });

  it("selects inventory mixup for final refusal with three strong axes", () => {
    const state = makeState({
      world: { undead: 5, machine: 4, cosmic: 4, spirit: 0 },
      flags: ["convergence_refused"],
    });

    expect(determineEnding(state).id).toBe("inventory_mixup");
  });

  it("selects non-fallback inventory mixup for the all-refusal boundary scenario", () => {
    const state = makeState({
      world: { undead: 4, machine: 4, cosmic: 4, spirit: 4 },
      stability: -18,
      flags: ["convergence_refused"],
    });

    expect(determineEnding(state)).toMatchObject({
      id: "inventory_mixup",
      priority: 300,
      isFallback: false,
    });
  });

  it("uses the fifth-day convergence axis for a complete tie", () => {
    const tied = makeState({ world: { undead: 2, machine: 2, cosmic: 2, spirit: 2 } });

    expect(determineEnding(tied, { convergenceAxis: "machine" }).id).toBe(
      "fully_automated_business",
    );
    expect(determineEnding(tied).isFallback).toBe(true);
    expect(determineEnding(tied).id).toBe("inventory_mixup");
  });

  it("requires one unconditional fallback rule", () => {
    const withoutFallback = ENDING_RULES.filter((rule) => rule.isFallback !== true);
    expect(() => validateEndingRules(withoutFallback)).toThrow(/fallback/);

    const invalidFallback: EndingDefinition = {
      id: "inventory_mixup",
      title: "在庫混線",
      priority: 0,
      condition: { flag: { id: "never" } },
      isFallback: true,
    };
    expect(() => validateEndingRules([...withoutFallback, invalidFallback])).toThrow(/unconditional/);
  });
});
