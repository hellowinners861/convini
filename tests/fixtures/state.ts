import { createInitialGameState } from "../../src/domain";
import type { GameState } from "../../src/domain";

export type StateOverrides = Omit<Partial<GameState>, "world" | "revenue"> & {
  world?: Partial<GameState["world"]>;
  revenue?: Partial<GameState["revenue"]>;
};

export function makeState(overrides: StateOverrides = {}): GameState {
  const base = createInitialGameState({ runId: "fixture-run", contentVersion: "fixture-v1" });
  return {
    ...base,
    ...overrides,
    world: { ...base.world, ...overrides.world },
    revenue: { ...base.revenue, ...overrides.revenue },
  };
}

export const alwaysTrue = { true: true } as const;
