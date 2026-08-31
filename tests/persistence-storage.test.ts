import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/domain";
import {
  META_STORAGE_KEY,
  PersistedMetaV1Schema,
  PersistedRunV1Schema,
  PersistedSettingsV1Schema,
  RUN_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  createPersistenceStore,
  type PersistedMetaV1,
  type PersistedRunV1,
  type StorageLike,
} from "../src/app/persistence";

const CONTENT_VERSION = "past-v1";

function makeRun(overrides: Partial<PersistedRunV1> = {}): PersistedRunV1 {
  return {
    ...createInitialGameState({ runId: "run-1", contentVersion: CONTENT_VERSION }),
    ...overrides,
  };
}

function makeMeta(overrides: Partial<PersistedMetaV1> = {}): PersistedMetaV1 {
  return { schemaVersion: 1, endingHistory: [], newsHistory: [], ...overrides };
}

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  readonly getCalls: string[] = [];
  readonly setCalls: string[] = [];
  readonly removeCalls: string[] = [];
  getError: unknown = undefined;
  setError: unknown = undefined;
  removeErrors = new Map<string, unknown>();

  getItem(key: string): string | null {
    this.getCalls.push(key);
    if (this.getError !== undefined) throw this.getError;
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.setCalls.push(key);
    if (this.setError !== undefined) throw this.setError;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.removeCalls.push(key);
    const error = this.removeErrors.get(key);
    if (error !== undefined) throw error;
    this.values.delete(key);
  }
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function seed(storage: MemoryStorage, key: string, value: unknown): void {
  storage.values.set(key, JSON.stringify(value));
}

