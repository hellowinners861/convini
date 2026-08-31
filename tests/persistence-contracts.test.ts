import { describe, expect, it } from "vitest";
import { TASK5_CONTENT, TASK5_CONTENT_VERSION } from "../src/content";
import { createInitialGameState, type GameState } from "../src/domain";
import {
  DEFAULT_META,
  DEFAULT_SETTINGS,
  META_STORAGE_KEY,
  PersistedMetaV1Schema,
  PersistedRunV1Schema,
  PersistedSettingsV1Schema,
  RUN_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STORAGE_KEYS,
  foldRunIntoMeta,
  isMetaSemanticallyValid,
  selectArchivedNewsIds,
  selectUnlockedEndingIds,
  type PersistedMetaV1,
  type PersistedRunV1,
} from "../src/app/persistence";

function makeRun(
  overrides: Partial<PersistedRunV1> = {},
): PersistedRunV1 {
  const base = createInitialGameState({ runId: "run-1", contentVersion: "past-v1" });
  return { ...base, ...overrides };
}

function makeMeta(overrides: Partial<PersistedMetaV1> = {}): PersistedMetaV1 {
  return {
    schemaVersion: 1,
    endingHistory: [],
    newsHistory: [],
    ...overrides,
  };
}

describe("persistence contracts", () => {
  it("exports exactly the three frozen storage keys and defaults", () => {
    expect(STORAGE_KEYS).toEqual({
      run: "last-convenience:run:v1",
      meta: "last-convenience:meta:v1",
      settings: "last-convenience:settings:v1",
    });
    expect(RUN_STORAGE_KEY).toBe("last-convenience:run:v1");
    expect(META_STORAGE_KEY).toBe("last-convenience:meta:v1");
    expect(SETTINGS_STORAGE_KEY).toBe("last-convenience:settings:v1");
    expect(DEFAULT_META).toEqual({ schemaVersion: 1, endingHistory: [], newsHistory: [] });
    expect(DEFAULT_SETTINGS).toEqual({ schemaVersion: 1, audioMuted: false });
  });

  it("round trips a strict run with the exact GameState fields and no AppState envelope", () => {
    const run = makeRun({
      phase: { kind: "ending", endingId: "past-ending" },
      newsSelections: [{ day: 1, slot: "direct", newsId: "past-news" }],
      eventLog: [
        {
          id: "event-1",
          type: "encounter.decision",
          day: 1,
          data: { decision: "sell", amount: 10 },
        },
      ],
    });
    const parsed = PersistedRunV1Schema.parse(JSON.parse(JSON.stringify(run))) as PersistedRunV1;
    expect(parsed).toEqual(run);
    expect(Object.keys(parsed).sort()).toEqual([
      "awareness",
      "contentVersion",
      "customerStates",
      "day",
      "eventLog",
      "flags",
      "managerTrust",
      "newsSelections",
      "phase",
      "readNews",
      "resolvedQueue",
      "revenue",
      "runId",
      "runNumber",
      "schemaVersion",
      "seenNews",
      "stability",
      "world",
    ]);
    expect(
      PersistedRunV1Schema.safeParse({ ...run, queue: null, encounterIndex: 0 }).success,
    ).toBe(false);
  });

  it("round trips strict meta and settings payloads", () => {
    const meta = makeMeta({
      endingHistory: [
        { runId: "run-1", runNumber: 1, contentVersion: "past-v1", endingId: "old-ending" },
      ],
      newsHistory: [
        {
          runId: "run-1",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "old-news",
          status: "read",
        },
      ],
    });
    expect(PersistedMetaV1Schema.parse(JSON.parse(JSON.stringify(meta)))).toEqual(meta);
    expect(PersistedSettingsV1Schema.parse({ schemaVersion: 1, audioMuted: true })).toEqual({
      schemaVersion: 1,
      audioMuted: true,
    });
  });

  it.each([
    ["run", PersistedRunV1Schema, makeRun()],
    ["meta", PersistedMetaV1Schema, makeMeta()],
    ["settings", PersistedSettingsV1Schema, { schemaVersion: 1, audioMuted: false }],
  ])("rejects unknown fields in the strict %s schema", (_name, schema, value) => {
    expect(schema.safeParse({ ...value, extra: true }).success).toBe(false);
  });

  it("rejects missing fields and whitespace-only identifiers", () => {
    const run = makeRun();
    expect(PersistedRunV1Schema.safeParse({ ...run, runId: "   " }).success).toBe(false);
    expect(PersistedRunV1Schema.safeParse({ ...run, revenue: undefined }).success).toBe(false);
    expect(PersistedRunV1Schema.safeParse({ ...run, flags: ["\t"] }).success).toBe(false);
    expect(
      PersistedRunV1Schema.safeParse({
        ...run,
        phase: { kind: "ending", endingId: "  " },
      }).success,
    ).toBe(false);
    expect(PersistedSettingsV1Schema.safeParse({ schemaVersion: 1 }).success).toBe(false);
  });

  it("rejects nonfinite numbers and unsupported schema versions", () => {
    const run = makeRun();
    expect(
      PersistedRunV1Schema.safeParse({ ...run, stability: Number.POSITIVE_INFINITY }).success,
    ).toBe(false);
    expect(PersistedRunV1Schema.safeParse({ ...run, schemaVersion: 2 }).success).toBe(false);
    expect(PersistedMetaV1Schema.safeParse({ ...makeMeta(), schemaVersion: 2 }).success).toBe(false);
  });

  it("rejects current-catalog history references but preserves unknown past-version IDs", () => {
    const currentEndingId = TASK5_CONTENT.endingRecords[0].id;
    const currentNewsId = TASK5_CONTENT.news[0].id;
    const current = makeMeta({
      endingHistory: [
        {
          runId: "current-run",
          runNumber: 1,
          contentVersion: TASK5_CONTENT_VERSION,
          endingId: "not-in-current-catalog",
        },
      ],
      newsHistory: [
        {
          runId: "current-run",
          runNumber: 1,
          contentVersion: TASK5_CONTENT_VERSION,
          day: 1,
          newsId: currentNewsId,
          status: "seen",
        },
      ],
    });
    expect(isMetaSemanticallyValid(current)).toBe(false);
    const past = makeMeta({
      endingHistory: [
        {
          runId: "past-run",
          runNumber: 1,
          contentVersion: "past-v1",
          endingId: "not-in-current-catalog",
        },
      ],
      newsHistory: [
        {
          runId: "past-run",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "not-in-current-catalog",
          status: "read",
        },
      ],
    });
    expect(isMetaSemanticallyValid(past)).toBe(true);
    expect(selectUnlockedEndingIds(past)).toEqual([]);
    expect(selectArchivedNewsIds(past)).toEqual([]);
    expect(currentEndingId).toBeTruthy();
  });

  it("rejects duplicate ending run IDs/run numbers, duplicate news keys, and metadata disagreement", () => {
    const duplicateEndingRun = makeMeta({
      endingHistory: [
        { runId: "same", runNumber: 1, contentVersion: "past-v1", endingId: "end-a" },
        { runId: "same", runNumber: 1, contentVersion: "past-v1", endingId: "end-a" },
      ],
    });
    expect(isMetaSemanticallyValid(duplicateEndingRun)).toBe(false);
    const duplicateNumber = makeMeta({
      endingHistory: [
        { runId: "run-a", runNumber: 1, contentVersion: "past-v1", endingId: "end-a" },
        { runId: "run-b", runNumber: 1, contentVersion: "past-v1", endingId: "end-b" },
      ],
    });
    expect(isMetaSemanticallyValid(duplicateNumber)).toBe(false);
    const duplicateNews = makeMeta({
      newsHistory: [
        {
          runId: "run-a",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "news-a",
          status: "seen",
        },
        {
          runId: "run-a",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "news-a",
          status: "read",
        },
      ],
    });
    expect(isMetaSemanticallyValid(duplicateNews)).toBe(false);
    const disagreement = makeMeta({
      endingHistory: [
        { runId: "run-a", runNumber: 1, contentVersion: "past-v1", endingId: "end-a" },
      ],
      newsHistory: [
        {
          runId: "run-a",
          runNumber: 2,
          contentVersion: "past-v1",
          day: 1,
          newsId: "news-a",
          status: "seen",
        },
      ],
    });
    expect(isMetaSemanticallyValid(disagreement)).toBe(false);
  });

  it("appends seen news, upgrades selected read news, and never reverses read", () => {
    const initial = makeMeta({
      newsHistory: [
        {
          runId: "run-1",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "news-old",
          status: "seen",
        },
      ],
    });
    const run = makeRun({
      newsSelections: [
        { day: 1, slot: "direct", newsId: "news-old" },
        { day: 1, slot: "trend", newsId: "news-new" },
      ],
      readNews: ["news-old"],
    });
    const updated = foldRunIntoMeta(initial, run);
    expect(updated.kind).toBe("updated");
    if (updated.kind !== "updated") return;
    expect(updated.meta.newsHistory).toEqual([
      {
        runId: "run-1",
        runNumber: 1,
        contentVersion: "past-v1",
        day: 1,
        newsId: "news-old",
        status: "read",
      },
      {
        runId: "run-1",
        runNumber: 1,
        contentVersion: "past-v1",
        day: 1,
        newsId: "news-new",
        status: "seen",
      },
    ]);
    const reverse = foldRunIntoMeta(updated.meta, makeRun({ newsSelections: [{ day: 1, slot: "direct", newsId: "news-old" }], readNews: [] }));
    expect(reverse.kind).toBe("unchanged");
    expect(reverse.meta.newsHistory[0].status).toBe("read");
  });

  it("is idempotent for the same run and preserves input objects and insertion order", () => {
    const initial = makeMeta({
      newsHistory: [
        {
          runId: "older",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "older-news",
          status: "seen",
        },
      ],
    });
    const snapshot = JSON.parse(JSON.stringify(initial)) as PersistedMetaV1;
    const run = makeRun({
      newsSelections: [{ day: 2, slot: "direct", newsId: "new-news" }],
    });
    const first = foldRunIntoMeta(initial, run);
    expect(initial).toEqual(snapshot);
    expect(first.kind).toBe("updated");
    if (first.kind !== "updated") return;
    const second = foldRunIntoMeta(first.meta, run);
    expect(second.kind).toBe("unchanged");
    expect(second.meta).toEqual(first.meta);
    expect(second.meta.newsHistory.map((entry) => entry.newsId)).toEqual([
      "older-news",
      "new-news",
    ]);
  });

  it("treats same-run same-ending as a no-op and a different ending as a conflict", () => {
    const meta = makeMeta({
      endingHistory: [
        { runId: "run-1", runNumber: 1, contentVersion: "past-v1", endingId: "ending-a" },
      ],
    });
    const same = foldRunIntoMeta(meta, makeRun({ phase: { kind: "ending", endingId: "ending-a" } }));
    expect(same.kind).toBe("unchanged");
    const different = foldRunIntoMeta(
      meta,
      makeRun({ phase: { kind: "ending", endingId: "ending-b" } }),
    );
    expect(different.kind).toBe("conflict");
    if (different.kind === "conflict") expect(different.reason).toBe("ending-conflict");
    expect(meta.endingHistory[0].endingId).toBe("ending-a");
  });

  it("folds runSummary endings from the existing ending event and deduplicates selector unlocks", () => {
    const firstRun = makeRun({
      runId: "run-1",
      phase: { kind: "ending", endingId: "ending-a" },
    });
    const first = foldRunIntoMeta(makeMeta(), firstRun);
    expect(first.kind).toBe("updated");
    if (first.kind !== "updated") return;
    const secondRun = makeRun({
      runId: "run-2",
      runNumber: 2,
      phase: { kind: "runSummary" },
      eventLog: [
        {
          id: "run-2:ending",
          type: "ending.resolved",
          day: 5,
          data: { endingId: "ending-a", title: "title", priority: 1, isFallback: false },
        },
      ],
    });
    const second = foldRunIntoMeta(first.meta, secondRun);
    expect(second.kind).toBe("updated");
    if (second.kind !== "updated") return;
    expect(second.meta.endingHistory.map((entry) => entry.endingId)).toEqual([
      "ending-a",
      "ending-a",
    ]);
    expect(selectUnlockedEndingIds(second.meta, ["ending-a", "ending-b"])).toEqual([
      "ending-a",
    ]);
  });

  it("reports integrity conflicts without mutating meta", () => {
    const meta = makeMeta({
      endingHistory: [
        { runId: "other", runNumber: 2, contentVersion: "past-v1", endingId: "ending-a" },
      ],
    });
    const snapshot = JSON.parse(JSON.stringify(meta)) as PersistedMetaV1;
    const result = foldRunIntoMeta(
      meta,
      makeRun({ runNumber: 2, phase: { kind: "ending", endingId: "ending-b" } }),
    );
    expect(result.kind).toBe("conflict");
    expect(meta).toEqual(snapshot);
  });

  it("keeps current-catalog selectors ordered while filtering past unknown IDs", () => {
    const firstEnding = TASK5_CONTENT.endingRecords[0].id;
    const secondEnding = TASK5_CONTENT.endingRecords[1].id;
    const firstNews = TASK5_CONTENT.news[0].id;
    const meta = makeMeta({
      endingHistory: [
        { runId: "past", runNumber: 1, contentVersion: "past-v1", endingId: "old-ending" },
        { runId: "current", runNumber: 2, contentVersion: TASK5_CONTENT_VERSION, endingId: firstEnding },
        { runId: "current-2", runNumber: 3, contentVersion: TASK5_CONTENT_VERSION, endingId: firstEnding },
        { runId: "current-3", runNumber: 4, contentVersion: TASK5_CONTENT_VERSION, endingId: secondEnding },
      ],
      newsHistory: [
        {
          runId: "past",
          runNumber: 1,
          contentVersion: "past-v1",
          day: 1,
          newsId: "old-news",
          status: "read",
        },
        {
          runId: "current",
          runNumber: 2,
          contentVersion: TASK5_CONTENT_VERSION,
          day: 1,
          newsId: firstNews,
          status: "seen",
        },
      ],
    });
    expect(selectUnlockedEndingIds(meta)).toEqual([firstEnding, secondEnding]);
    expect(selectArchivedNewsIds(meta)).toEqual([firstNews]);
  });

  it("does not depend on or persist AppState transient fields", () => {
    const gameState: GameState = createInitialGameState({ runId: "run", contentVersion: "past-v1" });
    expect(PersistedRunV1Schema.safeParse(gameState).success).toBe(true);
    expect(PersistedRunV1Schema.safeParse({ ...gameState, result: null }).success).toBe(false);
  });
});
