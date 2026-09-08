import { getTask4DayPlan, resolveNarrative, TASK4_BRIEFING_UI } from "../../content";
import type { GameState } from "../../domain";
import { ScreenFrame } from "../../components/ScreenFrame";
import { CONNECTION_HINTS } from "../../content/connections";
import { NightWatch } from "../../components/NightShift";
import type { NightAction } from "../../engine/nightShift";
import styles from "../Task3/Task3Screens.module.css";

interface BriefingScreenProps {
  game: GameState;
  onBegin: () => void;
  onNightAction?: (action: NightAction) => void;
}

export function BriefingScreen({ game, onBegin, onNightAction }: BriefingScreenProps) {
  const plan = getTask4DayPlan(game.day);
  const briefing = plan.presentation.briefing;

  return (
    <ScreenFrame
      eyebrow={resolveNarrative(briefing.eyebrow, game)}
      heading={resolveNarrative(briefing.heading, game)}
      description={resolveNarrative(briefing.body, game)}
    >
      <div className={`${styles.content} ${styles.contentNarrow}`}>
        <section className={styles.panel} aria-labelledby="briefing-checklist-heading">
          <h2 id="briefing-checklist-heading">{TASK4_BRIEFING_UI.checklistHeading}</h2>
          <ul className={styles.list}>
            {briefing.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={styles.prose}>{CONNECTION_HINTS[game.day]}</p>
        </section>
        <dl className={styles.metaGrid} aria-label="勤務情報">
          <div>
            <dt>{TASK4_BRIEFING_UI.workdayLabel}</dt>
            <dd>Day {game.day}</dd>
          </div>
          <div>
            <dt>{TASK4_BRIEFING_UI.encounterCountLabel}</dt>
            <dd>{plan.slots.length}組</dd>
          </div>
          <div>
            <dt>本日の売上目標</dt>
            <dd>{plan.revenueTarget}円</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onBegin}>
            {TASK4_BRIEFING_UI.beginShiftAction}
          </button>
        </div>
        <NightWatch game={game} onNightAction={onNightAction} />
      </div>
    </ScreenFrame>
  );
}
