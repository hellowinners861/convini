import { useState } from "react";
import { APP_TITLE, PLAYABLE_MVP_NOTICE } from "../../app/appMeta";
import styles from "./TitleScreen.module.css";

interface TitleScreenProps {
  hasSavedRun?: boolean;
  onContinue?: () => void;
  onStart?: () => void;
  notice?: string | null;
  error?: string | null;
}

export function TitleScreen({
  hasSavedRun = false,
  onContinue,
  onStart,
  notice,
  error,
}: TitleScreenProps) {
  const [isMvpReady, setIsMvpReady] = useState(false);
  const [isNewRunConfirmationOpen, setIsNewRunConfirmationOpen] = useState(false);

  function startNewRun() {
    if (hasSavedRun) {
      setIsNewRunConfirmationOpen(true);
      return;
    }
    setIsMvpReady(true);
    onStart?.();
  }

  function confirmNewRun() {
    setIsNewRunConfirmationOpen(false);
    setIsMvpReady(true);
    onStart?.();
  }

  return (
    <main className={styles.shell}>
      <div className={styles.lightBand} aria-hidden="true" />
      <section className={styles.panel} aria-labelledby="title-screen-heading">
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.storefront}>
            <span className={styles.storefrontSign}>CONVENI</span>
            <span className={styles.storefrontSubsign}>OPEN LATE</span>
          </div>
          <div className={styles.windowGlow} />
          <div className={styles.counter} />
          <div className={styles.receiptStack} />
        </div>

        <div className={styles.copy}>
          <p className={styles.eyebrow}>深夜営業 / 5日間MVPプレイ可能</p>
          <h1 id="title-screen-heading" className={styles.title}>
            <span>最後の</span>
            <span>コンビニ</span>
          </h1>
          <p className={styles.lede}>
            いつものレジに、見覚えのない商品が並びはじめる。
          </p>

          <div className={styles.receipt} aria-label="プロジェクト情報">
            <p>LAST CONVENIENCE</p>
            <p>PLAYABLE MVP / 001</p>
            <p>DOM + CSS MODULES</p>
          </div>

          {hasSavedRun ? (
            <div className={styles.actions}>
              <button className={styles.continueButton} type="button" onClick={onContinue}>
                つづきから
              </button>
              <button
                className={styles.startButton}
                type="button"
                onClick={startNewRun}
                aria-describedby="mvp-status"
              >
                はじめから
              </button>
            </div>
          ) : (
            <button
              className={styles.startButton}
              type="button"
              onClick={startNewRun}
              aria-describedby="mvp-status"
            >
              はじめから
            </button>
          )}
          {isNewRunConfirmationOpen ? (
            <div
              className={styles.confirmation}
              role="group"
              aria-labelledby="new-run-confirmation-heading"
            >
              <h2 id="new-run-confirmation-heading">現在の周回を置き換えますか？</h2>
              <p>保存中の周回は置き換わります。</p>
              <div className={styles.actions}>
                <button className={styles.confirmButton} type="button" onClick={confirmNewRun}>
                  はじめから始める
                </button>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={() => setIsNewRunConfirmationOpen(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : null}
          {notice ? (
            <p className={styles.notice} aria-live="polite">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <p id="mvp-status" className={styles.status} role="status" aria-live="polite">
            {isMvpReady ? PLAYABLE_MVP_NOTICE : "「はじめから」で5日間MVPを開始できます"}
          </p>
        </div>
      </section>

      <p className={styles.footer}>
        {APP_TITLE} / PC BROWSER / JAPANESE
      </p>
    </main>
  );
}
