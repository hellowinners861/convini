import { useId, useState } from "react";
import type { DomainEvent, GameState } from "../domain";
import { getTask5Customer, getTask5Item, getTask5NewsArticle, resolveNarrative } from "../content";
import { NIGHT_FLAGS, QUIET_NIGHTS } from "../content/nightShift";
import {
  counterMoment, evidenceLinks, evidenceReply, inspectedSpot, powerAvailable,
  presentableEvidence, presentedEvidence, selectedCounterChoice, type NightAction,
} from "../engine/nightShift";
import type { AuthoredEncounter } from "../content/types";
import styles from "./NightShift.module.css";

export interface NightInteractionProps {
  game: GameState;
  onNightAction?: (action: NightAction) => void;
}

export function CounterMomentPanel({ game, encounterId, onNightAction }: NightInteractionProps & { encounterId: string }) {
  const id = useId();
  const moment = counterMoment(game, encounterId);
  if (!moment || !onNightAction) return null;
  const selected = selectedCounterChoice(game, moment.id);
  const enabled = game.phase.kind === "encounter" && game.phase.subPhase === "decision";
  const soldOut = moment.id === "hospital-power" && !powerAvailable(game);
  return (
    <section className={styles.moment} aria-labelledby={id}>
      <span className={styles.eyebrow}>ひと声の接客</span>
      <h2 id={id}>{moment.title}</h2>
      <p>{moment.prompt}</p>
      {selected ? <div className={styles.reply} role="status"><strong>{selected.label}</strong><p>{selected.reply}</p></div> : (
        <>
          <p className={styles.hint}>{enabled ? "ひと声かけるか、そのまま会計へ。返答は一度だけ選べます。" : "スキャン後に、ひと声かけられます。"}</p>
          <div className={styles.choices}>
            {moment.choices.map((choice) => (
              <button type="button" key={choice.id}
                disabled={!enabled || (soldOut && choice.id === "deliver")}
                onClick={() => onNightAction({ type: "CHOOSE_COUNTER_MOMENT", momentId: moment.id, choiceId: choice.id })}>
                <strong>{soldOut && choice.id === "deliver" ? "電源は販売済み" : choice.label}</strong>
                <small>{choice.hint}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {moment.id === "last-power" ? <p className={styles.stock}>
        電源の在庫：{!powerAvailable(game) ? "0個" : game.flags.includes(NIGHT_FLAGS.reserved) ? "1個・宮下さま取り置き" : "1個"}
        <span>次の入荷：明夜の二便目</span>
      </p> : null}
    </section>
  );
}

export function NightWatch({ game, onNightAction }: NightInteractionProps) {
  const id = useId();
  if (!onNightAction) return null;
  const night = QUIET_NIGHTS[game.day];
  const selected = inspectedSpot(game);
  return (
    <section className={styles.watch} aria-labelledby={id}>
      <div className={styles.watchHeading}><span className={styles.eyebrow}>客の途切れた店内</span><time>{night.time}</time></div>
      <h2 id={id}>レジを離れて、少しだけ。</h2>
      <p>{night.atmosphere}</p>
      <div className={styles.spots}>
        {night.spots.map((spot) => (
          <button key={spot.id} type="button" className={styles.spot} data-spot={spot.id}
            aria-pressed={selected?.id === spot.id} disabled={Boolean(selected)}
            onClick={() => onNightAction({ type: "INSPECT_NIGHT", spotId: spot.id })}>
            <span className={styles.spotDrawing} aria-hidden="true"><i /><i /><i /></span>
            <span>{spot.label}</span>
          </button>
        ))}
      </div>
      {selected ? <div className={styles.finding} role="status"><strong>{selected.label}で気づいたこと</strong><p>{resolveNarrative(selected.finding, game)}</p></div> :
        <p className={styles.watchHint}>1夜に一か所。気づいたことは手帳に残ります。観察せずに接客へ進むこともできます。</p>}
    </section>
  );
}

function receiptTitle(event: DomainEvent): string {
  const customer = getTask5Customer(String(event.data.customerId));
  const item = getTask5Item(String(event.data.requestedItemId));
  return `Day ${event.day} / ${customer.name} / ${event.data.decision === "refuse" ? "販売を断る" : item.name}`;
}

export function ReceiptRecord({ event, game }: { event: DomainEvent; game: GameState }) {
  const customer = getTask5Customer(String(event.data.customerId));
  const requested = getTask5Item(String(event.data.requestedItemId));
  const recommended = typeof event.data.recommendedItemId === "string" ? getTask5Item(event.data.recommendedItemId) : null;
  const refused = event.data.decision === "refuse";
  const hospitalPower = event.data.encounterId === "d4_miyashita_triage" && !refused && game.flags.includes(NIGHT_FLAGS.powerHospital);
  return (
    <div className={styles.receipt}>
      <span className={styles.eyebrow}>POS保存記録 / Day {event.day}</span>
      <strong>{customer.name}</strong>
      <p>{refused ? `販売を断った商品：${requested.name}` : `${requested.name} / ${requested.price}円`}</p>
      {recommended ? <p>おすすめ：{recommended.name} / {recommended.price}円</p> : null}
      {hospitalPower ? <p>モバイル電源 / 1,980円 / 病院用</p> : null}
      {event.data.encounterId === "d2_ren_spirit_echo" && game.flags.includes(NIGHT_FLAGS.promise) ? <p>余白のメモ：明日も「大庭 蓮」と呼ぶ。</p> : null}
      <p className={styles.total}>合計 {refused ? 0 : requested.price + (recommended?.price ?? 0) + (hospitalPower ? 1980 : 0)}円</p>
    </div>
  );
}

export function EvidenceNotebook({ game, onNightAction }: NightInteractionProps) {
  const id = useId();
  const [chosenNews, setChosenNews] = useState("");
  const [chosenEvent, setChosenEvent] = useState("");
  const newsId = game.readNews.includes(chosenNews) ? chosenNews : game.readNews.at(-1);
  const news = newsId ? getTask5NewsArticle(newsId) : undefined;
  const events = game.eventLog.filter((entry) => entry.type === "encounter.decision" && (!news || entry.day <= news.day));
  const links = evidenceLinks(game);
  const saved = links.find((entry) => entry.newsId === newsId);
  const selectedEvent = events.find((entry) => entry.id === chosenEvent) ?? saved?.event ?? events.at(-1);
  const locked = newsId && game.flags.some((entry) => entry.startsWith("night:shown:") && entry.endsWith(`:${newsId}`));
  const unchanged = saved?.event.id === selectedEvent?.id;
  return (
    <section className={styles.notebook} aria-labelledby={id}>
      <span className={styles.eyebrow}>書き換わらない記録</span>
      <h2 id={id}>レシートと通知の手帳</h2>
      <p className={styles.hint}>記事と買い物を見比べて、気になる組み合わせを仮説として残す。翌夜、関係する客に提示できます。</p>
      {news && selectedEvent ? (
        <>
          <label className={styles.field}>比較する記事
            <select value={news.id} onChange={(event) => { setChosenNews(event.target.value); setChosenEvent(""); }}>
              {game.readNews.map((key) => { const article = getTask5NewsArticle(key); return <option key={key} value={key}>Day {article.day} / {article.headline}</option>; })}
            </select>
          </label>
          <div className={styles.comparison}>
            <div><span>受信時の通知</span><p>{news.notificationHeadline}</p></div>
            <div><span>現在の記事</span><p>{news.headline}</p></div>
          </div>
          <details className={styles.articleDetails}><summary>記事の本文を読み返す</summary><p>{news.body}</p></details>
          <label className={styles.field}>照合するレシート
            <select value={selectedEvent.id} disabled={Boolean(locked)} onChange={(event) => setChosenEvent(event.target.value)}>
              {events.map((entry) => <option key={entry.id} value={entry.id}>{receiptTitle(entry)}</option>)}
            </select>
          </label>
          <ReceiptRecord event={selectedEvent} game={game} />
          <button type="button" className={styles.pin} disabled={!onNightAction || unchanged || Boolean(locked)}
            onClick={() => onNightAction?.({ type: "PIN_EVIDENCE", newsId: news.id, eventId: selectedEvent.id })}>
            {locked ? "提示した仮説を保存済み" : unchanged ? "この仮説を保存済み" : "この組み合わせを仮説にする"}
          </button>
          <p className={styles.hint} aria-live="polite">保存した仮説：{links.length}件。関連を確かめるには、客の記憶も必要です。</p>
        </>
      ) : <p>ニュースを開くと、保存した通知とレシートをここで比較できます。</p>}
      <details className={styles.articleDetails}>
        <summary>店内で気づいたこと</summary>
        {[1, 2, 3, 4, 5].map((day) => {
          const spot = inspectedSpot(game, day as GameState["day"]);
          return spot ? <p key={day}><strong>Day {day} / {spot.label}</strong><br />{resolveNarrative(spot.finding, game)}</p> : null;
        })}
        {!game.flags.some((entry) => entry.startsWith("night:watch:")) ? <p>まだ記録はありません。客の途切れた時間に店内を見回せます。</p> : null}
      </details>
    </section>
  );
}

export function PresentEvidencePanel({ game, encounter, onNightAction }: NightInteractionProps & { encounter: AuthoredEncounter }) {
  const links = presentableEvidence(game, encounter);
  const shown = presentedEvidence(game, encounter.id);
  const [selected, setSelected] = useState("");
  const link = links.find((entry) => entry.newsId === (shown ?? selected)) ?? links[0];
  if (!link || !onNightAction) return null;
  const article = getTask5NewsArticle(link.newsId);
  const enabled = game.phase.kind === "encounter" && game.phase.subPhase === "decision";
  return (
    <details className={styles.evidenceOffer}>
      <summary>保存した仮説を見せる（{links.length}件）</summary>
      <label className={styles.field}>提示する仮説
        <select value={link.newsId} disabled={Boolean(shown)} onChange={(event) => setSelected(event.target.value)}>
          {links.map((entry) => <option key={entry.newsId} value={entry.newsId}>{getTask5NewsArticle(entry.newsId).headline}</option>)}
        </select>
      </label>
      <p>保存通知：{article.notificationHeadline}</p>
      <p>現在の記事：{article.headline}</p>
      <ReceiptRecord event={link.event} game={game} />
      {shown ? <p className={styles.reply} role="status">{evidenceReply(game, encounter.id)}</p> : <button type="button" className={styles.pin} disabled={!enabled}
        onClick={() => onNightAction({ type: "PRESENT_EVIDENCE", newsId: link.newsId })}>この記録を見せる</button>}
    </details>
  );
}
