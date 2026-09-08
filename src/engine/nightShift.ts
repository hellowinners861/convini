import type { DomainEvent, GameState, Outcome } from "../domain";
import { COUNTER_MOMENTS, NIGHT_COPY, NIGHT_EPILOGUES, NIGHT_FLAGS, QUIET_NIGHTS } from "../content/nightShift";
import { TASK4_ENCOUNTERS } from "../content/encounters";
import { TASK5_NEWS } from "../content/news";
import { revenueEffects } from "../content/config/outcomes";
import type { AuthoredEncounter, ResultCopy } from "../content/types";
import { applyEffects } from "./effects";

const CHOICE_PREFIX = "night:choice:";
const EVIDENCE_PREFIX = "night:evidence:";
const SHOWN_PREFIX = "night:shown:";

export type NightAction =
  | { type: "CHOOSE_COUNTER_MOMENT"; momentId: string; choiceId: string }
  | { type: "INSPECT_NIGHT"; spotId: string }
  | { type: "PIN_EVIDENCE"; newsId: string; eventId: string }
  | { type: "PRESENT_EVIDENCE"; newsId: string };

export function selectedCounterChoice(game: GameState, momentId: string) {
  const moment = COUNTER_MOMENTS.find((entry) => entry.id === momentId);
  return moment?.choices.find((choice) => game.flags.includes(`${CHOICE_PREFIX}${momentId}:${choice.id}`));
}

export function counterMoment(game: GameState, encounterId: string) {
  return COUNTER_MOMENTS.find((entry) => entry.encounterId === encounterId &&
    (!entry.requiresFlag || game.flags.includes(entry.requiresFlag)));
}

export function inspectedSpot(game: GameState, day = game.day) {
  return QUIET_NIGHTS[day].spots.find((spot) => game.flags.includes(`night:watch:${day}:${spot.id}`));
}

export function powerAvailable(game: GameState): boolean {
  return !game.flags.includes(NIGHT_FLAGS.powerMew) && !game.flags.includes(NIGHT_FLAGS.powerHospital);
}

export function recommendationUnavailable(game: GameState, encounterId: string, itemId: string): string | null {
  if (encounterId !== "d3_mew_return" || itemId !== "mobile_power_bank") return null;
  if (!powerAvailable(game)) return "売り切れ";
  if (game.flags.includes(NIGHT_FLAGS.reserved)) return "宮下さま取り置き中";
  return null;
}

export interface EvidenceLink {
  newsId: string;
  encounterId: string;
  event: DomainEvent;
}

export function evidenceLinks(game: GameState): EvidenceLink[] {
  return game.flags.filter((value) => value.startsWith(EVIDENCE_PREFIX)).flatMap((value) => {
    const [newsId, encounterId] = value.slice(EVIDENCE_PREFIX.length).split(":");
    const event = game.eventLog.find((entry) => entry.type === "encounter.decision" && entry.data.encounterId === encounterId);
    return event && game.readNews.includes(newsId) ? [{ newsId, encounterId, event }] : [];
  });
}

export function presentableEvidence(game: GameState, encounter: AuthoredEncounter): EvidenceLink[] {
  return evidenceLinks(game).filter((link) => {
    const news = TASK5_NEWS.find((article) => article.id === link.newsId);
    return news && news.day < game.day &&
      (link.event.data.customerId === encounter.customerId || encounter.customerId === "ren");
  });
}

