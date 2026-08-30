import { describe, expect, it } from "vitest";
import {
  comparePriorityThenId,
  selectBestByPriorityThenId,
  selectWithoutPriorityAmbiguity,
  sortByPriorityThenId,
} from "../src/engine";

const candidate = (id: string, priority: number) => ({ id, priority });

describe("common priority selection", () => {
  it("sorts by priority descending then ID ascending", () => {
    const items = [candidate("z", 1), candidate("b", 2), candidate("a", 2)];

    expect(sortByPriorityThenId(items).map((item) => item.id)).toEqual(["a", "b", "z"]);
    expect(selectBestByPriorityThenId(items)?.id).toBe("a");
    expect(comparePriorityThenId(candidate("a", 2), candidate("b", 2))).toBeLessThan(0);
  });

  it("can reject an ambiguous top priority when a data family requires it", () => {
    expect(() =>
      selectWithoutPriorityAmbiguity([candidate("a", 2), candidate("b", 2)], "fixture pair"),
    ).toThrow(/Ambiguous/);
    expect(selectWithoutPriorityAmbiguity([candidate("a", 3), candidate("b", 2)], "fixture pair")?.id).toBe(
      "a",
    );
  });
});
