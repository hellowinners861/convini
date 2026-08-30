import { describe, expect, it } from "vitest";
import {
  ConditionSchema,
  EffectSchema,
  GameStateSchema,
  createInitialGameState,
} from "../src/domain";

describe("domain schemas and initial state", () => {
  it("creates a schema-valid initial state using only caller-provided identity values", () => {
    const state = createInitialGameState({
      runId: "external-run-id",
      contentVersion: "fixture-v1",
      runNumber: 3,
      dailyTarget: 500,
    });

    expect(state.runId).toBe("external-run-id");
    expect(state.contentVersion).toBe("fixture-v1");
    expect(GameStateSchema.safeParse(state).success).toBe(true);
  });

  it("rejects incompatible schema versions and malformed phases", () => {
    const state = createInitialGameState({ runId: "run", contentVersion: "v1" });
    expect(GameStateSchema.safeParse({ ...state, schemaVersion: 2 }).success).toBe(false);
    expect(GameStateSchema.safeParse({ ...state, phase: { kind: "unknown" } }).success).toBe(false);
  });

  it("keeps condition and effect targets closed over the allowed domain", () => {
    expect(
      ConditionSchema.safeParse({ numeric: { reference: "state.hidden", operator: "eq", value: 1 } })
        .success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ kind: "add", target: "state.hidden", amount: 1 }).success,
    ).toBe(false);
    expect(
      EffectSchema.safeParse({ kind: "add", target: "world.machine", amount: 1 }).success,
    ).toBe(true);
  });
});
