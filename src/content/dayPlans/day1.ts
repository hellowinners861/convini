import type { AuthoredDayPlan } from "../types";
import { TASK4_DAILY_REVENUE_TARGETS } from "../config/game";
import { TASK4_DAILY_PRESENTATIONS } from "../config/presentation";

export const TASK4_DAY1_PLAN: AuthoredDayPlan = {
  day: 1,
  slots: [
    { id: "slot_d1_01", candidates: [], fallbackEncounterId: "d1_taxi_baseline" },
    { id: "slot_d1_02", candidates: [], fallbackEncounterId: "d1_miyashita_baseline" },
    { id: "slot_d1_03", candidates: [], fallbackEncounterId: "d1_ren_only_child" },
    { id: "slot_d1_04", candidates: [], fallbackEncounterId: "d1_hayakawa_first" },
    { id: "slot_d1_05", candidates: [], fallbackEncounterId: "d1_hotaru_first" },
  ],
  revenueTarget: TASK4_DAILY_REVENUE_TARGETS[1],
  presentation: TASK4_DAILY_PRESENTATIONS[0],
};
