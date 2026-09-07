import { TASK5_CONTENT, getTask5Customer, getTask5Item } from "../content";
import { CONNECTION_EPILOGUES, receiptFlag, witnessFlag } from "../content/connections";
import type { GameState } from "../domain";
import styles from "./ShiftNotebook.module.css";
import { useState } from "react";

export function ShiftNotebook({ game }: { game: GameState }) {
  const [open, setOpen] = useState(false);
  const conversations = TASK5_CONTENT.encounters.flatMap((encounter) =>
    (encounter.questions ?? []).filter((question) => game.flags.includes(question.id))
      .map((question) => ({ encounter, question })),
  );
  const receipts = game.eventLog.filter((event) => event.type === "encounter.decision");
  const witnesses = TASK5_CONTENT.customers.filter((customer) => game.flags.includes(witnessFlag(customer.id)));
  const articles = game.readNews.map((id) => TASK5_CONTENT.news.find((article) => article.id === id))
    .filter((article) => article !== undefined);
  const connections = CONNECTION_EPILOGUES.filter((entry) => game.flags.includes(entry.flag) &&
    receipts.some((event) => event.data.encounterId === entry.revealEncounter));

  return (
    <details className={styles.notebook} onKeyDown={(event) => event.stopPropagation()}
      onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className={styles.title}>接客ノート</span>
        <span className={styles.count}>会話 {conversations.length}・控え {receipts.length}</span>
        <span className={styles.openHint}>記録を読み返す</span>
      </summary>
      {open ? <div className={styles.pages}>
        <section aria-labelledby="notebook-conversations">
          <h2 id="notebook-conversations">レジ越しに聞いたこと</h2>
          {conversations.length === 0 ? <p className={styles.empty}>接客で「ひとつ聞く」と、相手の言葉がここに残ります。</p> : null}
          {conversations.map(({ encounter, question }) => (
            <details key={question.id} className={styles.entry}>
              <summary>{getTask5Customer(encounter.customerId).name} / {question.label}</summary>
              <p>{question.reply}</p>
            </details>
          ))}
          {witnesses.length > 0 ? (
            <div className={styles.witnesses}>
              <h3>レシートを渡した人</h3>
              <p>{witnesses.map((customer) => customer.name).join("、")}</p>
              <small>また会ったら、紙の記録について聞いてみよう。</small>
            </div>
          ) : null}
          {connections.map((entry) => (
            <div className={styles.connection} key={entry.flag}><h3>{entry.title}</h3><p>{entry.body}</p></div>
          ))}
        </section>
        <section aria-labelledby="notebook-receipts">
          <h2 id="notebook-receipts">会計の控え</h2>
          <p className={styles.empty}>この店の紙には、そのときの記録が残っている。</p>
          {[...receipts].reverse().map((event) => {
            const customer = getTask5Customer(String(event.data.customerId));
            const item = getTask5Item(String(event.data.requestedItemId));
            const extra = typeof event.data.recommendedItemId === "string" ? getTask5Item(event.data.recommendedItemId) : null;
            const refused = event.data.decision === "refuse";
            const handed = game.flags.includes(receiptFlag(String(event.data.encounterId)));
            return (
              <div className={styles.receipt} key={event.id}>
                <p className={styles.receiptMeta}>DAY {event.day} · {customer.name}{handed ? " · お渡し済み" : ""}</p>
                <p>{item.name}{extra ? ` ＋ ${extra.name}` : ""}</p>
                <strong>{refused ? "販売を見送った" : `${item.price + (extra?.price ?? 0)} 円`}</strong>
              </div>
            );
          })}
        </section>
        {articles.length > 0 ? (
          <section className={styles.archive} aria-labelledby="notebook-news">
            <h2 id="notebook-news">保存通知と記事</h2>
            <p className={styles.empty}>開く前の通知と、開いたあとの記事。会計の控えと見比べてみよう。</p>
            {articles.map((article) => (
              <details key={article.id} className={styles.entry}>
                <summary>DAY {article.day} / {article.notificationHeadline}</summary>
                <p className={styles.original}>保存通知：{article.notificationHeadline}</p>
                <p><strong>記事：{article.headline}</strong></p><p>{article.body}</p>
              </details>
            ))}
          </section>
        ) : null}
      </div> : null}
    </details>
  );
}
