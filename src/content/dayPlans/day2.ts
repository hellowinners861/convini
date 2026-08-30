import type { AuthoredDayPlan } from "../types";
import { TASK4_DAILY_REVENUE_TARGETS } from "../config/game";
import { TASK4_DAILY_PRESENTATIONS } from "../config/presentation";

export const TASK4_DAY2_PLAN: AuthoredDayPlan = {
  day: 2,
  slots: [
    { id: "slot_d2_01", candidates: [], fallbackEncounterId: "d2_miyashita_undead_echo" },
    { id: "slot_d2_02", candidates: [], fallbackEncounterId: "d2_hako3_first" },
    { id: "slot_d2_03", candidates: [], fallbackEncounterId: "d2_construction_sales_rule" },
    { id: "slot_d2_04", candidates: [], fallbackEncounterId: "d2_ren_spirit_echo" },
    { id: "slot_d2_05", candidates: [], fallbackEncounterId: "d2_mew_first" },
    { id: "slot_d2_06", candidates: [], fallbackEncounterId: "d2_hayakawa_return" },
  ],
  revenueTarget: TASK4_DAILY_REVENUE_TARGETS[2],
  presentation: TASK4_DAILY_PRESENTATIONS[1],
};