describe("persistence storage adapter", () => {
  it("returns missing for absent run, meta, and settings keys", () => {
    const store = createPersistenceStore(new MemoryStorage(), CONTENT_VERSION);
    expect(store.loadRun()).toEqual({ kind: "missing" });
    expect(store.loadMeta()).toEqual({ kind: "missing" });
    expect(store.loadSettings()).toEqual({ kind: "missing" });
  });

  it("round trips all three payloads through separated keys", () => {
    const storage = new MemoryStorage();
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    const run = makeRun();
    const meta = makeMeta({
      newsHistory: [
        {
          runId: "past-run",
          runNumber: 1,
          contentVersion: CONTENT_VERSION,
          day: 1,
          newsId: "past-news",
          status: "seen",
        },
      ],
    });
    const settings = { schemaVersion: 1 as const, audioMuted: true };
    expect(store.saveRun(run)).toEqual({ kind: "saved" });
    expect(store.saveMeta(meta)).toEqual({ kind: "saved" });
    expect(store.saveSettings(settings)).toEqual({ kind: "saved" });
    expect(store.loadRun()).toEqual({ kind: "valid", value: run });
    expect(store.loadMeta()).toEqual({ kind: "valid", value: meta });
    expect(store.loadSettings()).toEqual({ kind: "valid", value: settings });
    expect(storage.setCalls).toEqual([RUN_STORAGE_KEY, META_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  });

  it("classifies malformed JSON as corrupt json without throwing", () => {
    const storage = new MemoryStorage();
    storage.values.set(RUN_STORAGE_KEY, "{not-json");
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.loadRun()).toEqual({ kind: "corrupt", reason: "json" });
  });

  it("classifies unsupported schema before full parsing", () => {
    const storage = new MemoryStorage();
    seed(storage, RUN_STORAGE_KEY, { schemaVersion: 2, arbitrary: "future" });
    seed(storage, META_STORAGE_KEY, { schemaVersion: 9 });
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.loadRun()).toEqual({ kind: "corrupt", reason: "unsupported-schema" });
    expect(store.loadMeta()).toEqual({ kind: "corrupt", reason: "unsupported-schema" });
  });

  it.each([
    ["missing schema header", { runId: "run-1" }],
    ["unknown field", { ...makeRun(), extra: true }],
    ["missing field", { ...makeRun(), runId: undefined }],
    ["whitespace identifier", { ...makeRun(), runId: "   " }],
    ["nonfinite number after JSON", { ...makeRun(), stability: null }],
  ])("classifies %s as corrupt schema", (_label, payload) => {
    const storage = new MemoryStorage();
    seed(storage, RUN_STORAGE_KEY, payload);
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.loadRun()).toEqual({ kind: "corrupt", reason: "schema" });
  });

  it("reports incompatible run content before accepting the payload", () => {
    const storage = new MemoryStorage();
    seed(storage, RUN_STORAGE_KEY, { ...makeRun(), contentVersion: "newer-v2" });
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.loadRun()).toEqual({
      kind: "incompatible-content",
      foundContentVersion: "newer-v2",
      expectedContentVersion: CONTENT_VERSION,
    });
  });

  it("separates structural validity from an injected semantic validator", () => {
    const storage = new MemoryStorage();
    const run = makeRun({ day: 2 });
    seed(storage, RUN_STORAGE_KEY, run);
    const store = createPersistenceStore(storage, {
      expectedContentVersion: CONTENT_VERSION,
      validateRun: (candidate) => candidate.day === 1,
    });
    expect(PersistedRunV1Schema.safeParse(run).success).toBe(true);
    expect(store.loadRun()).toEqual({ kind: "corrupt", reason: "semantic" });
    expect(store.saveRun(run)).toEqual({
      kind: "failed",
      operation: "write",
      reason: "unknown",
    });
  });

  it("classifies a throwing semantic validator as semantic corruption", () => {
    const storage = new MemoryStorage();
    seed(storage, RUN_STORAGE_KEY, makeRun());
    const store = createPersistenceStore(storage, CONTENT_VERSION, () => {
      throw new Error("semantic failure");
    });
    expect(store.loadRun()).toEqual({ kind: "corrupt", reason: "semantic" });
  });

  it.each([
    ["SecurityError", "security"],
    ["NotAllowedError", "unknown"],
  ] as const)("classifies read error %s", (name, reason) => {
    const storage = new MemoryStorage();
    storage.getError = namedError(name);
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.loadSettings()).toEqual({ kind: "unavailable", operation: "read", reason });
  });

  it("classifies quota, security, and unknown write errors", () => {
    const cases = [
      ["QuotaExceededError", "quota"],
      ["SecurityError", "security"],
      ["UnknownError", "unknown"],
    ] as const;
    for (const [name, reason] of cases) {
      const storage = new MemoryStorage();
      storage.setError = namedError(name);
      const store = createPersistenceStore(storage, CONTENT_VERSION);
      expect(store.saveSettings({ schemaVersion: 1, audioMuted: false })).toEqual({
        kind: "failed",
        operation: "write",
        reason,
      });
    }
  });

  it("classifies the Firefox quota name as quota on write", () => {
    const storage = new MemoryStorage();
    storage.setError = namedError("NS_ERROR_DOM_QUOTA_REACHED");
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.saveSettings({ schemaVersion: 1, audioMuted: false })).toEqual({
      kind: "failed",
      operation: "write",
      reason: "quota",
    });
  });

  it("classifies security and unknown remove errors", () => {
    const storage = new MemoryStorage();
    storage.removeErrors.set(RUN_STORAGE_KEY, namedError("SecurityError"));
    storage.removeErrors.set(META_STORAGE_KEY, namedError("UnknownError"));
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.removeRun()).toEqual({
      kind: "failed",
      operation: "remove",
      reason: "security",
    });
    expect(store.removeMeta()).toEqual({
      kind: "failed",
      operation: "remove",
      reason: "unknown",
    });
  });

  it("never calls setItem for structurally, semantically, or version-invalid saves", () => {
    const storage = new MemoryStorage();
    const store = createPersistenceStore(storage, {
      expectedContentVersion: CONTENT_VERSION,
      validateRun: () => false,
    });
    expect(store.saveRun({ ...makeRun(), runId: "  " })).toEqual({
      kind: "failed",
      operation: "write",
      reason: "unknown",
    });
    expect(store.saveRun(makeRun())).toEqual({
      kind: "failed",
      operation: "write",
      reason: "unknown",
    });
    expect(store.saveRun(makeRun({ contentVersion: "wrong-v1" }))).toEqual({
      kind: "failed",
      operation: "write",
      reason: "unknown",
    });
    expect(storage.setCalls).toEqual([]);
  });

  it("rejects invalid meta and settings saves without writing", () => {
    const storage = new MemoryStorage();
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.saveMeta({ schemaVersion: 1, endingHistory: [], extra: true })).toEqual({
      kind: "failed",
      operation: "write",
      reason: "unknown",
    });
    expect(store.saveSettings({ schemaVersion: 1, audioMuted: false, reducedMotion: true })).toEqual({
      kind: "failed",
      operation: "write",
      reason: "unknown",
    });
    expect(storage.setCalls).toEqual([]);
    expect(PersistedMetaV1Schema.safeParse({ schemaVersion: 1, endingHistory: [] }).success).toBe(false);
    expect(PersistedSettingsV1Schema.safeParse({ schemaVersion: 1, audioMuted: false, reducedMotion: true }).success).toBe(false);
  });

  it("removes only the run key when run removal is requested", () => {
    const storage = new MemoryStorage();
    seed(storage, RUN_STORAGE_KEY, makeRun());
    seed(storage, META_STORAGE_KEY, makeMeta());
    seed(storage, SETTINGS_STORAGE_KEY, { schemaVersion: 1, audioMuted: false });
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(store.removeRun()).toEqual({ kind: "removed" });
    expect(storage.values.has(RUN_STORAGE_KEY)).toBe(false);
    expect(storage.values.has(META_STORAGE_KEY)).toBe(true);
    expect(storage.values.has(SETTINGS_STORAGE_KEY)).toBe(true);
  });

  it("clears all keys only when every per-key removal succeeds", () => {
    const storage = new MemoryStorage();
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    const result = store.clearAll();
    expect(result).toEqual({
      kind: "cleared",
      results: {
        run: { kind: "removed" },
        meta: { kind: "removed" },
        settings: { kind: "removed" },
      },
    });
    expect(storage.removeCalls).toEqual([RUN_STORAGE_KEY, META_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  });

  it("reports clear-all partial failure and still attempts each key", () => {
    const storage = new MemoryStorage();
    storage.removeErrors.set(META_STORAGE_KEY, namedError("SecurityError"));
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    const result = store.clearAll();
    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.failedKeys).toEqual(["meta"]);
    expect(result.reason).toBe("security");
    expect(result.results.run).toEqual({ kind: "removed" });
    expect(result.results.meta).toEqual({
      kind: "failed",
      operation: "remove",
      reason: "security",
    });
    expect(result.results.settings).toEqual({ kind: "removed" });
    expect(storage.removeCalls).toEqual([RUN_STORAGE_KEY, META_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  });

  it("does not let storage exceptions escape from any operation", () => {
    const storage = new MemoryStorage();
    storage.getError = { name: "SecurityError" };
    storage.setError = { name: "QuotaExceededError" };
    storage.removeErrors.set(RUN_STORAGE_KEY, { name: "SecurityError" });
    const store = createPersistenceStore(storage, CONTENT_VERSION);
    expect(() => store.loadRun()).not.toThrow();
    expect(() => store.saveSettings({ schemaVersion: 1, audioMuted: false })).not.toThrow();
    expect(() => store.removeRun()).not.toThrow();
  });
});
