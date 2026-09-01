import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GamePhase, GameState } from "../../domain";
import {
  getTask4Customer,
  getTask4Item,
  resolveNarrative,
  TASK4_ENCOUNTER_UI,
  TASK4_RECEIPT_UI,
  type AuthoredEncounter,
} from "../../content";
import type { Decision, EncounterResultState } from "../../app/gameController";
import { CustomerStage } from "../../components/CustomerStage";
import { ItemStage } from "../../components/ItemStage";
import { ScreenFrame } from "../../components/ScreenFrame";
import styles from "./EncounterScreen.module.css";

type EncounterPhase = Extract<GamePhase, { kind: "encounter" }>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  let current: HTMLElement | null = target;
  while (current) {
    const contentEditable = current.getAttribute("contenteditable");
    if (contentEditable === "" || contentEditable === "true" || current.isContentEditable) {
      return true;
    }
    if (contentEditable === "false") {
      return false;
    }
    current = current.parentElement;
  }

  return false;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden && !element.hasAttribute("disabled"));
}

interface EncounterScreenProps {
  game: GameState;
  encounter: AuthoredEncounter;
  phase: EncounterPhase;
  result: EncounterResultState | null;
  encounterNumber: number;
  encounterCount: number;
  onScan: () => void;
  onDecision: (decision: Decision, recommendedItemId?: string) => void;
  onNext: () => void;
}

