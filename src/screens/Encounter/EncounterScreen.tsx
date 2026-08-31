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
import { ScreenFrame } from "../../components/ScreenFrame";
import styles from "../Task3/Task3Screens.module.css";

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
  onOpenDecision: () => void;
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
  onOpenDecision,
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

  const handleRecommendationDialogKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
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
      description={resolveNarrative(encounter.intro, game)}
    >
      <div className={styles.content}>
        <p className={styles.prose}>{customer.description}</p>
        <section className={styles.panel} aria-labelledby="encounter-item-heading">
          <h2 id="encounter-item-heading">{TASK4_ENCOUNTER_UI.itemHeading}</h2>
          <dl className={styles.metaGrid}>
            <div>
              <dt>{TASK4_ENCOUNTER_UI.itemNameLabel}</dt>
              <dd>{requestedItem.name}</dd>
            </div>
            <div>
              <dt>{TASK4_ENCOUNTER_UI.priceLabel}</dt>
              <dd>{requestedItem.price}円</dd>
            </div>
          </dl>
          <p className={styles.prose}>{requestedItem.description}</p>
          {phase.subPhase !== "intro" ? (
            <p className={styles.status}>{resolveNarrative(encounter.scan, game)}</p>
          ) : null}
          <div className={styles.actions}>
            {phase.subPhase === "intro" ? (
              <button className={styles.buttonSecondary} type="button" onClick={onScan}>
                {TASK4_ENCOUNTER_UI.scanAction}
              </button>
            ) : null}
            {phase.subPhase === "scan" ? (
              <button className={styles.buttonSecondary} type="button" onClick={onOpenDecision}>
                {TASK4_ENCOUNTER_UI.reviewScanAction}
              </button>
            ) : null}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="encounter-decision-heading">
          <h2 id="encounter-decision-heading">{TASK4_ENCOUNTER_UI.decisionHeading}</h2>
          <p className={styles.status}>
            {phase.subPhase === "intro"
              ? TASK4_ENCOUNTER_UI.scanRequired
              : phase.subPhase === "scan"
                ? TASK4_ENCOUNTER_UI.scanReviewed
                : phase.subPhase === "decision"
                  ? TASK4_ENCOUNTER_UI.decisionAvailable
                  : TASK4_ENCOUNTER_UI.decisionResolved}
          </p>
          <div className={styles.decisionActions}>
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

        {resultShown && resolvedResultCopy ? (
          <section className={styles.panel} aria-labelledby="receipt-heading" aria-live="polite">
            <h2 id="receipt-heading">{TASK4_RECEIPT_UI.resultHeading}</h2>
            <p className={styles.prose}>{resolvedResultCopy.result}</p>
            <div className={styles.receipt} aria-label={TASK4_RECEIPT_UI.receiptLabel}>
              <p>{resolvedResultCopy.receipt}</p>
              <p>{TASK4_RECEIPT_UI.saleTotalLabel}: {basketTotal}円</p>
              {soldItems.length > 0 ? (
                <ul className={styles.list} aria-label={TASK4_RECEIPT_UI.soldItemsLabel}>
                  {soldItems.map((item) => (
                    <li key={item.id}>
                      {item.name} / {item.price}円
                    </li>
                  ))}
                </ul>
              ) : null}
              <p>{TASK4_RECEIPT_UI.dailyRevenueLabel}: {game.revenue.today}円</p>
              <p>{resolvedResultCopy.readback}</p>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="button" onClick={onNext}>
                {TASK4_ENCOUNTER_UI.nextEncounterAction}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </ScreenFrame>
  );
}
