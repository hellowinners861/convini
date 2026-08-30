import { describe, expect, it } from "vitest";
import {
  orderDay5AnomalySlots,
  resolveDayEncounterPlan,
  resolveEncounterQueue,
  resolveEncounterSlot,
  validateDailyEncounterSlots,
  validateEncounterSlots,
} from "../src/engine";
import type { Day5AnomalySlot, EncounterSlot } from "../src/domain";
import { makeState } from "./fixtures/state";

const makeSlot = (id: string, fallback = `${id}-fallback`): EncounterSlot => ({
  id,
  candidates: [
    { encounterId: `${id}-conditional`, conditions: { flag: { id: "ready" } }, priority: 10 },
  ],
  fallbackEncounterId: fallback,
});

describe("daily encounter resolution", () => {
  it("resolves matching candidates once against the day-start snapshot", () => {
    const state = makeState();
    const slot = makeSlot("slot-1");

    expect(resolveEncounterSlot(slot, state)).toBe("slot-1-fallback");
    expect(resolveEncounterSlot(slot, { ...state, flags: ["ready"] })).toBe("slot-1-conditional");
  });

  it("keeps a resolved queue stable after the state changes mid-day", () => {
    const state = makeState();
    const slots = ["slot-1", "slot-2", "slot-3", "slot-4", "slot-5"].map((id) =>
      makeSlot(id),
    );
    const queue = resolveEncounterQueue(slots, state);
    const laterState = { ...state, flags: ["ready"] };

    expect(queue.encounterIds).toEqual(slots.map((slot) => slot.fallbackEncounterId));
    expect(queue.snapshot).not.toBe(state);
    expect(laterState.flags).toEqual(["ready"]);
    expect(queue.encounterIds).toEqual(slots.map((slot) => slot.fallbackEncounterId));
    expect(queue.snapshot.flags).toEqual([]);
  });

  it("uses priority descending and ID ascending for matching candidates", () => {
    const slot: EncounterSlot = {
      id: "slot-1",
      candidates: [
        { encounterId: "z", conditions: { true: true }, priority: 2 },
        { encounterId: "a", conditions: { true: true }, priority: 2 },
        { encounterId: "highest", conditions: { true: true }, priority: 3 },
      ],
      fallbackEncounterId: "fallback",
    };

    expect(resolveEncounterSlot(slot, makeState())).toBe("highest");
    expect(resolveEncounterSlot({ ...slot, candidates: slot.candidates.slice(0, 2) }, makeState())).toBe("a");
  });

  it("enforces exactly five or six slots at the public queue boundary", () => {
    const slotsForCount = (count: number): EncounterSlot[] =>
      Array.from({ length: count }, (_, index) => makeSlot(`slot-${index}`));

    expect(() => resolveEncounterQueue(slotsForCount(4), makeState())).toThrow(/5 or 6/);
    expect(() => resolveEncounterQueue(slotsForCount(5), makeState())).not.toThrow();
    expect(() => resolveEncounterQueue(slotsForCount(6), makeState())).not.toThrow();
    expect(() => resolveEncounterQueue(slotsForCount(7), makeState())).toThrow(/5 or 6/);
    expect(() => validateDailyEncounterSlots(1, slotsForCount(4))).toThrow(/5 or 6/);
    expect(() => validateEncounterSlots([{ ...makeSlot("broken"), fallbackEncounterId: "" }])).toThrow(
      /fallback/,
    );
  });

  it("checks encounter references when an available ID set is supplied", () => {
    expect(() => validateEncounterSlots([makeSlot("slot-1")], ["other"])).toThrow(/missing/);
  });

  it("orders day 5 anomaly slots from weak axis to strong axis", () => {
    const state = makeState({
      day: 5,
      world: { undead: 5, machine: 1, cosmic: 3, spirit: 4 },
    });
    const anomalies = [
      anomaly("undead-slot", "hayakawa", "undead", 0, "undead"),
      anomaly("machine-slot", "hako-3", "machine", 0, "machine"),
      anomaly("cosmic-slot", "myu", "cosmic", 0, "cosmic"),
      anomaly("spirit-slot", "hotaru", "spirit", 0, "spirit"),
    ];

    expect(orderDay5AnomalySlots(state, anomalies).map((slot) => slot.slotId)).toEqual([
      "machine-slot",
      "cosmic-slot",
      "spirit-slot",
      "undead-slot",
    ]);
  });

  it("uses unresolvedness, last affected axis, then fixed ID for day 5 ties", () => {
    const state = makeState({ day: 5, world: { undead: 2, machine: 2, cosmic: 2, spirit: 2 } });
    const unresolvedness = [
      anomaly("low-unresolved", "a", "undead", 1, "undead"),
      anomaly("high-unresolved", "b", "machine", 4, "machine"),
      anomaly("other-c", "c", "cosmic", 0, "cosmic"),
      anomaly("other-d", "d", "spirit", 0, "spirit"),
    ];
    expect(orderDay5AnomalySlots(state, unresolvedness).slice(0, 2).map((slot) => slot.slotId)).toEqual([
      "high-unresolved",
      "low-unresolved",
    ]);

    const lastAxis = [
      anomaly("last-machine", "a", "undead", 1, "machine"),
      anomaly("last-undead", "b", "machine", 1, "undead"),
      anomaly("other-c", "c", "cosmic", 0, "cosmic"),
      anomaly("other-d", "d", "spirit", 0, "spirit"),
    ];
    expect(orderDay5AnomalySlots(state, lastAxis).slice(0, 2).map((slot) => slot.slotId)).toEqual([
      "last-undead",
      "last-machine",
    ]);

    const fixedId = [
      anomaly("z-fixed", "a", "undead", 1, "cosmic"),
      anomaly("a-fixed", "b", "machine", 1, "cosmic"),
      anomaly("other-c", "c", "cosmic", 0, "cosmic"),
      anomaly("other-d", "d", "spirit", 0, "spirit"),
    ];
    expect(orderDay5AnomalySlots(state, fixedId).slice(0, 2).map((slot) => slot.slotId)).toEqual([
      "a-fixed",
      "z-fixed",
    ]);
  });

  it("integrates day 5 ordering into a fixed five-or-six-slot plan", () => {
    const state = makeState({ day: 5, world: { undead: 5, machine: 1, cosmic: 3, spirit: 4 } });
    const plan = {
      day: 5 as const,
      slots: [
        makeSlot("briefing", "briefing-result"),
        makeSlot("undead-slot", "undead-result"),
        makeSlot("machine-slot", "machine-result"),
        makeSlot("cosmic-slot", "cosmic-result"),
        makeSlot("summary", "summary-result"),
        makeSlot("spirit-slot", "spirit-result"),
      ],
      day5AnomalyOrder: [
        anomaly("undead-slot", "hayakawa", "undead", 0, "undead"),
        anomaly("machine-slot", "hako-3", "machine", 0, "machine"),
        anomaly("cosmic-slot", "myu", "cosmic", 0, "cosmic"),
        anomaly("spirit-slot", "hotaru", "spirit", 0, "spirit"),
      ],
    };

    const queue = resolveDayEncounterPlan(plan, state);
    expect(queue.encounterIds).toEqual([
      "briefing-result",
      "machine-result",
      "cosmic-result",
      "spirit-result",
      "summary-result",
      "undead-result",
    ]);

    const laterState = makeState({ day: 5, world: { undead: 0, machine: 9, cosmic: 8, spirit: 7 } });
    expect(laterState.world).not.toEqual(queue.snapshot.world);
    expect(queue.encounterIds).toEqual([
      "briefing-result",
      "machine-result",
      "cosmic-result",
      "spirit-result",
      "summary-result",
      "undead-result",
    ]);
  });

  it("requires day 5 ordering inputs and a matching day-start snapshot", () => {
    const state = makeState({ day: 5 });
    const slots = ["a", "b", "c", "d", "e"].map((id) => makeSlot(id));
    const planWithoutOrdering = { day: 5 as const, slots };

    expect(() => resolveDayEncounterPlan(planWithoutOrdering, state)).toThrow(/ordering inputs/);
    expect(() =>
      resolveDayEncounterPlan({ ...planWithoutOrdering, day: 4 as const }, state),
    ).toThrow(/does not match/);
  });
});

function anomaly(
  slotId: string,
  customerId: string,
  axis: Day5AnomalySlot["axis"],
  unresolvedness: number,
  lastAffectedAxis: Day5AnomalySlot["lastAffectedAxis"],
): Day5AnomalySlot {
  return { slotId, customerId, axis, unresolvedness, lastAffectedAxis };
}
