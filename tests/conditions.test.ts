import { describe, expect, it } from "vitest";
import { evaluateCondition, getNumericReference } from "../src/engine";
import { ConditionSchema } from "../src/domain";
import { makeState } from "./fixtures/state";

describe("condition evaluation", () => {
  it("evaluates all, any, not, including empty collection boundaries", () => {
    const state = makeState({ flags: ["ready"] });

    expect(evaluateCondition({ all: [] }, state)).toBe(true);
    expect(evaluateCondition({ any: [] }, state)).toBe(false);
    expect(
      evaluateCondition(
        {
          all: [
            { flag: { id: "ready" } },
            { not: { flag: { id: "missing" } } },
          ],
        },
        state,
      ),
    ).toBe(true);
    expect(evaluateCondition({ any: [{ flag: { id: "missing" } }, { true: true }] }, state)).toBe(
      true,
    );
  });

  it.each([
    ["eq", 3, 3, true],
    ["eq", 3, 4, false],
    ["neq", 3, 4, true],
    ["neq", 3, 3, false],
    ["gt", 3, 2, true],
    ["gt", 3, 3, false],
    ["gte", 3, 3, true],
    ["gte", 3, 4, false],
    ["lt", 3, 4, true],
    ["lt", 3, 3, false],
    ["lte", 3, 3, true],
    ["lte", 3, 2, false],
  ] as const)("supports %s and its boundary", (operator, actual, expected, result) => {
    const state = makeState({ world: { undead: actual } });
    expect(
      evaluateCondition(
        { numeric: { reference: "world.undead", operator, value: expected } },
        state,
      ),
    ).toBe(result);
  });

  it("reads only the allow-listed numeric references and derived axis values", () => {
    const state = makeState({
      day: 3,
      world: { undead: 7, machine: 5, cosmic: 4, spirit: 1 },
      stability: -2,
      awareness: 2,
      managerTrust: 3,
      revenue: { total: 40, today: 12, dailyTarget: 20 },
    });

    expect(getNumericReference(state, "world.undead")).toBe(7);
    expect(getNumericReference(state, "stability")).toBe(-2);
    expect(getNumericReference(state, "awareness")).toBe(2);
    expect(getNumericReference(state, "managerTrust")).toBe(3);
    expect(getNumericReference(state, "revenue.total")).toBe(40);
    expect(getNumericReference(state, "revenue.today")).toBe(12);
    expect(getNumericReference(state, "revenue.dailyTarget")).toBe(20);
    expect(getNumericReference(state, "day")).toBe(3);
    expect(getNumericReference(state, "leadingValue")).toBe(7);
    expect(getNumericReference(state, "secondValue")).toBe(5);
    expect(getNumericReference(state, "axisDifference")).toBe(2);
    expect(getNumericReference(state, "strongAxisCount")).toBe(3);
  });

  it("evaluates flag, customer state, seen/read news and leading axis conditions", () => {
    const state = makeState({
      flags: ["met_manager"],
      customerStates: { hako3: "empathetic" },
      seenNews: ["news-1"],
      readNews: ["news-2"],
      world: { machine: 8, undead: 2 },
    });

    expect(evaluateCondition({ flag: { id: "met_manager" } }, state)).toBe(true);
    expect(evaluateCondition({ flag: { id: "missing", present: false } }, state)).toBe(true);
    expect(evaluateCondition({ customerState: { customerId: "hako3", state: "empathetic" } }, state)).toBe(
      true,
    );
    expect(evaluateCondition({ seenNews: { id: "news-1" } }, state)).toBe(true);
    expect(evaluateCondition({ readNews: { id: "news-2" } }, state)).toBe(true);
    expect(evaluateCondition({ leadingAxis: { axis: "machine" } }, state)).toBe(true);
    expect(evaluateCondition({ leadingAxis: { axis: "undead" } }, state)).toBe(false);
  });

  it("uses the supplied convergence axis for a leading-axis tie", () => {
    const state = makeState({ world: { undead: 2, machine: 2, cosmic: 2, spirit: 2 } });

    expect(evaluateCondition({ leadingAxis: { axis: "cosmic" } }, state)).toBe(false);
    expect(
      evaluateCondition({ leadingAxis: { axis: "cosmic" } }, state, { tieBreakerAxis: "cosmic" }),
    ).toBe(true);
  });

  it("rejects arbitrary numeric references through the Zod schema", () => {
    expect(
      ConditionSchema.safeParse({
        numeric: { reference: "state.secret", operator: "eq", value: 1 },
      }).success,
    ).toBe(false);
  });
});
