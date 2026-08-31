import {
  DEFAULT_DAILY_TARGET,
  DEFAULT_RUN_NUMBER,
  SCHEMA_VERSION,
} from "./constants";
import type { GameState } from "./types";

export interface InitialGameStateOptions {
  runId: string;
  contentVersion: string;
  runNumber?: number;
  dailyTarget?: number;
}

export function createInitialGameState(options: InitialGameStateOptions): GameState {
  if (options.runId.length === 0) {
    throw new Error("runId must be provided by the caller.");
  }

  if (options.contentVersion.length === 0) {
    throw new Error("contentVersion must be provided by the caller.");
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: options.contentVersion,
    runId: options.runId,
    runNumber: options.runNumber ?? DEFAULT_RUN_NUMBER,
    day: 1,
    phase: { kind: "briefing" },
    world: { undead: 0, machine: 0, cosmic: 0, spirit: 0 },
    stability: 0,
    awareness: 0,
    managerTrust: 0,
    revenue: {
      total: 0,
      today: 0,
      dailyTarget: options.dailyTarget ?? DEFAULT_DAILY_TARGET,
    },
    flags: [],
    customerStates: {},
    seenNews: [],
    readNews: [],
    resolvedQueue: [],
    newsSelections: [],
    eventLog: [],
  };
}
