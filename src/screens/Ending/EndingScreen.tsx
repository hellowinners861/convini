import { getTask5EndingRecord, resolveNarrative } from "../../content";
import type { GameState } from "../../domain";
import type { EndingResultState } from "../../app/gameController";
import { ScreenFrame } from "../../components/ScreenFrame";
import { nightEpilogues } from "../../engine/nightShift";
import styles from "../Task3/Task3Screens.module.css";

interface EndingScreenProps {
  game: GameState;
  endingResult: EndingResultState;
  onOpenRunSummary: () => void;
}

export function EndingScreen({ game, endingResult, onOpenRunSummary }: EndingScreenProps) {
  const ending = getTask5EndingRecord(endingResult.endingId);
  const lead = resolveNarrative(ending.presentation.lead, game);
  const body = resolveNarrative(ending.presentation.body, game);
  const finalLine = resolveNarrative(ending.presentation.finalLine, game);

  return (
    <ScreenFrame eyebrow="DAY 5 / ENDING" heading={ending.presentation.title}>
      <div className={`${styles.content} ${styles.contentNarrow}`}>
        <section className={styles.panel} aria-labelledby="ending-lead-heading">
          <h2 id="ending-lead-heading">結末</h2>
          <p className={styles.prose}>{lead}</p>
        </section>
        <section className={styles.panel} aria-labelledby="ending-body-heading">
          <h2 id="ending-body-heading">その後</h2>
          <p className={styles.prose}>{body}</p>
        </section>
        <section className={styles.panel} aria-labelledby="ending-final-line-heading">
          <h2 id="ending-final-line-heading">最後の一言</h2>
          <p className={styles.prose}>{finalLine}</p>
        </section>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onOpenRunSummary}>
            周回結果を見る
          </button>
        </div>
        {nightEpilogues(game).map((epilogue) => (
          <section className={styles.panel} key={epilogue.flag} aria-label={epilogue.title}>
            <h2>{epilogue.title}</h2>
            <p className={styles.prose}>{epilogue.body}</p>
          </section>
        ))}
      </div>
    </ScreenFrame>
  );
}
