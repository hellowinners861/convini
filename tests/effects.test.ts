import { describe, expect, it } from "vitest";
import { applyEffects, applyOutcome, validateOutcomeEffects } from "../src/engine";
import { makeState } from "./fixtures/state";

describe("atomic effects", () => {
  it("aggregates numeric targets once from one starting snapshot", () => {
    const state = makeState({ world: { undead: 1 }, stability: 0 });
    const next = applyEffects(state, [
      { kind: "add", target: "world.undead", amount: 2 },
      { kind: "add", target: "world.undead", amount: 3 },
      { kind: "add", target: "stability", amount: 2 },
      { kind: "add", target: "stability", amount: -1 },
      { kind: "setFlag", id: "sold-item" },
      { kind: "setCustomerState", customerId: "hayakawa", state: "fed" },
    ]);

    expect(next.world.undead).toBe(6);
    expect(next.stability).toBe(1);
    expect(next.flags).toContain("sold-item");
    expect(next.customerStates.hayakawa).toBe("fed");
    expect(state.world.undead).toBe(1);
    expect(state.flags).toEqual([]);
    expect(state.customerStates).toEqual({});
  });

  it("applies an Outcome through the same atomic path", () => {
    const state = makeState();
    const outcome = {
      id: "sell",
      effects: [
        { kind: "add" as const, target: "revenue.today" as const, amount: 120 },
        { kind: "add" as const, target: "revenue.total" as const, amount: 120 },
      ],
    };

    expect(applyOutcome(state, outcome).revenue).toEqual({ total: 120, today: 120, dailyTarget: 0 });
  });

  it("rejects multiple customer state writes in the same outcome", () => {
    const effects = [
      { kind: "setCustomerState" as const, customerId: "hotaru", state: "remembered" },
      { kind: "setCustomerState" as const, customerId: "hotaru", state: "sealed" },
    ];

    expect(() => applyEffects(makeState(), effects)).toThrow(/hotaru/);
    expect(() => validateOutcomeEffects({ id: "invalid", effects })).toThrow(/hotaru/);
  });
});
