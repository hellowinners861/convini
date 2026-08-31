import type { RecoveryKey } from "../../app/GameContext";
import styles from "./PersistenceRecoveryScreen.module.css";

interface PersistenceRecoveryScreenProps {
  recoveryKey: RecoveryKey;
  notice: string | null;
  error: string | null;
  onClear: () => void;
}

const KEY_LABELS: Record<RecoveryKey, string> = {
  run: "進行データ",
  meta: "周回記録",
  settings: "設定データ",
};

export function PersistenceRecoveryScreen({
  recoveryKey,
  notice,
  error,
  onClear,
}: PersistenceRecoveryScreenProps) {
  const label = KEY_LABELS[recoveryKey];

  return (
    <main className={styles.shell} aria-labelledby="persistence-recovery-heading">
      <section className={styles.panel}>
        <p className={styles.eyebrow}>SAVE RECOVERY</p>
        <h1 id="persistence-recovery-heading">保存データを確認できません</h1>
        <div role="alert">
          <p>{notice ?? `${label}を読み込めませんでした。`}</p>
          <p>このキーだけを削除して、もう一度確認できます。</p>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
        <button type="button" onClick={onClear}>
          {label}を削除して再確認
        </button>
      </section>
    </main>
  );
}
