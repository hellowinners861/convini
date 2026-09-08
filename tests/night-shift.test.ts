import { describe, expect, it } from "vitest";
import { gameReducer, initialAppState, restoreAppStateFromRun, validateRunForResume, type AppAction, type AppState } from "../src/app/gameController";
import { getTask5Encounter, TASK5_CONTENT_VERSION } from "../src/content";
import { COUNTER_MOMENTS, NIGHT_FLAGS, QUIET_NIGHTS } from "../src/content/nightShift";
import { CONNECTION_FLAGS } from "../src/content/connections";
import { EffectSchema } from "../src/domain";
import { counterMoment, evidenceLinks, evidenceReply, inspectedSpot, nightEncounterLines, nightEpilogues, nightReceiptNotes, powerAvailable, recommendationUnavailable } from "../src/engine/nightShift";

const step = gameReducer;
function start() {
  return step(initialAppState, { type: "START_NEW_RUN", runId: "night-test", contentVersion: TASK5_CONTENT_VERSION });
}
function game(state: AppState) {
  if (!state.game) throw new Error("Missing run");
  return state.game;
}
function choice(state: AppState, momentId: string, choiceId: string) {
  return step(state, { type: "CHOOSE_COUNTER_MOMENT", momentId, choiceId });
}
function tick(state: AppState): AppState {
  if (state.view === "briefing") return step(state, { type: "BEGIN_DAY" });
  if (state.view === "encounter") {
    const phase = game(state).phase;
    if (phase.kind !== "encounter") throw new Error("Unexpected phase");
    return step(state, { type: phase.subPhase === "intro" ? "SCAN_ENCOUNTER" : phase.subPhase === "decision" ? "SELL" : "NEXT_ENCOUNTER" });
  }
  if (state.view === "shiftSummary") return step(state, { type: "OPEN_NEWS" });
  if (state.view === "news") {
    const unread = game(state).newsSelections.find((entry) => entry.day === game(state).day && !game(state).readNews.includes(entry.newsId));
    return step(state, unread ? { type: "READ_NEWS", newsId: unread.newsId } : { type: "ADVANCE_DAY" });
  }
  return state;
}
function until(state: AppState, predicate: (state: AppState) => boolean) {
  for (let index = 0; index < 160; index += 1) {
    if (predicate(state)) return state;
    const next = tick(state);
    if (next === state) throw new Error(`Stuck in ${state.view}`);
    state = next;
  }
  throw new Error("Route exceeded limit");
}
function at(encounterId: string, state = start()) {
  return until(state, (value) => {
    const phase = game(value).phase;
    return phase.kind === "encounter" && phase.subPhase === "decision" && phase.encounterId === encounterId;
  });
}
function dayOneNews() {
  return until(start(), (value) => value.view === "news" && game(value).readNews.length === 3);
}