export function EncounterScreen({
  game,
  encounter,
  phase,
  result,
  encounterNumber,
  encounterCount,
  onScan,
  onDecision,
  onNext,
}: EncounterScreenProps) {
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const recommendationTriggerRef = useRef<HTMLButtonElement>(null);
  const recommendationCloseRef = useRef<HTMLButtonElement>(null);
  const restoreRecommendationFocusRef = useRef(false);
  const customer = getTask4Customer(encounter.customerId);
  const requestedItem = getTask4Item(encounter.requestedItemId);

  useEffect(() => {
    setRecommendationOpen(false);
    restoreRecommendationFocusRef.current = false;
  }, [encounter.id]);

  const decisionAllowed = phase.subPhase === "decision";

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (recommendationOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setRecommendationOpen(false);
        }
        return;
      }

      if (
        !decisionAllowed ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        onDecision("sell");
      } else if (event.key === "2") {
        event.preventDefault();
        onDecision("refuse");
      } else if (event.key === "3" && encounter.recommendationOptions.length > 0) {
        event.preventDefault();
        restoreRecommendationFocusRef.current = true;
        setRecommendationOpen(true);
      }
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [decisionAllowed, encounter.recommendationOptions.length, onDecision, recommendationOpen]);

  useEffect(() => {
    if (!recommendationOpen) {
      if (restoreRecommendationFocusRef.current) {
        restoreRecommendationFocusRef.current = false;
        recommendationTriggerRef.current?.focus();
      }
      return;
    }

    recommendationCloseRef.current?.focus();
  }, [recommendationOpen]);

  const openRecommendations = () => {
    if (!decisionAllowed || encounter.recommendationOptions.length === 0) {
      return;
    }
    restoreRecommendationFocusRef.current = true;
    setRecommendationOpen(true);
  };

  const handleRecommendationDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setRecommendationOpen(false);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = getFocusableElements(event.currentTarget);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const activeElement = document.activeElement;
    const activeIndex = activeElement instanceof HTMLElement
      ? focusableElements.indexOf(activeElement)
      : -1;
    const nextIndex = event.shiftKey
      ? activeIndex <= 0
        ? focusableElements.length - 1
        : activeIndex - 1
      : activeIndex < 0 || activeIndex === focusableElements.length - 1
        ? 0
        : activeIndex + 1;

    event.preventDefault();
    focusableElements[nextIndex]?.focus();
  };

  const resultShown = phase.subPhase === "result" && result?.encounterId === encounter.id;
  const selectedRecommendation = result?.recommendedItemId
    ? encounter.recommendationOptions.find((option) => option.itemId === result.recommendedItemId)
    : undefined;
  const selectedRecommendedItem = selectedRecommendation
    ? getTask4Item(selectedRecommendation.itemId)
    : undefined;
  const resultCopy =
    result?.decision === "recommend"
      ? selectedRecommendation?.resultCopy
      : result
        ? encounter.outcomes[result.decision].copy
        : undefined;
  const resolvedResultCopy = resultCopy
    ? {
        result: resolveNarrative(resultCopy.result, game),
        readback: resolveNarrative(resultCopy.readback, game),
        receipt: resolveNarrative(resultCopy.receipt, game),
      }
    : undefined;
  const soldItems =
    result?.decision === "sell"
      ? [requestedItem]
      : result?.decision === "recommend" && selectedRecommendedItem
        ? [requestedItem, selectedRecommendedItem]
        : [];
  const basketTotal = soldItems.reduce((total, item) => total + item.price, 0);

  return (
    <ScreenFrame
      eyebrow={`DAY ${game.day} / 接客 ${encounterNumber} of ${encounterCount}`}
      heading={customer.name}
    >
      <div className={styles.encounterViewport}>
        <div className={styles.viewportStatus} aria-label="接客状況">
          <span>REGISTER / LIVE</span>
          <span>{resultShown ? "取引完了" : "対応中"}</span>
        </div>

        <div className={styles.encounterGrid}>
          <section className={styles.customerColumn} aria-labelledby="customer-dialogue-heading">
            <CustomerStage customerId={customer.id} name={customer.name} />
            <div className={styles.dialogue}>
              <p className={styles.dialogueLabel} id="customer-dialogue-heading">
                今回の来店者
              </p>
              <p className={styles.dialogueText}>{resolveNarrative(encounter.intro, game)}</p>
            </div>
          </section>

          {!resultShown ? (
            <div className={styles.interactionColumn}>
              <section className={styles.itemPanel} aria-labelledby="encounter-item-heading">
                <div className={styles.panelHeading}>
                  <span className={styles.panelIndex}>01</span>
                  <h2 id="encounter-item-heading">{TASK4_ENCOUNTER_UI.itemHeading}</h2>
                </div>
                <ItemStage
                  itemId={requestedItem.id}
                  name={requestedItem.name}
                  description={requestedItem.description}
                  price={requestedItem.price}
                />
                {phase.subPhase !== "intro" ? (
                  <p className={styles.scanStatus} role="status">
                    {resolveNarrative(encounter.scan, game)}
                  </p>
                ) : null}
                <div className={styles.scanActions}>
                  {phase.subPhase === "intro" ? (
                    <button className={styles.buttonSecondary} type="button" onClick={onScan}>
                      {TASK4_ENCOUNTER_UI.scanAction}
                    </button>
                  ) : null}
                </div>
              </section>

              <section className={styles.decisionPanel} aria-labelledby="encounter-decision-heading">
                <div className={styles.panelHeading}>
                  <span className={styles.panelIndex}>02</span>
                  <h2 id="encounter-decision-heading">{TASK4_ENCOUNTER_UI.decisionHeading}</h2>
                </div>
                <p className={styles.decisionStatus} role="status">
                  {phase.subPhase === "intro"
                    ? TASK4_ENCOUNTER_UI.scanRequired
                    : phase.subPhase === "decision"
                      ? TASK4_ENCOUNTER_UI.decisionAvailable
                      : TASK4_ENCOUNTER_UI.decisionResolved}
                </p>
                <div className={styles.decisionGrid}>
                  <button
                    className={styles.button}
                    type="button"
                    aria-keyshortcuts="1"
                    disabled={!decisionAllowed}
                    onClick={() => onDecision("sell")}
                  >
                    <span className={styles.shortcutHint} aria-hidden="true">1</span>
                    {TASK4_ENCOUNTER_UI.sellAction}
                  </button>
                  <button
                    className={styles.buttonWarning}
                    type="button"
                    aria-keyshortcuts="2"
                    disabled={!decisionAllowed}
                    onClick={() => onDecision("refuse")}
                  >
                    <span className={styles.shortcutHint} aria-hidden="true">2</span>
                    {TASK4_ENCOUNTER_UI.refuseAction}
                  </button>
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    aria-keyshortcuts="3"
                    ref={recommendationTriggerRef}
                    disabled={!decisionAllowed || encounter.recommendationOptions.length === 0}
                    onClick={openRecommendations}
                  >
                    <span className={styles.shortcutHint} aria-hidden="true">3</span>
                    {TASK4_ENCOUNTER_UI.recommendAction}
                  </button>
                </div>

                {recommendationOpen ? (
                  <div className={styles.dialogBackdrop}>
                    <div
                      className={styles.recommendationDialog}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="recommendation-dialog-heading"
                      onKeyDown={handleRecommendationDialogKeyDown}
                    >
                      <div className={styles.dialogHeader}>
                        <h3 id="recommendation-dialog-heading">
                          {TASK4_ENCOUNTER_UI.recommendationLabel}
                        </h3>
                        <button
                          className={styles.dialogCloseButton}
                          type="button"
                          ref={recommendationCloseRef}
                          onClick={() => setRecommendationOpen(false)}
                        >
                          閉じる
                        </button>
                      </div>
                      <div className={styles.recommendationList}>
                        {encounter.recommendationOptions.map((option) => {
                          const item = getTask4Item(option.itemId);
                          return (
                            <button
                              className={styles.recommendationButton}
                              key={option.id}
                              type="button"
                              disabled={!decisionAllowed}
                              onClick={() => {
                                setRecommendationOpen(false);
                                onDecision("recommend", option.itemId);
                              }}
                            >
                              <span>{option.label}</span>
                              <small>
                                <span className={styles.recommendationProductName}>{item.name}</span>
                                <span aria-hidden="true"> / </span>
                                <span>{item.price}円</span>
                                <span aria-hidden="true"> — </span>
                                <span>{option.description}</span>
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          ) : resolvedResultCopy ? (
            <section className={styles.resultPanel} aria-labelledby="receipt-heading" aria-live="polite">
              <div className={styles.resultHeader}>
                <span className={styles.panelIndex}>RESULT</span>
                <h2 id="receipt-heading">{TASK4_RECEIPT_UI.resultHeading}</h2>
              </div>
              <div className={styles.reaction}>
                <p className={styles.reactionLabel}>来店者の反応</p>
                <p className={styles.reactionText}>{resolvedResultCopy.result}</p>
              </div>
              <div className={styles.receipt} aria-label={TASK4_RECEIPT_UI.receiptLabel}>
                <p className={styles.receiptRecord}>{resolvedResultCopy.receipt}</p>
                {soldItems.length > 0 ? (
                  <ul className={styles.soldItems} aria-label={TASK4_RECEIPT_UI.soldItemsLabel}>
                    {soldItems.map((item) => (
                      <li key={item.id}>
                        {item.name} / {item.price}円
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className={styles.resultStats}>
                  <p>{TASK4_RECEIPT_UI.saleTotalLabel}: {basketTotal}円</p>
                  <p>{TASK4_RECEIPT_UI.dailyRevenueLabel}: {game.revenue.today}円</p>
                </div>
                <p className={styles.resultReadback}>{resolvedResultCopy.readback}</p>
              </div>
              <button className={styles.button} type="button" onClick={onNext}>
                {TASK4_ENCOUNTER_UI.nextEncounterAction}
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </ScreenFrame>
  );
}
