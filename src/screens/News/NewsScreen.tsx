import { canAdvanceAfterNews, getCommittedNewsSelections } from "../../engine";
import type { GameState, NewsRole } from "../../domain";
import { getTask5NewsArticle } from "../../content";
import { ScreenFrame } from "../../components/ScreenFrame";
import styles from "../Task3/Task3Screens.module.css";

const NEWS_ROLE_LABELS: Record<NewsRole, string> = {
  direct: "直接影響",
  trend: "傾向",
  discrepancy: "矛盾",
  local: "ローカル",
};

const NEWS_UI = {
  eyebrow: "SMARTPHONE NEWS",
  heading: "勤務後のニュース",
  description: "通知の見出しを手がかりに、三件の記事をすべて開く。",
  listLabel: "今日のニュース",
  openActionPrefix: "記事を開く",
  readActionPrefix: "既読",
} as const;

interface NewsScreenProps {
  game: GameState;
  openNewsId: string | null;
  onRead: (newsId: string) => void;
  onAdvance: () => void;
}

export function NewsScreen({ game, openNewsId, onRead, onAdvance }: NewsScreenProps) {
  const selections = getCommittedNewsSelections(game);
  const readCount = selections.filter((selection) => game.readNews.includes(selection.newsId)).length;
  const articles = selections.map((selection) => getTask5NewsArticle(selection.newsId));
  const nextAction = game.day === 5 ? "結末を見る" : `Day ${game.day + 1}へ進む`;

  return (
    <ScreenFrame
      eyebrow={["DAY", game.day, "/", NEWS_UI.eyebrow].join(" ")}
      heading={NEWS_UI.heading}
      description={NEWS_UI.description}
    >
      <div className={styles.content}>
        <p className={styles.status} role="status" aria-live="polite">
          開封済み: {readCount} / 3
        </p>
        <ul className={styles.newsList} aria-label={NEWS_UI.listLabel}>
          {articles.map((article, index) => {
            const isRead = game.readNews.includes(article.id);
            const isOpen = openNewsId === article.id;
            const actionLabel = isRead
              ? [NEWS_UI.readActionPrefix, article.headline].join(": ")
              : [NEWS_UI.openActionPrefix, article.notificationHeadline].join(": ");
            return (
              <li key={article.id}>
                <article className={styles.newsCard} aria-labelledby={`${article.id}-heading`}>
                  <span className={styles.newsMeta}>
                    NEWS {index + 1} / {article.role}（{NEWS_ROLE_LABELS[article.role]}）
                  </span>
                  <h2 id={`${article.id}-heading`}>
                    {isOpen || isRead ? article.headline : article.notificationHeadline}
                  </h2>
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    disabled={isRead}
                    aria-expanded={isOpen || isRead}
                    onClick={() => onRead(article.id)}
                  >
                    {actionLabel}
                  </button>
                  {isOpen || isRead ? (
                    <div>
                      <p>{article.body}</p>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={!canAdvanceAfterNews(game)}
            onClick={onAdvance}
          >
            {nextAction}
          </button>
        </div>
      </div>
    </ScreenFrame>
  );
}