describe("night-shift authored interactions", () => {
  it("references real encounters, validates effects, and supplies 15 distinct observations", () => {
    expect(new Set(COUNTER_MOMENTS.map((entry) => entry.id)).size).toBe(COUNTER_MOMENTS.length);
    for (const moment of COUNTER_MOMENTS) {
      expect(getTask5Encounter(moment.encounterId)).toBeTruthy();
      expect(new Set(moment.choices.map((entry) => entry.id)).size).toBe(moment.choices.length);
      for (const option of moment.choices) for (const effect of [...(option.effects ?? []), ...(option.saleEffects ?? [])]) expect(EffectSchema.safeParse(effect).success).toBe(true);
    }
    expect(Object.values(QUIET_NIGHTS).flatMap((night) => night.spots)).toHaveLength(15);
  });

  it("allows one observation in quiet time and preserves it through save/resume", () => {
    const state = step(start(), { type: "INSPECT_NIGHT", spotId: "camera" });
    expect(inspectedSpot(game(state))?.id).toBe("camera");
    expect(step(state, { type: "INSPECT_NIGHT", spotId: "window" })).toBe(state);
    expect(validateRunForResume(game(state))).toBe(true);
    expect(restoreAppStateFromRun(game(state))?.game?.flags).toEqual(game(state).flags);
    const serving = at("d1_taxi_baseline");
    expect(step(serving, { type: "INSPECT_NIGHT", spotId: "shelf" })).toBe(serving);
    const left = step(serving, { type: "SELL" });
    expect(inspectedSpot(game(step(left, { type: "INSPECT_NIGHT", spotId: "shelf" })))?.id).toBe("shelf");
  });

  it("applies a bag only when handed over; salt still prevents a ghost from leaving", () => {
    const prepared = choice(at("d1_hotaru_first"), "ghost-bag", "bag");
    expect(game(prepared).flags).not.toContain(NIGHT_FLAGS.bag);
    const sold = step(prepared, { type: "SELL" });
    expect(game(sold).flags).toContain(NIGHT_FLAGS.bag);
    expect(game(step(prepared, { type: "REFUSE" })).flags).not.toContain(NIGHT_FLAGS.bag);
    const sealed = step(prepared, { type: "RECOMMEND", recommendedItemId: "purifying_salt" });
    expect(game(sealed).flags).not.toContain(NIGHT_FLAGS.bag);
    expect(nightReceiptNotes(game(sealed), "d1_hotaru_first", "recommend")[0]).toContain("境目を越えて");
    expect(nightEncounterLines(game(at("d3_hotaru_return", sold)), "d3_hotaru_return")[0]).toContain("交差点");
  });

  it("rejects early, unrelated, repeated and post-sale counter choices", () => {
    const intro = until(start(), (value) => game(value).phase.kind === "encounter" && (game(value).phase as { encounterId: string }).encounterId === "d1_hotaru_first");
    expect(choice(intro, "ghost-bag", "bag")).toBe(intro);
    const ready = step(intro, { type: "SCAN_ENCOUNTER" });
    expect(choice(ready, "name-promise", "promise")).toBe(ready);
    expect(choice(ready, "ghost-bag", "invalid")).toBe(ready);
    const chosen = choice(ready, "ghost-bag", "bag");
    expect(choice(chosen, "ghost-bag", "hand")).toBe(chosen);
    const sold = step(chosen, { type: "SELL" });
    expect(choice(sold, "ghost-bag", "hand")).toBe(sold);
    expect(step(sold, { type: "SELL" })).toBe(sold);
  });

  it("returns the consequence of heating in a later customer visit", () => {
    const warm = step(choice(at("d2_hayakawa_return"), "warm-onigiri", "warm"), { type: "SELL" });
    const cold = step(choice(at("d2_hayakawa_return"), "warm-onigiri", "cold"), { type: "SELL" });
    expect(game(warm).stability).toBe(game(cold).stability - 2);
    expect(nightEncounterLines(game(at("d4_hayakawa_coworkers", warm)), "d4_hayakawa_coworkers").join()).toContain("同僚");
  });

  it.each(["precision_screwdriver", "shojo_manga"])("changes %s by purpose and resumes its authored result", (itemId) => {
    const base = at("d3_hako3_return");
    const asked = choice(base, "repair-purpose", "ask");
    const result = step(asked, { type: "RECOMMEND", recommendedItemId: itemId });
    expect(result.result?.outcomeId).toBe(itemId === "precision_screwdriver" ? "night_hako3_hospital_repair" : "night_hako3_hospital_wait");
    expect(game(result).stability - game(base).stability).toBe(itemId === "precision_screwdriver" ? 2 : -1);
    expect(game(result).flags.includes(NIGHT_FLAGS.repaired)).toBe(itemId === "precision_screwdriver");
    expect(validateRunForResume(game(result))).toBe(true);
    expect(restoreAppStateFromRun(game(result))?.result).toEqual(result.result);
    const legacy = step(base, { type: "RECOMMEND", recommendedItemId: itemId });
    expect(legacy.result?.outcomeId).not.toBe(result.result?.outcomeId);
  });

  it("reserves the last unit, enforces stock in the reducer, and charges exactly once on hospital handoff", () => {
    const reserved = choice(at("d3_mew_return"), "last-power", "reserve");
    expect(recommendationUnavailable(game(reserved), "d3_mew_return", "mobile_power_bank")).toContain("取り置き");
    expect(step(reserved, { type: "RECOMMEND", recommendedItemId: "mobile_power_bank" })).toBe(reserved);
    const hospital = at("d4_miyashita_triage", step(reserved, { type: "SELL" }));
    const prepared = choice(hospital, "hospital-power", "deliver");
    expect(game(prepared).revenue.total).toBe(game(hospital).revenue.total);
    const sold = step(prepared, { type: "SELL" });
    expect(game(sold).revenue.total - game(hospital).revenue.total).toBe(getTask5Encounter("d4_miyashita_triage").outcomes.sell.effects.filter((e) => e.kind === "add" && e.target === "revenue.total").reduce((n, e) => n + (e.kind === "add" ? e.amount : 0), 0) + 1980);
    expect(powerAvailable(game(sold))).toBe(false);
    expect(game(sold).flags).toContain(NIGHT_FLAGS.powerHospital);
    expect(step(sold, { type: "SELL" })).toBe(sold);
    expect(validateRunForResume(game(sold))).toBe(true);
    expect(nightEpilogues(game(sold)).some((entry) => entry.flag === NIGHT_FLAGS.powerHospital)).toBe(true);
  });

  it("cannot give the hospital a unit already sold to Mew; the later delivery restocks the shelf", () => {
    const sold = step(at("d3_mew_return"), { type: "RECOMMEND", recommendedItemId: "mobile_power_bank" });
    const hospital = at("d4_miyashita_triage", sold);
    expect(choice(hospital, "hospital-power", "deliver")).toBe(hospital);
    expect(nightEncounterLines(game(hospital), "d4_miyashita_triage").join()).toContain("販売済み");
    const later = at("d4_mew_arrivals", hospital);
    expect(recommendationUnavailable(game(later), "d4_mew_arrivals", "mobile_power_bank")).toBeNull();
    expect(step(later, { type: "RECOMMEND", recommendedItemId: "mobile_power_bank" }).result).toBeTruthy();
  });

  it("recognizes a sold unit in older V1 saves without the inventory flag", () => {
    const sold = step(at("d3_mew_return"), { type: "RECOMMEND", recommendedItemId: "mobile_power_bank" });
    const legacy = { ...game(sold), flags: game(sold).flags.filter((flag) => !flag.startsWith("night:")) };
    expect(validateRunForResume(legacy)).toBe(true);
    expect(powerAvailable(legacy)).toBe(false);
  });

  it("preserves the existing hospital delivery story when both repair promises are made", () => {
    let state = at("d2_hako3_first");
    state = step(state, { type: "RECOMMEND", recommendedItemId: "shojo_manga" });
    state = at("d3_hako3_return", state);
    state = step(state, { type: "ASK_QUESTION", questionId: CONNECTION_FLAGS.repairQuestion });
    expect(game(state).flags).toContain(CONNECTION_FLAGS.repairQuestion);
    state = choice(state, "repair-purpose", "ask");
    state = step(state, { type: "RECOMMEND", recommendedItemId: "precision_screwdriver" });
    expect(game(state).flags).toContain(CONNECTION_FLAGS.delivery);
    expect(game(state).flags).toContain(NIGHT_FLAGS.repaired);
    expect(validateRunForResume(game(state))).toBe(true);
  });

  it("does not deliver or charge for reserved power when the hospital sale is refused", () => {
    const reserved = choice(at("d3_mew_return"), "last-power", "reserve");
    const hospital = at("d4_miyashita_triage", step(reserved, { type: "REFUSE" }));
    const prepared = choice(hospital, "hospital-power", "deliver");
    const refused = step(prepared, { type: "REFUSE" });
    expect(game(refused).revenue.total).toBe(game(hospital).revenue.total);
    expect(game(refused).flags).not.toContain(NIGHT_FLAGS.powerHospital);
    expect(game(refused).flags).toContain(NIGHT_FLAGS.released);
  });

  it.each([["ren", NIGHT_FLAGS.nameKept], ["ritsu", NIGHT_FLAGS.nameLost]])("remembers the promise and the %s response through the ending", (name, flag) => {
    expect(counterMoment(game(at("d3_ren_evidence")), "d3_ren_evidence")).toBeUndefined();
    const promised = choice(at("d2_ren_spirit_echo"), "name-promise", "promise");
    const nextNight = at("d3_ren_evidence", step(promised, { type: "SELL" }));
    const answered = choice(nextNight, "remember-name", name);
    expect(game(answered).flags).toContain(flag);
    const ending = until(answered, (state) => state.view === "ending");
    expect(validateRunForResume(game(ending))).toBe(true);
    expect(nightEpilogues(game(ending)).some((entry) => entry.flag === flag)).toBe(true);
  });

  it("links only read news to real receipts, replaces an unshown hypothesis, and corroborates it with the customer", () => {
    const news = dayOneNews();
    const receipt = game(news).eventLog.find((entry) => entry.data.encounterId === "d1_hayakawa_first")!;
    const pin: AppAction = { type: "PIN_EVIDENCE", newsId: "news_d1_direct_fallback", eventId: receipt.id };
    expect(step(news, { ...pin, newsId: "news_d2_direct_fallback" })).toBe(news);
    expect(step(news, { ...pin, eventId: "fake" })).toBe(news);
    const wrong = step(news, { ...pin, eventId: game(news).eventLog[0].id });
    const linked = step(wrong, pin);
    expect(evidenceLinks(game(linked))).toHaveLength(1);
    expect(step(linked, pin)).toBe(linked);
    const customer = at("d2_hayakawa_return", linked);
    const action: AppAction = { type: "PRESENT_EVIDENCE", newsId: pin.newsId };
    const shown = step(customer, action);
    expect(game(shown).awareness).toBe(game(customer).awareness + 1);
    expect(evidenceReply(game(shown), "d2_hayakawa_return")).toContain("二人の記憶");
    expect(step(shown, action)).toBe(shown);
    expect(validateRunForResume(game(shown))).toBe(true);
    const tomorrowNews = until(shown, (state) => state.view === "news");
    expect(step(tomorrowNews, { ...pin, eventId: game(news).eventLog[0].id })).toBe(tomorrowNews);
  });

  it("leaves an unrelated hypothesis uncertain and does not grant recognition points", () => {
    const news = dayOneNews();
    const receipt = game(news).eventLog.find((entry) => entry.data.encounterId === "d1_hayakawa_first")!;
    const linked = step(news, { type: "PIN_EVIDENCE", newsId: "news_d1_local_clock_fallback", eventId: receipt.id });
    const customer = at("d2_hayakawa_return", linked);
    const shown = step(customer, { type: "PRESENT_EVIDENCE", newsId: "news_d1_local_clock_fallback" });
    expect(game(shown).awareness).toBe(game(customer).awareness);
    expect(evidenceReply(game(shown), "d2_hayakawa_return")).toContain("まだ分かりません");
  });
});
