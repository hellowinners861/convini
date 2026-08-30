import {
  META_STORAGE_KEY,
  PersistedMetaV1Schema,
  PersistedRunV1Schema,
  PersistedSettingsV1Schema,
  RUN_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  type LoadResult,
  type MetaCatalogOptions,
  type PersistedMetaV1,
  type PersistedRunV1,
  type PersistedSettingsV1,
  type RemoveResult,
  type RunSemanticValidator,
  type SaveResult,
  type StorageLike,
  type StorageFailureReason,
} from "./contracts";
import { isMetaSemanticallyValid } from "./meta";

export interface PersistenceStoreOptions extends MetaCatalogOptions {
  expectedContentVersion: string;
  validateRun?: RunSemanticValidator;
  runSemanticValidator?: RunSemanticValidator;
}
export interface ClearAllResults {
  run: RemoveResult;
  meta: RemoveResult;
  settings: RemoveResult;
}

export type ClearAllResult =
  | { kind: "cleared"; results: ClearAllResults }
  | {
      kind: "failed";
      results: ClearAllResults;
      failedKeys: Array<"run" | "meta" | "settings">;
      reason: "security" | "unknown";
    };

type ReadRawResult =
  | { kind: "missing" }
  | { kind: "value"; value: string }
  | { kind: "unavailable"; reason: "security" | "unknown" };

function errorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function isSecurityError(error: unknown): boolean {
  return errorName(error) === "SecurityError";
}

