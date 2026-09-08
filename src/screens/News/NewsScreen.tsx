import { canAdvanceAfterNews, getCommittedNewsSelections } from "../../engine";
import { getTask5NewsArticle } from "../../content";
import type { GameState } from "../../domain";
import { ScreenFrame } from "../../components/ScreenFrame";
import { CONNECTION_UPDATES } from "../../content/connections";
import { EvidenceNotebook } from "../../components/NightShift";
import type { NightAction } from "../../engine/nightShift";
import styles from "./NewsScreen.module.css";

interface NewsScreenProps {
  game: GameState;
  openNewsId: string | null;
  onRead: (newsId: string) => void;
  onAdvance: () => void;
  onNightAction?: (action: NightAction) => void;
}

export function NewsScreen({ game, openNewsId, onRead, onAdvance, onNightAction }: NewsScreenProps) {
  const selections = getCommittedNewsSelections(game);
  const articles = selections.map((selection) => getTask5NewsArticle(selection.newsId));
  const readCount = selections.filter((selection) => game.readNews.includes(selection.newsId)).length;
  const allRead = selections.length > 0 && readCount === selections.length;
  const advanceName = game.day === 5 ? "結末を見る" : `Day ${game.day + 1}へ進む`;

  return (
    <ScreenFrame
      eyebrow={`DAY ${game.day} / NIGHT FEED`}
      heading="勤務後のニュース"
      description="レジに残った記録と、街から届いた通知を読み返す。"
    >
      <div className={styles.newsLayout}>
        <section className={styles.phone} aria-label="ニュースを読むスマートフォン">
          <div className={styles.phoneNotch} aria-hidden="true" />
          <div className={styles.phoneStatusBar} aria-hidden="true">
            <span>00:47</span>
            <span>▰ ◒ ▪</span>
          </div>
          <div className={styles.phoneAppBar}>
            <span className={styles.phoneBrand}>NIGHT FEED</span>
            <span className={styles.phoneSignal}>受信中</span>
          </div>
          <div className={styles.phoneFeed} tabIndex={0} role="region" aria-label="ニュース一覧">
            {articles.map((article, index) => {
              const isRead = game.readNews.includes(article.id);
              const isOpen = openNewsId === article.id;
              const showAuthoredArticle = isOpen || isRead;

              return (
                <article
                  className={`${styles.article} ${isOpen ? styles.articleOpen : ""}`}
                  key={article.id}
                  aria-labelledby={`news-article-${index}`}
                >
                  <div className={styles.articleMeta}>
                    <span>通知 {String(index + 1).padStart(2, "0")}</span>
                    {isRead ? <span>既読</span> : <span>新着</span>}
                  </div>
                  <h2 id={`news-article-${index}`}>
                    {showAuthoredArticle ? article.headline : article.notificationHeadline}
                  </h2>
                  {showAuthoredArticle ? (
                    <>
                      <div className={styles.savedNotification}><span>保存された通知</span><p>{article.notificationHeadline}</p></div>
                      <p className={styles.articleBody}>{article.body}</p>
                    </>
                  ) : null}
                  <button
                    className={styles.readButton}
                    type="button"
                    aria-expanded={showAuthoredArticle}
                    disabled={isRead}
                    onClick={() => onRead(article.id)}
                  >
                    {isRead
                      ? `既読: ${article.headline}`
                      : `記事を開く: ${article.notificationHeadline}`}
                  </button>
                </article>
              );
            })}
          </div>
          <div className={styles.phoneHomeIndicator} aria-hidden="true" />
        </section>

        <aside className={styles.newsControls} aria-label="ニュースの進行状況">
          {CONNECTION_UPDATES.filter((update) => update.day === game.day && game.flags.includes(update.flag)).map((update) => (
            <section className={styles.personalMessage} key={update.flag}>
              <p className={styles.controlLabel}>街の人から</p>
              <h2>{update.sender}</h2><p>{update.text}</p>
            </section>
          ))}
          <div className={styles.progressCard}>
            <p className={styles.controlLabel}>SHIFT LOG</p>
            <p className={styles.progressValue} role="status">
              開封済み: {readCount} / {articles.length}
            </p>
            <p className={styles.progressHint}>
              {allRead ? "すべての通知を確認しました。" : "未読の通知があります。"}
            </p>
          </div>
          <button
            className={styles.advanceButton}
            type="button"
            disabled={!canAdvanceAfterNews(game)}
            onClick={onAdvance}
          >
            {advanceName}
          </button>
          <EvidenceNotebook key={game.day} game={game} onNightAction={onNightAction} />
        </aside>
      </div>
    </ScreenFrame>
  );
}
