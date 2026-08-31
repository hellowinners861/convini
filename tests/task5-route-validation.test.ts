import { describe, expect, it } from "vitest";
import {
  TASK5_CONTENT,
  TASK5_GOLDEN_ROUTES,
  simulateTask5AllRefusal,
  simulateTask5GoldenRoute,
} from "../src/content";
import { ENDING_IDS, STRONG_AXIS_THRESHOLD, WORLD_AXES } from "../src/domain";

describe("Task 5 reusable golden-route simulation", () => {
  it("executes each canonical route through the real 29-encounter queue", () => {
    const before = structuredClone(TASK5_CONTENT);

    for (const route of TASK5_GOLDEN_ROUTES) {
      const first = simulateTask5GoldenRoute(route, TASK5_CONTENT);
      const second = simulateTask5GoldenRoute(route, TASK5_CONTENT);

      expect(first.fingerprint).toEqual(route.expected);
      expect(first.fingerprint.endingId).toBe(route.expected.endingId);
      expect(first.decisions).toHaveLength(29);
      expect(new Set(first.decisions.map((decision) => decision.encounterId))).toHaveLength(29);
      expect(first.completedDayCount).toBe(5);
      expect(first.selectedNews).toHaveLength(15);
      expect(new Set(first.selectedNews.map((selection) => selection.newsId))).toHaveLength(15);
      expect(first.readNews).toHaveLength(15);
      expect(new Set(first.readNews)).toHaveLength(15);
      expect(first).toEqual(second);
    }

    expect(TASK5_CONTENT).toEqual(before);
  });

  it("reaches every ending exactly once across the five declarations", () => {
    const endings = TASK5_GOLDEN_ROUTES.map((route) =>
      simulateTask5GoldenRoute(route, TASK5_CONTENT).ending.id,
    );

    expect(endings).toEqual(expect.arrayContaining([...ENDING_IDS]));
    expect(new Set(endings)).toHaveLength(5);
  });

  it("keeps the all-refusal boundary on the nonfallback inventory rule", () => {
    const result = simulateTask5AllRefusal(TASK5_CONTENT);

    expect(result.state.world).toEqual({ undead: 4, machine: 4, cosmic: 4, spirit: 4 });
    expect(result.state.stability).toBe(-18);
    expect(result.state.flags).toContain("convergence_refused");
    expect(
      WORLD_AXES.filter((axis) => result.state.world[axis] >= STRONG_AXIS_THRESHOLD),
    ).toHaveLength(4);
    expect(result.ending.id).toBe("inventory_mixup");
    expect(result.ending.isFallback).toBe(false);
    expect(result.ending.priority).toBe(300);
    expect(result.decisions).toHaveLength(29);
    expect(result.selectedNews).toHaveLength(15);
    expect(result.readNews).toHaveLength(15);
  });
});