function isQuotaError(error: unknown): boolean {
  const name = errorName(error);
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function writeFailureReason(error: unknown): StorageFailureReason {
  if (isSecurityError(error)) {
    return "security";
  }
  if (isQuotaError(error)) {
    return "quota";
  }
  return "unknown";
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function headerResult(input: unknown): { kind: "ok" } | { kind: "corrupt"; reason: "schema" | "unsupported-schema" } {
  if (!isRecord(input) || !Object.prototype.hasOwnProperty.call(input, "schemaVersion")) {
    return { kind: "corrupt", reason: "schema" };
  }
  const schemaVersion = input.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isFinite(schemaVersion)) {
    return { kind: "corrupt", reason: "schema" };
  }
  if (schemaVersion !== 1) {
    return { kind: "corrupt", reason: "unsupported-schema" };
  }
  return { kind: "ok" };
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validatorAccepted(
  validator: RunSemanticValidator | undefined,
  run: PersistedRunV1,
): boolean {
  if (!validator) {
    return true;
  }
  try {
    const result = validator(run);
    if (result === false) {
      return false;
    }
    if (typeof result === "object" && result !== null && "valid" in result) {
      return (result as { valid: unknown }).valid === true;
    }
    return true;
  } catch {
    return false;
  }
}

function asFailure(reason: StorageFailureReason): SaveResult {
  return { kind: "failed", operation: "write", reason };
}

function serialize(input: unknown): string | undefined {
  try {
    const output = JSON.stringify(input);
    return typeof output === "string" ? output : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A localStorage-compatible persistence adapter. Every public operation
 * converts storage and validation failures into its discriminated result.
 */
export class PersistenceStore {
  private readonly storage: StorageLike;
  private readonly expectedContentVersion: string;
  private readonly runSemanticValidator: RunSemanticValidator | undefined;
  private readonly metaOptions: MetaCatalogOptions;

  public constructor(
    storage: StorageLike,
    optionsOrExpectedContentVersion: PersistenceStoreOptions | string,
    semanticValidator?: RunSemanticValidator,
  ) {
    this.storage = storage;
    if (typeof optionsOrExpectedContentVersion === "string") {
      this.expectedContentVersion = optionsOrExpectedContentVersion;
      this.runSemanticValidator = semanticValidator;
      this.metaOptions = {};
    } else {
      this.expectedContentVersion = optionsOrExpectedContentVersion.expectedContentVersion;
      this.runSemanticValidator =
        optionsOrExpectedContentVersion.validateRun ??
        optionsOrExpectedContentVersion.runSemanticValidator;
      this.metaOptions = {
        currentContentVersion: optionsOrExpectedContentVersion.currentContentVersion,
        currentEndingIds: optionsOrExpectedContentVersion.currentEndingIds,
        currentNewsIds: optionsOrExpectedContentVersion.currentNewsIds,
      };
    }
  }

  private readRaw(key: string): ReadRawResult {
    try {
      const value = this.storage.getItem(key);
      return value === null ? { kind: "missing" } : { kind: "value", value };
    } catch (error) {
      return {
        kind: "unavailable",
        reason: isSecurityError(error) ? "security" : "unknown",
      };
    }
  }

  private parseJson(key: string):
    | { kind: "missing" }
    | { kind: "json"; value: unknown }
    | { kind: "corrupt"; reason: "json" }
    | { kind: "unavailable"; reason: "security" | "unknown" } {
    const raw = this.readRaw(key);
    if (raw.kind !== "value") {
      return raw;
    }
    try {
      return { kind: "json", value: JSON.parse(raw.value) as unknown };
    } catch {
      return { kind: "corrupt", reason: "json" };
    }
  }

  public loadRun(
    expectedContentVersion = this.expectedContentVersion,
    semanticValidator = this.runSemanticValidator,
  ): LoadResult<PersistedRunV1> {
    const parsed = this.parseJson(RUN_STORAGE_KEY);
    if (parsed.kind === "missing") {
      return { kind: "missing" };
    }
    if (parsed.kind === "unavailable") {
      return { kind: "unavailable", operation: "read", reason: parsed.reason };
    }
    if (parsed.kind === "corrupt") {
      return parsed;
    }

    const header = headerResult(parsed.value);
    if (header.kind === "corrupt") {
      return header;
    }
    if (
      !isRecord(parsed.value) ||
      !isNonBlankString(parsed.value.contentVersion)
    ) {
      return { kind: "corrupt", reason: "schema" };
    }
    if (parsed.value.contentVersion !== expectedContentVersion) {
      return {
        kind: "incompatible-content",
        foundContentVersion: parsed.value.contentVersion,
        expectedContentVersion,
      };
    }

    try {
      const result = PersistedRunV1Schema.safeParse(parsed.value);
      if (!result.success) {
        return { kind: "corrupt", reason: "schema" };
      }
      if (!validatorAccepted(semanticValidator, result.data)) {
        return { kind: "corrupt", reason: "semantic" };
      }
      return { kind: "valid", value: result.data };
    } catch {
      return { kind: "corrupt", reason: "schema" };
    }
  }

  public saveRun(value: unknown): SaveResult {
    try {
      const result = PersistedRunV1Schema.safeParse(value);
      if (!result.success || result.data.contentVersion !== this.expectedContentVersion) {
        return asFailure("unknown");
      }
      if (!validatorAccepted(this.runSemanticValidator, result.data)) {
        return asFailure("unknown");
      }
      return this.write(RUN_STORAGE_KEY, result.data);
    } catch {
      return asFailure("unknown");
    }
  }

  public removeRun(): RemoveResult {
    return this.remove(RUN_STORAGE_KEY);
  }

  public loadMeta(): LoadResult<PersistedMetaV1> {
    const parsed = this.parseJson(META_STORAGE_KEY);
    if (parsed.kind === "missing") {
      return { kind: "missing" };
    }
    if (parsed.kind === "unavailable") {
      return { kind: "unavailable", operation: "read", reason: parsed.reason };
    }
    if (parsed.kind === "corrupt") {
      return parsed;
    }

    const header = headerResult(parsed.value);
    if (header.kind === "corrupt") {
      return header;
    }
    try {
      const result = PersistedMetaV1Schema.safeParse(parsed.value);
      if (!result.success) {
        return { kind: "corrupt", reason: "schema" };
      }
      if (!isMetaSemanticallyValid(result.data, this.metaOptions)) {
        return { kind: "corrupt", reason: "semantic" };
      }
      return { kind: "valid", value: result.data };
    } catch {
      return { kind: "corrupt", reason: "schema" };
    }
  }

  public saveMeta(value: unknown): SaveResult {
    try {
      const result = PersistedMetaV1Schema.safeParse(value);
      if (!result.success || !isMetaSemanticallyValid(result.data, this.metaOptions)) {
        return asFailure("unknown");
      }
      return this.write(META_STORAGE_KEY, result.data);
    } catch {
      return asFailure("unknown");
    }
  }

  public removeMeta(): RemoveResult {
    return this.remove(META_STORAGE_KEY);
  }

  public loadSettings(): LoadResult<PersistedSettingsV1> {
    const parsed = this.parseJson(SETTINGS_STORAGE_KEY);
    if (parsed.kind === "missing") {
      return { kind: "missing" };
    }
    if (parsed.kind === "unavailable") {
      return { kind: "unavailable", operation: "read", reason: parsed.reason };
    }
    if (parsed.kind === "corrupt") {
      return parsed;
    }

    const header = headerResult(parsed.value);
    if (header.kind === "corrupt") {
      return header;
    }
    try {
      const result = PersistedSettingsV1Schema.safeParse(parsed.value);
      return result.success
        ? { kind: "valid", value: result.data }
        : { kind: "corrupt", reason: "schema" };
    } catch {
      return { kind: "corrupt", reason: "schema" };
    }
  }

  public saveSettings(value: unknown): SaveResult {
    try {
      const result = PersistedSettingsV1Schema.safeParse(value);
      return result.success ? this.write(SETTINGS_STORAGE_KEY, result.data) : asFailure("unknown");
    } catch {
      return asFailure("unknown");
    }
  }

  public removeSettings(): RemoveResult {
    return this.remove(SETTINGS_STORAGE_KEY);
  }

  private write(key: string, value: unknown): SaveResult {
    const serialized = serialize(value);
    if (serialized === undefined) {
      return asFailure("unknown");
    }
    try {
      this.storage.setItem(key, serialized);
      return { kind: "saved" };
    } catch (error) {
      return asFailure(writeFailureReason(error));
    }
  }

  private remove(key: string): RemoveResult {
    try {
      this.storage.removeItem(key);
      return { kind: "removed" };
    } catch (error) {
      return {
        kind: "failed",
        operation: "remove",
        reason: isSecurityError(error) ? "security" : "unknown",
      };
    }
  }

  public clearAll(): ClearAllResult {
    const results: ClearAllResults = {
      run: this.removeRun(),
      meta: this.removeMeta(),
      settings: this.removeSettings(),
    };
    const failedKeys = (Object.keys(results) as Array<keyof ClearAllResults>).filter(
      (key) => results[key].kind === "failed",
    );
    if (failedKeys.length === 0) {
      return { kind: "cleared", results };
    }

    const firstFailure = results[failedKeys[0]];
    const reason = firstFailure.kind === "failed" && firstFailure.reason === "security"
      ? "security"
      : "unknown";
    return { kind: "failed", results, failedKeys, reason };
  }

  /** Short alias for UI/controller code that calls the aggregate operation clear. */
  public clear(): ClearAllResult {
    return this.clearAll();
  }
}

export function createPersistenceStore(
  storage: StorageLike,
  optionsOrExpectedContentVersion: PersistenceStoreOptions | string,
  semanticValidator?: RunSemanticValidator,
): PersistenceStore {
  return new PersistenceStore(storage, optionsOrExpectedContentVersion, semanticValidator);
}
