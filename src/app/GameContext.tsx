import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
} from "react";
import {
  DEFAULT_PERSISTED_SETTINGS_V1,
  createDefaultMeta,
  createPersistenceStore,
  foldRunIntoMeta,
  type PersistedMetaV1,
  type PersistedRunV1,
  type PersistedSettingsV1,
  type PersistenceStore,
  type StorageLike,
} from "./persistence";
import {
  gameReducer,
  initialAppState,
  validateRunForResume,
  type AppAction,
  type AppState,
} from "./gameController";
import { TASK5_CONTENT_VERSION } from "../content";

export type HydrationStatus = "hydrating" | "ready" | "recovery";
export type PersistenceMode = "persistent" | "volatile";
export type SaveStatus = "idle" | "saving" | "saved" | "failed";
export type RecoveryKey = "run" | "meta" | "settings";

export interface StartNewRunOptions {
  confirmed?: boolean;
}

export interface GameProviderProps extends PropsWithChildren {
  /** An injected localStorage-compatible adapter for deterministic tests. */
  storage?: StorageLike | null;
  /** A deterministic replacement for crypto.randomUUID in tests. */
  runIdFactory?: () => string;
  /** Friendly alias for callers that name the factory as a creator. */
  createRunId?: () => string;
}

export interface GameContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  hydrationStatus: HydrationStatus;
  persistenceMode: PersistenceMode;
  saveStatus: SaveStatus;
  meta: PersistedMetaV1;
  settings: PersistedSettingsV1;
  notice: string | null;
  error: string | null;
  recoveryKey: RecoveryKey | null;
  continueRun: () => void;
  startNewRun: (options?: StartNewRunOptions) => void;
  startNextRun: () => void;
  resetToTitle: () => void;
  clearRecoveryKey: () => void;
  setAudioMuted: (value: boolean) => void;
}

const VOLATILE_NOTICE = "タブを閉じると進行が失われます";
const INCOMPATIBLE_CONTENT_NOTICE = "現在の内容と互換性がないため、新しい周回が必要です";
const SAVE_FAILURE_NOTICE = "保存できません";
const RECOVERY_FAILURE_NOTICE = "保存データを削除できませんでした";

function defaultRunIdFactory(): string {
  const browserCrypto = globalThis.crypto;
  if (!browserCrypto || typeof browserCrypto.randomUUID !== "function") {
    throw new Error("UUID生成機能を利用できません。");
  }
  return browserCrypto.randomUUID();
}

function resolveDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function cloneMeta(meta: PersistedMetaV1): PersistedMetaV1 {
  return {
    schemaVersion: meta.schemaVersion,
    endingHistory: meta.endingHistory.map((entry) => ({ ...entry })),
    newsHistory: meta.newsHistory.map((entry) => ({ ...entry })),
  };
}

function cloneSettings(settings: PersistedSettingsV1): PersistedSettingsV1 {
  return { schemaVersion: settings.schemaVersion, audioMuted: settings.audioMuted };
}

function isCheckpointAction(action: AppAction): boolean {
  switch (action.type) {
    case "START_NEW_RUN":
    case "BEGIN_DAY":
    case "SELL":
    case "REFUSE":
    case "RECOMMEND":
    case "ASK_QUESTION":
    case "HAND_RECEIPT":
    case "OPEN_NEWS":
    case "READ_NEWS":
    case "ADVANCE_DAY":
    case "OPEN_RUN_SUMMARY":
      return true;
    default:
      return false;
  }
}

function keyLabel(key: RecoveryKey): string {
  switch (key) {
    case "run":
      return "進行データ";
    case "meta":
      return "周回記録";
    case "settings":
      return "設定データ";
  }
}

function recoveryNotice(key: RecoveryKey): string {
  return `${keyLabel(key)}を読み込めませんでした。データを削除して再確認できます。`;
}

function knownRunIds(game: AppState["game"], meta: PersistedMetaV1): Set<string> {
  const ids = new Set<string>();
  if (game) {
    ids.add(game.runId);
  }
  for (const entry of [...meta.endingHistory, ...meta.newsHistory]) {
    ids.add(entry.runId);
  }
  return ids;
}

