// @vitest-environment jsdom

import { StrictMode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/app/App";
import {
  GameProvider,
  useGameController,
  type GameContextValue,
} from "../src/app/GameContext";
import {
  META_STORAGE_KEY,
  RUN_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  type PersistedMetaV1,
  type PersistedRunV1,
  type StorageLike,
} from "../src/app/persistence";
import { gameReducer, type AppState } from "../src/app/gameController";
import { getTask5EndingRecord } from "../src/content";
import type { GameState } from "../src/domain";
import {
  beginTask4Day,
  completeTask4Day,
  scanToDecision,
  startTask5Run,
} from "./fixtures/task4-run";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  readonly setCalls: string[] = [];
  readonly removeCalls: string[] = [];
  getError: unknown = undefined;
  readonly failNextSetKeys = new Set<string>();
  readonly removeErrors = new Map<string, unknown>();

  getItem(key: string): string | null {
    this.operations.push(`get:${key}`);
    if (this.getError !== undefined) {
      throw this.getError;
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.operations.push(`set:${key}`);
    this.setCalls.push(key);
    if (this.failNextSetKeys.has(key)) {
      this.failNextSetKeys.delete(key);
      throw namedError("QuotaExceededError");
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.operations.push(`remove:${key}`);
    this.removeCalls.push(key);
    const error = this.removeErrors.get(key);
    if (error !== undefined) {
      throw error;
    }
    this.values.delete(key);
  }
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function seedRaw(storage: MemoryStorage, key: string, value: string): void {
  storage.values.set(key, value);
}

function seedJson(storage: MemoryStorage, key: string, value: unknown): void {
  seedRaw(storage, key, JSON.stringify(value));
}

function gameOf(state: AppState): GameState {
  if (!state.game) {
    throw new Error("game state is missing");
  }
  return state.game;
}

function persistedGame(state: AppState): PersistedRunV1 {
  return structuredClone(gameOf(state)) as PersistedRunV1;
}

function metaFor(overrides: Partial<PersistedMetaV1> = {}): PersistedMetaV1 {
  return {
    schemaVersion: 1,
    endingHistory: [],
    newsHistory: [],
    ...overrides,
  };
}

function readJson<T>(storage: MemoryStorage, key: string): T {
  const raw = storage.values.get(key);
  if (!raw) {
    throw new Error(`missing ${key}`);
  }
  return JSON.parse(raw) as T;
}

function makeNewsState(runId: string, readCount = 0): AppState {
  let state = completeTask4Day(beginTask4Day(startTask5Run(runId)));
  state = gameReducer(state, { type: "OPEN_NEWS" });
  const ids = gameOf(state)
    .newsSelections.filter((selection) => selection.day === gameOf(state).day)
    .map((selection) => selection.newsId);
  for (const newsId of ids.slice(0, readCount)) {
    state = gameReducer(state, { type: "READ_NEWS", newsId });
  }
  return state;
}

function makeEndingState(runId: string): AppState {
  let state = startTask5Run(runId);
  for (let day = 1; day <= 5; day += 1) {
    state = beginTask4Day(state);
    state = completeTask4Day(state);
    state = gameReducer(state, { type: "OPEN_NEWS" });
    const ids = gameOf(state)
      .newsSelections.filter((selection) => selection.day === gameOf(state).day)
      .map((selection) => selection.newsId);
    for (const newsId of ids) {
      state = gameReducer(state, { type: "READ_NEWS", newsId });
    }
    state = gameReducer(state, { type: "ADVANCE_DAY" });
  }
  return state;
}

function endingTitle(state: AppState): string {
  const game = gameOf(state);
  if (game.phase.kind !== "ending") {
    throw new Error("ending fixture did not resolve an ending");
  }
  return getTask5EndingRecord(game.phase.endingId).presentation.title;
}

function renderAppWith(storage: MemoryStorage, ids: string[] = ["react-run"]): void {
  let idIndex = 0;
  render(
    <App
      storage={storage}
      runIdFactory={() => ids[idIndex++] ?? `react-run-${idIndex}`}
    />,
  );
}

let observedContext: GameContextValue | null = null;

function ContextProbe() {
  observedContext = useGameController();
  const context = observedContext;
  return (
    <div>
      <output data-testid="hydration-status">{context.hydrationStatus}</output>
      <output data-testid="persistence-mode">{context.persistenceMode}</output>
      <output data-testid="save-status">{context.saveStatus}</output>
      <output data-testid="settings-state">{JSON.stringify(context.settings)}</output>
      <output data-testid="meta-state">{JSON.stringify(context.meta)}</output>
      <output data-testid="app-view">{context.state.view}</output>
      <button type="button" onClick={() => context.setAudioMuted(!context.settings.audioMuted)}>
        toggle audio
      </button>
      <button type="button" onClick={() => context.resetToTitle()}>
        reset title
      </button>
    </div>
  );
}

function renderProbe(storage: MemoryStorage, ids: string[] = ["probe-run"]): void {
  let idIndex = 0;
  render(
    <GameProvider
      storage={storage}
      runIdFactory={() => ids[idIndex++] ?? `probe-run-${idIndex}`}
    >
      <ContextProbe />
    </GameProvider>,
  );
}

afterEach(() => {
  observedContext = null;
  cleanup();
});

describe("T6-C React persistence orchestration", () => {
  it("renders the hydration gate before effects can expose gameplay", () => {
    const storage = new MemoryStorage();
    const markup = renderToStaticMarkup(<App storage={storage} />);
    expect(markup).toContain("保存データを確認しています…");
  });

  it("shows only a fresh run when all owned keys are missing", () => {
    const storage = new MemoryStorage();
    renderAppWith(storage);

    expect(screen.getByRole("button", { name: "はじめから" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "つづきから" })).toBeNull();
    expect(screen.queryByText("タブを閉じると進行が失われます")).toBeNull();
  });

  it.each([
    ["result", () => gameOf(gameReducer(scanToDecision(beginTask4Day(startTask5Run("saved-result"))), { type: "SELL" })), "夜勤タクシー運転手"],
    ["news", () => gameOf(makeNewsState("saved-news", 1)), "勤務後のニュース"],
    ["ending", () => gameOf(makeEndingState("saved-ending")), endingTitle(makeEndingState("saved-ending"))],
    ["runSummary", () => gameOf(gameReducer(makeEndingState("saved-summary"), { type: "OPEN_RUN_SUMMARY" })), "周回結果"],
  ] as const)("hydrates a valid %s run on title and continues to its exact view", (_kind, makeGame, expectedText) => {
    const storage = new MemoryStorage();
    seedJson(storage, RUN_STORAGE_KEY, makeGame());
    renderAppWith(storage);

    expect(screen.getByRole("button", { name: "つづきから" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つづきから" }));
    expect(screen.getByText(expectedText)).toBeTruthy();
  });

  it("saves a new run with an injected unique id and the first run number", () => {
    const storage = new MemoryStorage();
    renderAppWith(storage, ["injected-unique-id"]);

    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    const run = readJson<PersistedRunV1>(storage, RUN_STORAGE_KEY);
    expect(run.runId).toBe("injected-unique-id");
    expect(run.runNumber).toBe(1);
    expect(run.phase).toEqual({ kind: "briefing" });
    expect(storage.setCalls).toEqual([RUN_STORAGE_KEY]);
    expect(screen.getByText("保存しました")).toBeTruthy();
  });

  it("requires inline confirmation for replacement and leaves cancel untouched", () => {
    const storage = new MemoryStorage();
    renderAppWith(storage, ["first-run", "replacement-run"]);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    fireEvent.click(screen.getByRole("button", { name: "タイトルへ戻る（ヘッダー）" }));
    const callsBeforeChoice = [...storage.setCalls];

    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(screen.getByRole("heading", { name: "現在の周回を置き換えますか？" })).toBeTruthy();
    expect(readJson<PersistedRunV1>(storage, RUN_STORAGE_KEY).runId).toBe("first-run");
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("heading", { name: "現在の周回を置き換えますか？" })).toBeNull();
    expect(storage.setCalls).toEqual(callsBeforeChoice);
  });

  it("writes exact durable checkpoints and skips rejected, transient, and navigation actions", () => {
    const storage = new MemoryStorage();
    renderAppWith(storage, ["matrix-run"]);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    const initialWrites = storage.setCalls.filter((key) => key === RUN_STORAGE_KEY).length;
    fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
    const afterBegin = storage.setCalls.filter((key) => key === RUN_STORAGE_KEY).length;
    expect(afterBegin).toBe(initialWrites + 1);
    fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
    fireEvent.click(screen.getByRole("button", { name: "スキャン結果を確認" }));
    const beforeDecision = storage.setCalls.length;
    fireEvent.click(screen.getByRole("button", { name: "売る" }));
    expect(storage.setCalls.length).toBe(beforeDecision + 1);
    fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    expect(storage.setCalls.length).toBe(beforeDecision + 1);
    fireEvent.click(screen.getByRole("button", { name: "タイトルへ戻る（ヘッダー）" }));
    expect(storage.setCalls.length).toBe(beforeDecision + 1);
  });

  it("writes run before the reconciled meta on a news checkpoint", () => {
    const storage = new MemoryStorage();
    renderAppWith(storage, ["ordering-run"]);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
    const encounterCount = 5;
    for (let index = 0; index < encounterCount; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
      fireEvent.click(screen.getByRole("button", { name: "スキャン結果を確認" }));
      fireEvent.click(screen.getByRole("button", { name: "売る" }));
      fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "ニュースを開く" }));
    const runIndex = storage.operations.lastIndexOf(`set:${RUN_STORAGE_KEY}`);
    const metaIndex = storage.operations.lastIndexOf(`set:${META_STORAGE_KEY}`);
    expect(runIndex).toBeGreaterThanOrEqual(0);
    expect(metaIndex).toBeGreaterThan(runIndex);
  });

  it("does not advance meta when run save fails and retries at the next checkpoint", () => {
    const storage = new MemoryStorage();
    storage.failNextSetKeys.add(RUN_STORAGE_KEY);
    renderAppWith(storage, ["retry-run"]);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(storage.values.has(RUN_STORAGE_KEY)).toBe(false);
    expect(storage.values.has(META_STORAGE_KEY)).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain("保存できません");

    fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
    expect(storage.values.has(RUN_STORAGE_KEY)).toBe(true);
    expect(storage.values.has(META_STORAGE_KEY)).toBe(false);
  });

  it("retains dirty in-memory meta and retries it when the next run save succeeds", () => {
    const storage = new MemoryStorage();
    renderAppWith(storage, ["dirty-meta-run"]);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
      fireEvent.click(screen.getByRole("button", { name: "スキャン結果を確認" }));
      fireEvent.click(screen.getByRole("button", { name: "売る" }));
      fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    }
    storage.failNextSetKeys.add(META_STORAGE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "ニュースを開く" }));
    expect(storage.values.has(META_STORAGE_KEY)).toBe(false);
    fireEvent.click(within(screen.getAllByRole("article")[0]).getByRole("button", { name: /^記事を開く:/ }));
    expect(storage.values.has(META_STORAGE_KEY)).toBe(true);
    expect(readJson<PersistedMetaV1>(storage, META_STORAGE_KEY).newsHistory.length).toBeGreaterThan(0);
  });

  it.each([
    ["run", RUN_STORAGE_KEY, "進行データを削除して再確認"],
    ["meta", META_STORAGE_KEY, "周回記録を削除して再確認"],
    ["settings", SETTINGS_STORAGE_KEY, "設定データを削除して再確認"],
  ] as const)("offers key-specific recovery for corrupt %s without touching unrelated keys", (_key, key, clearLabel) => {
    const storage = new MemoryStorage();
    seedRaw(storage, key, "{not-json");
    seedRaw(storage, "unrelated:key", "keep-me");
    renderAppWith(storage);

    expect(screen.getByRole("heading", { name: "保存データを確認できません" })).toBeTruthy();
    expect(screen.getByRole("button", { name: clearLabel })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: clearLabel }));
    expect(screen.getByRole("button", { name: "はじめから" })).toBeTruthy();
    expect(storage.values.get("unrelated:key")).toBe("keep-me");
    expect(storage.values.has(key)).toBe(false);
  });

  it("keeps recovery active and reports a failed key removal", () => {
    const storage = new MemoryStorage();
    seedRaw(storage, META_STORAGE_KEY, "{not-json");
    storage.removeErrors.set(META_STORAGE_KEY, namedError("SecurityError"));
    renderAppWith(storage);

    fireEvent.click(screen.getByRole("button", { name: "周回記録を削除して再確認" }));
    expect(screen.getByRole("heading", { name: "保存データを確認できません" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("削除できません");
    expect(storage.values.has(META_STORAGE_KEY)).toBe(true);
  });

  it("removes an incompatible run only and preserves meta and settings", () => {
    const storage = new MemoryStorage();
    seedJson(storage, RUN_STORAGE_KEY, { schemaVersion: 1, contentVersion: "old-content-v0" });
    const meta = metaFor({
      newsHistory: [{
        runId: "old-run",
        runNumber: 1,
        contentVersion: "old-content-v0",
        day: 1,
        newsId: "old-news",
        status: "seen",
      }],
    });
    seedJson(storage, META_STORAGE_KEY, meta);
    seedJson(storage, SETTINGS_STORAGE_KEY, { schemaVersion: 1, audioMuted: true });
    renderAppWith(storage);

    expect(screen.getByText("現在の内容と互換性がないため、新しい周回が必要です")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "つづきから" })).toBeNull();
    expect(storage.values.has(RUN_STORAGE_KEY)).toBe(false);
    expect(readJson<PersistedMetaV1>(storage, META_STORAGE_KEY)).toEqual(meta);
    expect(readJson<{ schemaVersion: 1; audioMuted: boolean }>(storage, SETTINGS_STORAGE_KEY).audioMuted).toBe(true);
  });

  it("enters volatile mode on unavailable reads, warns, and keeps the game playable", () => {
    const storage = new MemoryStorage();
    storage.getError = namedError("SecurityError");
    renderAppWith(storage, ["volatile-run"]);

    expect(screen.getByText("タブを閉じると進行が失われます")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "つづきから" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(screen.getByRole("heading", { name: "いつもの夜に、見慣れない商品" })).toBeTruthy();
    expect(storage.setCalls).toEqual([]);
  });

  it("reconciles meta once under StrictMode and remains idempotent", () => {
    const storage = new MemoryStorage();
    seedJson(storage, RUN_STORAGE_KEY, persistedGame(makeNewsState("strict-run", 1)));
    render(
      <StrictMode>
        <App storage={storage} runIdFactory={() => "unused"} />
      </StrictMode>,
    );

    expect(storage.setCalls.filter((key) => key === META_STORAGE_KEY)).toHaveLength(1);
    const meta = readJson<PersistedMetaV1>(storage, META_STORAGE_KEY);
    expect(meta.newsHistory).toHaveLength(3);
  });

  it("resets to title without deleting the run and starts the next round at number two", () => {
    const storage = new MemoryStorage();
    const ending = makeEndingState("completed-run");
    const summary = gameReducer(ending, { type: "OPEN_RUN_SUMMARY" });
    seedJson(storage, RUN_STORAGE_KEY, persistedGame(summary));
    renderAppWith(storage, ["next-round"]);

    fireEvent.click(screen.getByRole("button", { name: "つづきから" }));
    expect(screen.getByRole("heading", { name: "周回結果" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "タイトルへ戻る（ヘッダー）" }));
    expect(screen.getByRole("button", { name: "つづきから" })).toBeTruthy();
    expect(storage.values.has(RUN_STORAGE_KEY)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    fireEvent.click(screen.getByRole("button", { name: "はじめから始める" }));
    const nextRun = readJson<PersistedRunV1>(storage, RUN_STORAGE_KEY);
    expect(nextRun.runId).toBe("next-round");
    expect(nextRun.runNumber).toBe(2);

    const meta = readJson<PersistedMetaV1>(storage, META_STORAGE_KEY);
    expect(meta.endingHistory.filter((entry) => entry.runId === "completed-run")).toHaveLength(1);
  });

  it("loads and saves settings independently of run replacement", () => {
    const storage = new MemoryStorage();
    seedJson(storage, SETTINGS_STORAGE_KEY, { schemaVersion: 1, audioMuted: true });
    renderProbe(storage, ["settings-run"]);

    expect(screen.getByTestId("settings-state").textContent).toContain('"audioMuted":true');
    fireEvent.click(screen.getByRole("button", { name: "toggle audio" }));
    expect(readJson<{ schemaVersion: 1; audioMuted: boolean }>(storage, SETTINGS_STORAGE_KEY).audioMuted).toBe(false);
    expect(storage.setCalls).toEqual([SETTINGS_STORAGE_KEY]);
  });

  it("renders persisted mute state on the active day shell and persists the header toggle", () => {
    const storage = new MemoryStorage();
    seedJson(storage, SETTINGS_STORAGE_KEY, { schemaVersion: 1, audioMuted: true });
    seedJson(storage, RUN_STORAGE_KEY, persistedGame(startTask5Run("audio-ui-run")));
    renderAppWith(storage);

    fireEvent.click(screen.getByRole("button", { name: "つづきから" }));

    const appShell = document.querySelector("[data-day]");
    expect(appShell?.getAttribute("data-day")).toBe("1");
    const mutedButton = screen.getByRole("button", { name: "音声を再開" });
    expect(mutedButton.getAttribute("aria-pressed")).toBe("true");
    expect(mutedButton.textContent).toContain("音声 OFF");

    fireEvent.click(mutedButton);

    const unmutedButton = screen.getByRole("button", { name: "音声をミュート" });
    expect(unmutedButton.getAttribute("aria-pressed")).toBe("false");
    expect(unmutedButton.textContent).toContain("音声 ON");
    expect(readJson<{ schemaVersion: 1; audioMuted: boolean }>(storage, SETTINGS_STORAGE_KEY).audioMuted).toBe(false);
  });

  it("rejects blank and colliding generated ids without falling back to a fixed id", () => {
    const blankStorage = new MemoryStorage();
    renderAppWith(blankStorage, ["   "]);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(screen.getByRole("alert").textContent).toContain("新しい周回を開始できません");
    expect(blankStorage.values.has(RUN_STORAGE_KEY)).toBe(false);

    cleanup();
    const collisionStorage = new MemoryStorage();
    seedJson(collisionStorage, RUN_STORAGE_KEY, persistedGame(startTask5Run("occupied")));
    renderAppWith(collisionStorage, ["occupied"]);
    fireEvent.click(screen.getByRole("button", { name: "つづきから" }));
    fireEvent.click(screen.getByRole("button", { name: "タイトルへ戻る（ヘッダー）" }));
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    fireEvent.click(screen.getByRole("button", { name: "はじめから始める" }));
    expect(screen.getByRole("alert").textContent).toContain("新しい周回を開始できません");
    expect(readJson<PersistedRunV1>(collisionStorage, RUN_STORAGE_KEY).runId).toBe("occupied");
  });

  it("does not expose hidden world axes or trust values in the run summary", () => {
    const storage = new MemoryStorage();
    seedJson(storage, RUN_STORAGE_KEY, persistedGame(gameReducer(makeEndingState("summary-ui"), { type: "OPEN_RUN_SUMMARY" })));
    renderAppWith(storage);
    fireEvent.click(screen.getByRole("button", { name: "つづきから" }));

    expect(screen.getByRole("heading", { name: "周回結果" })).toBeTruthy();
    expect(screen.queryByText(/undead|machine|cosmic|spirit|stability|managerTrust|信頼度/)).toBeNull();
  });
});
