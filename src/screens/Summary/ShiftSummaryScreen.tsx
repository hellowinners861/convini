import { getTask5DayPlan, resolveNarrative } from "../../content";
import type { GameState } from "../../domain";
import { ScreenFrame } from "../../components/ScreenFrame";
import styles from "../Task3/Task3Screens.module.css";

interface ShiftSummaryScreenProps {
  game: GameState;
  onOpenNews: () => void;
}

export function ShiftSummaryScreen({ game, onOpenNews }: ShiftSummaryScreenProps) {
  const summary = getTask5DayPlan(game.day).presentation.shiftSummary;
  const heading = resolveNarrative(summary.heading, game);
  const body = resolveNarrative(summary.body, game);

  return (
    <ScreenFrame
      eyebrow={`DAY ${game.day} / SHIFT SUMMARY`}
      heading={heading}
      description={body}
    >
      <div className={`${styles.content} ${styles.contentNarrow}`}>
        <section className={styles.panel} aria-labelledby="summary-heading">
          <h2 id="summary-heading">勤務の記録</h2>
          <dl className={styles.metaGrid}>
            <div>
              <dt>接客数</dt>
              <dd>{game.resolvedQueue.length}組</dd>
            </div>
            <div>
              <dt>本日の売上</dt>
              <dd>{game.revenue.today}円</dd>
            </div>
          </dl>
        </section>
        <div className={styles.actions}>
          <p className={styles.status} role="status" aria-live="polite">
            {game.day === 5
              ? "ニュースを開いて、五日間の結末へ進みます。"
              : "ニュースを開いて、次の勤務へ進みます。"}
          </p>
          <button className={styles.button} type="button" onClick={onOpenNews}>
            ニュースを開く
          </button>
        </div>
      </div>
    </ScreenFrame>
  );
}