function nextRunNumber(meta: PersistedMetaV1): number {
  let highest = 0;
  for (const entry of meta.endingHistory) {
    highest = Math.max(highest, entry.runNumber);
  }
  return highest + 1;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({
  children,
  storage: injectedStorage,
  runIdFactory,
  createRunId,
}: GameProviderProps) {
  const [storage] = useState<StorageLike | null>(() =>
    injectedStorage === undefined ? resolveDefaultStorage() : injectedStorage,
  );
  const [store] = useState<PersistenceStore | null>(() =>
    storage
      ? createPersistenceStore(storage, {
          expectedContentVersion: TASK5_CONTENT_VERSION,
          validateRun: validateRunForResume,
        })
      : null,
  );
  const [state, reducerDispatch] = useReducer(gameReducer, initialAppState);
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>("hydrating");
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>(
    storage ? "persistent" : "volatile",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [meta, setMeta] = useState<PersistedMetaV1>(() => createDefaultMeta());
  const [settings, setSettings] = useState<PersistedSettingsV1>(() =>
    cloneSettings(DEFAULT_PERSISTED_SETTINGS_V1),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<RecoveryKey | null>(null);

  const stateRef = useRef(state);
  const metaRef = useRef(meta);
  const metaDirtyRef = useRef(false);
  const hydrationStartedRef = useRef(false);
  const runIdFactoryRef = useRef(runIdFactory ?? createRunId ?? defaultRunIdFactory);

  const setMetaValue = useCallback((value: PersistedMetaV1) => {
    metaRef.current = value;
    setMeta(value);
  }, []);

  const setSettingsValue = useCallback((value: PersistedSettingsV1) => {
    setSettings(value);
  }, []);

  const saveCheckpoint = useCallback(
    (nextState: AppState) => {
      const game = nextState.game;
      if (!game) {
        return;
      }

      setSaveStatus("saving");
      if (!store || persistenceMode !== "persistent") {
        setSaveStatus("failed");
        setError(SAVE_FAILURE_NOTICE);
        return;
      }

      const runResult = store.saveRun(game as PersistedRunV1);
      if (runResult.kind !== "saved") {
        setSaveStatus("failed");
        setError(SAVE_FAILURE_NOTICE);
        return;
      }

      const folded = foldRunIntoMeta(metaRef.current, game as PersistedRunV1);
      if (folded.kind === "conflict") {
        metaDirtyRef.current = true;
        setSaveStatus("failed");
        setError(SAVE_FAILURE_NOTICE);
        return;
      }

      if (folded.kind === "updated") {
        setMetaValue(folded.meta);
      }

      const shouldSaveMeta = folded.kind === "updated" || metaDirtyRef.current;
      if (!shouldSaveMeta) {
        setSaveStatus("saved");
        setError(null);
        return;
      }

      const metaResult = store.saveMeta(folded.meta);
      if (metaResult.kind !== "saved") {
        metaDirtyRef.current = true;
        setSaveStatus("failed");
        setError(SAVE_FAILURE_NOTICE);
        return;
      }

      metaDirtyRef.current = false;
      setSaveStatus("saved");
      setError(null);
    },
    [persistenceMode, setMetaValue, store],
  );

  const dispatch: Dispatch<AppAction> = useCallback(
    (action) => {
      const previousState = stateRef.current;
      const nextState = gameReducer(previousState, action);
      if (nextState === previousState) {
        return;
      }

      stateRef.current = nextState;
      reducerDispatch(action);
      if (isCheckpointAction(action)) {
        saveCheckpoint(nextState);
      }
    },
    [reducerDispatch, saveCheckpoint],
  );

  const performHydration = useCallback(() => {
    metaDirtyRef.current = false;
    setRecoveryKey(null);
    setError(null);
    setSaveStatus("idle");

    if (!store || persistenceMode !== "persistent") {
      setMetaValue(createDefaultMeta());
      setSettingsValue(cloneSettings(DEFAULT_PERSISTED_SETTINGS_V1));
      setPersistenceMode("volatile");
      setNotice(VOLATILE_NOTICE);
      setHydrationStatus("ready");
      return;
    }

    const runResult = store.loadRun();
    const metaResult = store.loadMeta();
    const settingsResult = store.loadSettings();
    const results = [runResult, metaResult, settingsResult];

    if (results.some((result) => result.kind === "unavailable")) {
      setMetaValue(createDefaultMeta());
      setSettingsValue(cloneSettings(DEFAULT_PERSISTED_SETTINGS_V1));
      setPersistenceMode("volatile");
      setNotice(VOLATILE_NOTICE);
      setHydrationStatus("ready");
      return;
    }

    const corruptResult = [
      { key: "run" as const, result: runResult },
      { key: "meta" as const, result: metaResult },
      { key: "settings" as const, result: settingsResult },
    ].find(({ result }) => result.kind === "corrupt");
    if (corruptResult) {
      setPersistenceMode("persistent");
      setNotice(recoveryNotice(corruptResult.key));
      setRecoveryKey(corruptResult.key);
      setHydrationStatus("recovery");
      return;
    }

    const hydratedMeta = metaResult.kind === "valid" ? cloneMeta(metaResult.value) : createDefaultMeta();
    const hydratedSettings =
      settingsResult.kind === "valid"
        ? cloneSettings(settingsResult.value)
        : cloneSettings(DEFAULT_PERSISTED_SETTINGS_V1);
    setMetaValue(hydratedMeta);
    setSettingsValue(hydratedSettings);
    setPersistenceMode("persistent");
    setNotice(null);

    if (runResult.kind === "incompatible-content") {
      const removeResult = store.removeRun();
      if (removeResult.kind !== "removed") {
        setNotice(INCOMPATIBLE_CONTENT_NOTICE);
        setError(RECOVERY_FAILURE_NOTICE);
        setRecoveryKey("run");
        setHydrationStatus("recovery");
        return;
      }
      setNotice(INCOMPATIBLE_CONTENT_NOTICE);
      setHydrationStatus("ready");
      return;
    }

    if (runResult.kind === "valid") {
      const folded = foldRunIntoMeta(hydratedMeta, runResult.value);
      if (folded.kind === "conflict") {
        setNotice(recoveryNotice("meta"));
        setRecoveryKey("meta");
        setHydrationStatus("recovery");
        return;
      }

      if (folded.kind === "updated") {
        setMetaValue(folded.meta);
        const metaSaveResult = store.saveMeta(folded.meta);
        if (metaSaveResult.kind !== "saved") {
          metaDirtyRef.current = true;
          setSaveStatus("failed");
          setError(SAVE_FAILURE_NOTICE);
        }
      }

      dispatch({ type: "RESTORE_RUN", run: runResult.value });
    }

    setHydrationStatus("ready");
  }, [dispatch, persistenceMode, setMetaValue, setSettingsValue, store]);

  useEffect(() => {
    if (hydrationStartedRef.current) {
      return;
    }
    hydrationStartedRef.current = true;
    performHydration();
  }, [performHydration]);

  const buildNewRunAction = useCallback((): AppAction | null => {
    const ids = knownRunIds(stateRef.current.game, metaRef.current);
    let runId: string;
    try {
      runId = runIdFactoryRef.current();
    } catch {
      setError("新しい周回を開始できません");
      return null;
    }

    if (typeof runId !== "string" || runId.trim().length === 0 || ids.has(runId)) {
      setError("新しい周回を開始できません");
      return null;
    }

    return {
      type: "START_NEW_RUN",
      runId,
      contentVersion: TASK5_CONTENT_VERSION,
      runNumber: nextRunNumber(metaRef.current),
    };
  }, []);

  const continueRun = useCallback(() => {
    dispatch({ type: "CONTINUE_RUN" });
  }, [dispatch]);

  const startNewRun = useCallback(
    (options: StartNewRunOptions = {}) => {
      const currentState = stateRef.current;
      if (currentState.view !== "title") {
        return;
      }
      if (currentState.game && options.confirmed !== true) {
        return;
      }
      const action = buildNewRunAction();
      if (action) {
        dispatch(action);
      }
    },
    [buildNewRunAction, dispatch],
  );

  const startNextRun = useCallback(() => {
    if (stateRef.current.view !== "runSummary") {
      return;
    }
    const action = buildNewRunAction();
    if (!action) {
      return;
    }
    dispatch({ type: "RESET_TO_TITLE" });
    dispatch(action);
  }, [buildNewRunAction, dispatch]);

  const resetToTitle = useCallback(() => {
    dispatch({ type: "RESET_TO_TITLE" });
  }, [dispatch]);

  const clearRecoveryKey = useCallback(() => {
    if (!store || !recoveryKey) {
      return;
    }

    const result =
      recoveryKey === "run"
        ? store.removeRun()
        : recoveryKey === "meta"
          ? store.removeMeta()
          : store.removeSettings();
    if (result.kind !== "removed") {
      setError(RECOVERY_FAILURE_NOTICE);
      return;
    }

    setHydrationStatus("hydrating");
    performHydration();
  }, [performHydration, recoveryKey, store]);

  const setAudioMuted = useCallback(
    (value: boolean) => {
      const nextSettings: PersistedSettingsV1 = { schemaVersion: 1, audioMuted: value };
      setSettingsValue(nextSettings);
      setSaveStatus("saving");
      if (!store || persistenceMode !== "persistent") {
        setSaveStatus("failed");
        setError(SAVE_FAILURE_NOTICE);
        return;
      }

      const result = store.saveSettings(nextSettings);
      if (result.kind !== "saved") {
        setSaveStatus("failed");
        setError(SAVE_FAILURE_NOTICE);
        return;
      }

      setSaveStatus("saved");
      setError(null);
    },
    [persistenceMode, setSettingsValue, store],
  );

  const value: GameContextValue = {
    state,
    dispatch,
    hydrationStatus,
    persistenceMode,
    saveStatus,
    meta,
    settings,
    notice,
    error,
    recoveryKey,
    continueRun,
    startNewRun,
    startNextRun,
    resetToTitle,
    clearRecoveryKey,
    setAudioMuted,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameController(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error("GameProviderが必要です。");
  }
  return value;
}
