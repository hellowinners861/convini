import { TASK5_CONTENT } from "../../content/catalog";
import { TASK5_CONTENT_VERSION } from "../../content/config/game";
import {
  DEFAULT_PERSISTED_META_V1,
  PersistedMetaV1Schema,
  type EndingHistoryEntry,
  type MetaCatalogOptions,
  type PersistedMetaV1,
  type PersistedRunV1,
  type NewsHistoryEntry,
} from "./contracts";

const DEFAULT_CURRENT_ENDING_IDS = TASK5_CONTENT.endingRecords.map((record) => record.id);
const DEFAULT_CURRENT_NEWS_IDS = TASK5_CONTENT.news.map((article) => article.id);

function catalogOptions(options: MetaCatalogOptions = {}): Required<MetaCatalogOptions> {
  return {
    currentContentVersion: options.currentContentVersion ?? TASK5_CONTENT_VERSION,
    currentEndingIds: options.currentEndingIds ?? DEFAULT_CURRENT_ENDING_IDS,
    currentNewsIds: options.currentNewsIds ?? DEFAULT_CURRENT_NEWS_IDS,
  };
}

function hasCurrentId(
  contentVersion: string,
  currentContentVersion: string,
  ids: readonly string[],
  id: string,
): boolean {
  return contentVersion !== currentContentVersion || ids.includes(id);
}

/**
 * Checks the cross-record invariants that cannot be expressed by the strict
 * structural Zod schema. It is intentionally a total predicate for storage
 * callers: malformed or semantically invalid input returns false.
 */
export function isMetaSemanticallyValid(
  input: unknown,
  options: MetaCatalogOptions = {},
): input is PersistedMetaV1 {
  const parsed = PersistedMetaV1Schema.safeParse(input);
  if (!parsed.success) {
    return false;
  }

  const { currentContentVersion, currentEndingIds, currentNewsIds } = catalogOptions(options);
  const runMetadata = new Map<string, { runNumber: number; contentVersion: string }>();
  const endingRunIds = new Set<string>();
  const endingRunNumbers = new Set<number>();
  const newsKeys = new Set<string>();

  for (const entry of parsed.data.endingHistory) {
    const previous = runMetadata.get(entry.runId);
    if (
      previous &&
      (previous.runNumber !== entry.runNumber || previous.contentVersion !== entry.contentVersion)
    ) {
      return false;
    }
    runMetadata.set(entry.runId, {
      runNumber: entry.runNumber,
      contentVersion: entry.contentVersion,
    });

    if (endingRunIds.has(entry.runId) || endingRunNumbers.has(entry.runNumber)) {
      return false;
    }
    endingRunIds.add(entry.runId);
    endingRunNumbers.add(entry.runNumber);

    if (
      !hasCurrentId(
        entry.contentVersion,
        currentContentVersion,
        currentEndingIds,
        entry.endingId,
      )
    ) {
      return false;
    }
  }

  for (const entry of parsed.data.newsHistory) {
    const previous = runMetadata.get(entry.runId);
    if (
      previous &&
      (previous.runNumber !== entry.runNumber || previous.contentVersion !== entry.contentVersion)
    ) {
      return false;
    }
    runMetadata.set(entry.runId, {
      runNumber: entry.runNumber,
      contentVersion: entry.contentVersion,
    });

    const key = `${entry.runId}\u0000${entry.newsId}`;
    if (newsKeys.has(key)) {
      return false;
    }
    newsKeys.add(key);

    if (
      !hasCurrentId(entry.contentVersion, currentContentVersion, currentNewsIds, entry.newsId)
    ) {
      return false;
    }
  }

  return true;
}

/** Alias phrased as a validator for callers that use semantic validators by name. */
export const validateMetaSemantics = isMetaSemanticallyValid;

export type MetaFoldConflictReason =
  | "invalid-meta"
  | "run-metadata-mismatch"
  | "run-number-conflict"
  | "ending-conflict";

export type MetaFoldResult =
  | { kind: "unchanged"; meta: PersistedMetaV1; value: PersistedMetaV1 }
  | { kind: "updated"; meta: PersistedMetaV1; value: PersistedMetaV1 }
  | {
      kind: "conflict";
      reason: MetaFoldConflictReason;
      meta: PersistedMetaV1;
      value: PersistedMetaV1;
    };

function unchanged(meta: PersistedMetaV1): MetaFoldResult {
  return { kind: "unchanged", meta, value: meta };
}

function conflict(meta: PersistedMetaV1, reason: MetaFoldConflictReason): MetaFoldResult {
  return { kind: "conflict", reason, meta, value: meta };
}

function endingIdFromRun(run: PersistedRunV1): string | undefined {
  if (run.phase.kind === "ending") {
    return run.phase.endingId;
  }
  if (run.phase.kind !== "runSummary") {
    return undefined;
  }

  const endingEvent =
    run.eventLog.find((event) => event.id === `${run.runId}:ending`) ??
    run.eventLog.find((event) => event.type === "ending.resolved");
  const endingId = endingEvent?.data.endingId;
  return typeof endingId === "string" && endingId.trim().length > 0 ? endingId : undefined;
}

