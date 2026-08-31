import type { AuthoredDayPlan } from "../types";
import { TASK4_DAILY_REVENUE_TARGETS } from "../config/game";
import { TASK4_DAILY_PRESENTATIONS } from "../config/presentation";

export const TASK4_DAY3_PLAN: AuthoredDayPlan = {
  day: 3,
  slots: [
    { id: "slot_d3_01", candidates: [], fallbackEncounterId: "d3_elder_history" },
    { id: "slot_d3_02", candidates: [], fallbackEncounterId: "d3_hako3_return" },
    { id: "slot_d3_03", candidates: [], fallbackEncounterId: "d3_hotaru_return" },
    { id: "slot_d3_04", candidates: [], fallbackEncounterId: "d3_miyashita_four_wards" },
    { id: "slot_d3_05", candidates: [], fallbackEncounterId: "d3_mew_return" },
    { id: "slot_d3_06", candidates: [], fallbackEncounterId: "d3_ren_evidence" },
  ],
  revenueTarget: TASK4_DAILY_REVENUE_TARGETS[3],
  presentation: TASK4_DAILY_PRESENTATIONS[2],
};