export function presentedEvidence(game: GameState, encounterId: string): string | undefined {
  const prefix = `${SHOWN_PREFIX}${encounterId}:`;
  return game.flags.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export function evidenceIsCorroborated(link: EvidenceLink): boolean {
  const { newsId, event } = link;
  if (event.data.decision === "refuse") return false;
  return (newsId === "news_d2_direct_hako3_self_repair" && event.data.encounterId === "d2_hako3_first" && event.data.recommendedItemId === "precision_screwdriver") ||
    (newsId === "news_d1_direct_hotaru_boundary" && event.data.encounterId === "d1_hotaru_first" && event.data.recommendedItemId === "purifying_salt") ||
    (newsId === "news_d1_direct_fallback" && event.data.encounterId === "d1_hayakawa_first");
}

export function evidenceReply(game: GameState, encounterId: string): string | null {
  const newsId = presentedEvidence(game, encounterId);
  const link = evidenceLinks(game).find((entry) => entry.newsId === newsId);
  return link ? (evidenceIsCorroborated(link) ? NIGHT_COPY.evidenceConfirmed : NIGHT_COPY.evidenceUncertain) : null;
}

/** Optional discoveries use the existing append-only flags, so V1 saves remain readable. */
export function applyNightAction(game: GameState, action: NightAction): GameState {
  if (action.type === "INSPECT_NIGHT") {
    const quiet = game.phase.kind === "briefing" ||
      (game.phase.kind === "encounter" && game.phase.subPhase === "result");
    const spot = QUIET_NIGHTS[game.day].spots.find((entry) => entry.id === action.spotId);
    if (!quiet || !spot || inspectedSpot(game)) return game;
    return applyEffects(game, [{ kind: "setFlag", id: `night:watch:${game.day}:${spot.id}` }]);
  }

  if (action.type === "PIN_EVIDENCE") {
    const news = TASK5_NEWS.find((entry) => entry.id === action.newsId);
    const event = game.eventLog.find((entry) => entry.id === action.eventId && entry.type === "encounter.decision");
    if (game.phase.kind !== "news" || !news || !event || !game.readNews.includes(news.id) || event.day > news.day) return game;
    const prefix = `${EVIDENCE_PREFIX}${news.id}:`;
    const nextFlag = `${prefix}${event.data.encounterId}`;
    // A presented hypothesis is durable history; later edits cannot rewrite the conversation.
    if (game.flags.includes(nextFlag) || game.flags.some((entry) => entry.startsWith(SHOWN_PREFIX) && entry.endsWith(`:${news.id}`))) return game;
    return { ...game, flags: [...game.flags.filter((value) => !value.startsWith(prefix)), nextFlag] };
  }

  if (game.phase.kind !== "encounter" || game.phase.subPhase !== "decision") return game;
  const encounter = TASK4_ENCOUNTERS.find((entry) => entry.id === (game.phase.kind === "encounter" ? game.phase.encounterId : ""));
  if (!encounter) return game;

  if (action.type === "PRESENT_EVIDENCE") {
    const link = presentableEvidence(game, encounter).find((entry) => entry.newsId === action.newsId);
    if (!link || presentedEvidence(game, encounter.id)) return game;
    return applyEffects(game, [
      { kind: "setFlag", id: `${SHOWN_PREFIX}${encounter.id}:${action.newsId}` },
      ...(evidenceIsCorroborated(link) ? [{ kind: "add" as const, target: "awareness" as const, amount: 1 }] : []),
    ]);
  }

  const moment = counterMoment(game, encounter.id);
  const choice = moment?.choices.find((entry) => entry.id === action.choiceId);
  if (!moment || moment.id !== action.momentId || !choice || selectedCounterChoice(game, moment.id)) return game;
  if (moment.id === "hospital-power" && choice.id === "deliver" && !powerAvailable(game)) return game;
  return applyEffects(game, [
    { kind: "setFlag", id: `${CHOICE_PREFIX}${moment.id}:${choice.id}` },
    ...(choice.effects ?? []),
  ]);
}

export function nightRecommendationOutcomeId(encounterId: string, itemId: string): string | null {
  if (encounterId !== "d3_hako3_return") return null;
  return itemId === "precision_screwdriver" ? "night_hako3_hospital_repair" :
    itemId === "shojo_manga" ? "night_hako3_hospital_wait" : null;
}

export function nightRecommendationOutcome(game: GameState, encounterId: string, itemId: string): Outcome | null {
  const id = nightRecommendationOutcomeId(encounterId, itemId);
  if (!id || !game.flags.includes(NIGHT_FLAGS.repair)) return null;
  const repaired = itemId === "precision_screwdriver";
  return {
    id,
    effects: [
      ...revenueEffects(480 + (repaired ? 980 : 520)),
      { kind: "add", target: "world.machine", amount: 1 },
      { kind: "add", target: "stability", amount: repaired ? 2 : -1 },
      { kind: "setCustomerState", customerId: "hako3", state: "empathetic" },
      ...(repaired ? [{ kind: "setFlag" as const, id: NIGHT_FLAGS.repaired }] : []),
    ],
  };
}

export function applyNightSale(game: GameState, encounterId: string, decision: string, itemId?: string): GameState {
  const moment = counterMoment(game, encounterId);
  const choice = moment ? selectedCounterChoice(game, moment.id) : undefined;
  if (decision === "refuse") {
    return encounterId === "d4_miyashita_triage" && game.flags.includes(NIGHT_FLAGS.reserved) ? applyEffects(game, [{ kind: "setFlag", id: NIGHT_FLAGS.released }]) : game;
  }
  const blockedBySalt = moment?.id === "ghost-bag" && itemId === "purifying_salt";
  let next = applyEffects(game, blockedBySalt ? [] : choice?.saleEffects ?? []);
  if (encounterId === "d3_mew_return" && decision === "recommend" && itemId === "mobile_power_bank") {
    next = applyEffects(next, [{ kind: "setFlag", id: NIGHT_FLAGS.powerMew }]);
  }
  if (encounterId === "d4_miyashita_triage" && choice?.id === "deliver" && powerAvailable(game)) {
    next = applyEffects(next, [
      ...revenueEffects(1980), { kind: "setFlag", id: NIGHT_FLAGS.powerHospital },
      { kind: "add", target: "stability", amount: 1 },
    ]);
  }
  return next;
}

export function nightResultCopy(outcomeId: string): ResultCopy | null {
  if (outcomeId === "night_hako3_hospital_repair") return {
    result: NIGHT_COPY.repairResult, receipt: NIGHT_COPY.repairReceipt, readback: NIGHT_COPY.repairReadback,
  };
  if (outcomeId === "night_hako3_hospital_wait") return {
    result: NIGHT_COPY.repairMangaResult, receipt: "自我対応乾電池 / 少女漫画 / 薬品冷蔵庫の修理は保留", readback: NIGHT_COPY.repairMangaReadback,
  };
  return null;
}

export function nightReceiptNotes(game: GameState, encounterId: string, decision: string): string[] {
  const notes: string[] = [];
  const moment = counterMoment(game, encounterId);
  const choice = moment ? selectedCounterChoice(game, moment.id) : undefined;
  if (decision !== "refuse" && choice?.receipt) {
    const sealed = encounterId === "d1_hotaru_first" && game.customerStates.hotaru === "sealed";
    notes.push(sealed ? "袋は渡した。でも、盛り塩の境目を越えて外へ出ることはできなかった。" : choice.receipt);
  }
  if (encounterId === "d4_miyashita_triage") {
    if (decision === "refuse" && game.flags.includes(NIGHT_FLAGS.reserved)) notes.push(NIGHT_COPY.powerRefused);
    else if (game.flags.includes(NIGHT_FLAGS.powerHospital)) notes.push(NIGHT_COPY.powerDelivered);
  }
  return notes;
}

export function nightEncounterLines(game: GameState, encounterId: string): string[] {
  const lines: string[] = [];
  if (encounterId === "d3_hako3_return" && game.flags.includes(NIGHT_FLAGS.repair)) lines.push(NIGHT_COPY.repairIntro);
  if (encounterId === "d3_hotaru_return" && game.flags.includes(NIGHT_FLAGS.bag)) lines.push(NIGHT_COPY.bagEcho);
  if (encounterId === "d4_hayakawa_coworkers" && game.flags.includes(NIGHT_FLAGS.heated)) lines.push(NIGHT_COPY.heatedEcho);
  if (encounterId === "d4_ren_human_anchor" || encounterId === "d5_ren_photo") {
    if (game.flags.includes(NIGHT_FLAGS.nameKept)) lines.push(NIGHT_COPY.nameKeptEcho);
    else if (game.flags.includes(NIGHT_FLAGS.nameLost)) lines.push(NIGHT_COPY.nameLostEcho);
  }
  if (encounterId === "d4_miyashita_triage" && game.flags.includes(NIGHT_FLAGS.powerMew)) lines.push(NIGHT_COPY.powerGone);
  if (encounterId === "d4_hako3_network" && game.flags.includes(NIGHT_FLAGS.repaired)) lines.push("HAKO-3は修理完了の伝票を置いた。「薬品冷蔵庫、再稼働。昨夜のドライバーは、病院に預けました」");
  if (encounterId === "d4_mew_arrivals") lines.push("二便目の配送が到着し、モバイル電源が再入荷した。宮下はもう病棟へ出発している。");
  return lines;
}

export function nightEpilogues(game: GameState) {
  return NIGHT_EPILOGUES.filter((entry) => game.flags.includes(entry.flag));
}
