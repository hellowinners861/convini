import { getTask5Encounter } from "../content";
import { BriefingScreen } from "../screens/Briefing/BriefingScreen";
import { EndingScreen } from "../screens/Ending/EndingScreen";
import { EncounterScreen } from "../screens/Encounter/EncounterScreen";
import { NewsScreen } from "../screens/News/NewsScreen";
import { RunSummaryScreen } from "../screens/RunSummary/RunSummaryScreen";
import { ShiftSummaryScreen } from "../screens/Summary/ShiftSummaryScreen";
import { PersistenceRecoveryScreen } from "../screens/Persistence/PersistenceRecoveryScreen";
import { TitleScreen } from "../screens/Title/TitleScreen";
import { APP_TITLE } from "./appMeta";
import { ShiftNotebook } from "../components/ShiftNotebook";
import { reconstructEncounterResult, reconstructEndingResult } from "./gameController";
import {
  GameProvider,
  useGameController,
  type GameProviderProps,
  type SaveStatus,
} from "./GameContext";
import styles from "./App.module.css";

function saveStatusLabel(status: SaveStatus): string | null {
  switch (status) {
    case "saving":
      return "保存中…";
    case "saved":
      return "保存しました";
    case "failed":
      return "保存できません";
    case "idle":
      return null;
  }
}

function AppContent() {
  const {
    state,
    dispatch,
    hydrationStatus,
    persistenceMode,
    saveStatus,
    notice,
    error,
    recoveryKey,
    settings,
    continueRun,
    startNewRun,
    startNextRun,
    resetToTitle,
    clearRecoveryKey,
    setAudioMuted,
  } = useGameController();

  if (hydrationStatus === "hydrating") {
    return (
      <main className={styles.statusScreen}>
        <p role="status">保存データを確認しています…</p>
      </main>
    );
  }

  if (hydrationStatus === "recovery" && recoveryKey) {
    return (
      <PersistenceRecoveryScreen
        recoveryKey={recoveryKey}
        notice={notice}
        error={error}
        onClear={clearRecoveryKey}
      />
    );
  }

  if (state.view === "title" || !state.game) {
    return (
      <TitleScreen
        hasSavedRun={state.game !== null}
        notice={notice}
        error={error}
        onContinue={continueRun}
        onStart={() => startNewRun({ confirmed: true })}
      />
    );
  }

  const game = state.game;
  const statusLabel = saveStatusLabel(saveStatus);

  return (
    <div className={styles.appShell} data-day={game.day} data-theme="day">
      <header className={styles.appHeader}>
        <span>{APP_TITLE}</span>
        <div className={styles.appNotices} aria-live="polite">
          {persistenceMode === "volatile" && notice ? (
            <span className={styles.appNotice}>{notice}</span>
          ) : null}
          {statusLabel ? <span className={styles.saveStatus}>{statusLabel}</span> : null}
          {error ? (
            <span className={styles.appError} role="alert">
              {error}
            </span>
          ) : null}
        </div>
        <div className={styles.headerControls}>
          <button
            className={styles.muteButton}
            type="button"
            aria-label={settings.audioMuted ? "音声を再開" : "音声をミュート"}
            aria-pressed={settings.audioMuted}
            onClick={() => setAudioMuted(!settings.audioMuted)}
          >
            {settings.audioMuted ? "音声 OFF" : "音声 ON"}
          </button>
          <button
            className={styles.resetButton}
            type="button"
            aria-label="タイトルへ戻る（ヘッダー）"
            onClick={resetToTitle}
          >
            タイトルへ戻る
          </button>
        </div>
      </header>
      <ShiftNotebook game={game} />

      {state.view === "briefing" ? (
        <BriefingScreen game={game} onBegin={() => dispatch({ type: "BEGIN_DAY" })} onNightAction={dispatch} />
      ) : null}

      {state.view === "encounter" && game.phase.kind === "encounter" ? (
        (() => {
          const encounter = getTask5Encounter(game.phase.encounterId);
          const durableResult = reconstructEncounterResult(
            game,
            game.phase.encounterId,
            game.phase.slotId,
          );
          return (
            <EncounterScreen
              game={game}
              encounter={encounter}
              phase={game.phase}
              result={durableResult ?? state.result}
              encounterNumber={state.encounterIndex + 1}
              encounterCount={game.resolvedQueue.length}
              onScan={() => dispatch({ type: "SCAN_ENCOUNTER" })}
              onAsk={(questionId) => dispatch({ type: "ASK_QUESTION", questionId })}
              onHandReceipt={() => dispatch({ type: "HAND_RECEIPT" })}
              onDecision={(decision, recommendedItemId) => {
                if (decision === "sell") {
                  dispatch({ type: "SELL" });
                } else if (decision === "refuse") {
                  dispatch({ type: "REFUSE" });
                } else if (recommendedItemId) {
                  dispatch({ type: "RECOMMEND", recommendedItemId });
                }
              }}
              onNext={() => dispatch({ type: "NEXT_ENCOUNTER" })}
              onNightAction={dispatch}
            />
          );
        })()
      ) : null}

      {state.view === "shiftSummary" ? (
        <ShiftSummaryScreen
          game={game}
          onOpenNews={() => dispatch({ type: "OPEN_NEWS" })}
        />
      ) : null}

      {state.view === "news" ? (
        <NewsScreen
          game={game}
          openNewsId={state.openNewsId}
          onRead={(newsId) => dispatch({ type: "READ_NEWS", newsId })}
          onAdvance={() => dispatch({ type: "ADVANCE_DAY" })}
          onNightAction={dispatch}
        />
      ) : null}

      {state.view === "ending" && game.phase.kind === "ending" ? (
        (() => {
          const endingResult = reconstructEndingResult(game);
          return endingResult ? (
            <EndingScreen
              game={game}
              endingResult={endingResult}
              onOpenRunSummary={() => dispatch({ type: "OPEN_RUN_SUMMARY" })}
            />
          ) : null;
        })()
      ) : null}

      {state.view === "runSummary" && game.phase.kind === "runSummary" ? (
        (() => {
          const endingResult = reconstructEndingResult(game);
          return endingResult ? (
            <RunSummaryScreen
              game={game}
              endingResult={endingResult}
              onReset={resetToTitle}
              onNext={startNextRun}
            />
          ) : null;
        })()
      ) : null}

    </div>
  );
}

export type AppProps = Omit<GameProviderProps, "children">;

export function App(props: AppProps = {}) {
  return (
    <GameProvider {...props}>
      <AppContent />
    </GameProvider>
  );
}
