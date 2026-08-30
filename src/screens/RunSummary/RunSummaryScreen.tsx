import { getTask5EndingRecord, TASK5_CONTENT_TOTALS, resolveNarrative } from "../../content";
import { TASK5_NEWS_SELECTED_TOTAL } from "../../content/news/contracts";
import type { GameState } from "../../domain";
import type { EndingResultState } from "../../app/gameController";
import { ScreenFrame } from "../../components/ScreenFrame";
import styles from "../Task3/Task3Screens.module.css";

interface RunSummaryScreenProps {
  game: GameState;
  endingResult: EndingResultState;
  onReset: () => void;
  onNext: () => void;
}

export function RunSummaryScreen({ game, endingResult, onReset, onNext }: RunSummaryScreenProps) {
  const ending = getTask5EndingRecord(endingResult.endingId);
  const runSummary = resolveNarrative(ending.presentation.runSummary, game);

  return (
    <ScreenFrame eyebrow="RUN SUMMARY" heading="周回結果">
      <div className={`${styles.content} ${styles.contentNarrow}`}>
        <section className={styles.panel} aria-labelledby="run-summary-narrative-heading">
          <h2 id="run-summary-narrative-heading">この夜の記録</h2>
          <p className={styles.prose}>{runSummary}</p>
        </section>

        <dl className={styles.metaGrid} aria-label="周回の記録">
          <div>
            <dt>勤務日数</dt>
            <dd>{TASK5_CONTENT_TOTALS.dayPlans}夜</dd>
          </div>
          <div>
            <dt>接客数</dt>
            <dd>{TASK5_CONTENT_TOTALS.slots}組</dd>
          </div>
          <div>
            <dt>ニュース記事</dt>
            <dd>{TASK5_NEWS_SELECTED_TOTAL}記事</dd>
          </div>
          <div>
            <dt>結末</dt>
            <dd>{ending.presentation.title}</dd>
          </div>
          <div>
            <dt>総売上</dt>
            <dd>{game.revenue.total}円</dd>
          </div>
        </dl>

        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onNext}>
            次の周回へ
          </button>
          <button className={styles.button} type="button" onClick={onReset}>
            タイトルへ戻る
          </button>
        </div>
      </div>
    </ScreenFrame>
  );
}
