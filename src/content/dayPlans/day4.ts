import type { AuthoredDayPlan } from "../types";
import { TASK4_DAILY_REVENUE_TARGETS } from "../config/game";
import { TASK4_DAILY_PRESENTATIONS } from "../config/presentation";

export const TASK4_DAY4_PLAN: AuthoredDayPlan = {
  day: 4,
  slots: [
    { id: "slot_d4_01", candidates: [], fallbackEncounterId: "d4_miyashita_triage" },
    { id: "slot_d4_02", candidates: [], fallbackEncounterId: "d4_hayakawa_coworkers" },
    { id: "slot_d4_03", candidates: [], fallbackEncounterId: "d4_hako3_network" },
    { id: "slot_d4_04", candidates: [], fallbackEncounterId: "d4_mew_arrivals" },
    { id: "slot_d4_05", candidates: [], fallbackEncounterId: "d4_hotaru_town_dead" },
    { id: "slot_d4_06", candidates: [], fallbackEncounterId: "d4_ren_human_anchor" },
  ],
  revenueTarget: TASK4_DAILY_REVENUE_TARGETS[4],
  presentation: TASK4_DAILY_PRESENTATIONS[3],
};