export const getEndingIdFromValidatedRun = endingIdFromRun;

function metadataForRun(run: PersistedRunV1): {
  runId: string;
  runNumber: number;
  contentVersion: string;
} {
  return {
    runId: run.runId,
    runNumber: run.runNumber,
    contentVersion: run.contentVersion,
  };
}

function sameMetadata(
  entry: { runNumber: number; contentVersion: string },
  run: PersistedRunV1,
): boolean {
  return entry.runNumber === run.runNumber && entry.contentVersion === run.contentVersion;
}

/**
 * Purely folds one semantically validated run into round meta. Existing array
 * positions are never moved; only new records append and seen records may
 * upgrade to read.
 */
export function foldRunIntoMeta(
  meta: PersistedMetaV1,
  validatedRun: PersistedRunV1,
): MetaFoldResult {
  if (!isMetaSemanticallyValid(meta)) {
    return conflict(meta, "invalid-meta");
  }

  const endingId = endingIdFromRun(validatedRun);
  const existingRunEntries = [
    ...meta.endingHistory.filter((entry) => entry.runId === validatedRun.runId),
    ...meta.newsHistory.filter((entry) => entry.runId === validatedRun.runId),
  ];
  if (existingRunEntries.some((entry) => !sameMetadata(entry, validatedRun))) {
    return conflict(meta, "run-metadata-mismatch");
  }

  if (
    endingId !== undefined &&
    meta.endingHistory.some(
      (entry) => entry.runId === validatedRun.runId && entry.endingId !== endingId,
    )
  ) {
    return conflict(meta, "ending-conflict");
  }

  if (
    endingId !== undefined &&
    meta.endingHistory.some(
      (entry) => entry.runNumber === validatedRun.runNumber && entry.runId !== validatedRun.runId,
    )
  ) {
    return conflict(meta, "run-number-conflict");
  }

  let changed = false;
  const endingHistory: EndingHistoryEntry[] = meta.endingHistory.map((entry) => ({ ...entry }));
  const newsHistory: NewsHistoryEntry[] = meta.newsHistory.map((entry) => ({ ...entry }));
  const runMetadata = metadataForRun(validatedRun);
  const readNews = new Set(validatedRun.readNews);

  for (const selection of validatedRun.newsSelections) {
    const existingIndex = newsHistory.findIndex(
      (entry) => entry.runId === validatedRun.runId && entry.newsId === selection.newsId,
    );
    if (existingIndex === -1) {
      newsHistory.push({
        ...runMetadata,
        day: selection.day,
        newsId: selection.newsId,
        status: readNews.has(selection.newsId) ? "read" : "seen",
      });
      changed = true;
      continue;
    }

    const existing = newsHistory[existingIndex];
    if (existing.status === "seen" && readNews.has(selection.newsId)) {
      newsHistory[existingIndex] = { ...existing, status: "read" };
      changed = true;
    }
  }

  if (
    endingId !== undefined &&
    !meta.endingHistory.some((entry) => entry.runId === validatedRun.runId)
  ) {
    endingHistory.push({ ...runMetadata, endingId });
    changed = true;
  }

  if (!changed) {
    return unchanged(meta);
  }

  const value: PersistedMetaV1 = {
    schemaVersion: meta.schemaVersion,
    endingHistory,
    newsHistory,
  };
  return { kind: "updated", meta: value, value };
}

function uniqueCatalogIds(ids: readonly string[]): Set<string> {
  return new Set(ids);
}

export function selectUnlockedEndingIds(
  meta: PersistedMetaV1,
  currentEndingIds: readonly string[] = DEFAULT_CURRENT_ENDING_IDS,
): string[] {
  const current = uniqueCatalogIds(currentEndingIds);
  const selected = new Set<string>();
  const result: string[] = [];
  for (const entry of meta.endingHistory) {
    if (current.has(entry.endingId) && !selected.has(entry.endingId)) {
      selected.add(entry.endingId);
      result.push(entry.endingId);
    }
  }
  return result;
}

export function selectArchivedNewsIds(
  meta: PersistedMetaV1,
  currentNewsIds: readonly string[] = DEFAULT_CURRENT_NEWS_IDS,
): string[] {
  const current = uniqueCatalogIds(currentNewsIds);
  const selected = new Set<string>();
  const result: string[] = [];
  for (const entry of meta.newsHistory) {
    if (current.has(entry.newsId) && !selected.has(entry.newsId)) {
      selected.add(entry.newsId);
      result.push(entry.newsId);
    }
  }
  return result;
}

export const getUnlockedEndingIds = selectUnlockedEndingIds;
export const getArchivedNewsIds = selectArchivedNewsIds;

/** Returns a fresh empty meta object for callers that do not want shared state. */
export function createDefaultMeta(): PersistedMetaV1 {
  return {
    schemaVersion: DEFAULT_PERSISTED_META_V1.schemaVersion,
    endingHistory: [],
    newsHistory: [],
  };
}
