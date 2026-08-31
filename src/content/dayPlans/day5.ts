import type { AuthoredDayPlan, Day5ConvergenceMetadata } from "../types";
import { TASK4_DAILY_REVENUE_TARGETS } from "../config/game";
import { TASK4_DAILY_PRESENTATIONS } from "../config/presentation";

export const TASK4_DAY5_CONVERGENCE: Day5ConvergenceMetadata = {
  day: 5,
  finalQueueIndex: 5,
  successfulSaleAxisBonus: 2,
  refusalStabilityDelta: -2,
  refusalFlagId: "convergence_refused",
};

export const TASK4_DAY5_PLAN: AuthoredDayPlan = {
  day: 5,
  slots: [
    { id: "slot_d5_miyashita", candidates: [], fallbackEncounterId: "d5_miyashita_convergence" },
    { id: "slot_d5_undead", candidates: [], fallbackEncounterId: "d5_hayakawa_final" },
    { id: "slot_d5_machine", candidates: [], fallbackEncounterId: "d5_hako3_final" },
    { id: "slot_d5_cosmic", candidates: [], fallbackEncounterId: "d5_mew_final" },
    { id: "slot_d5_ren", candidates: [], fallbackEncounterId: "d5_ren_photo" },
    { id: "slot_d5_spirit", candidates: [], fallbackEncounterId: "d5_hotaru_final" },
  ],
  day5AnomalyOrder: [
    {
      slotId: "slot_d5_undead",
      customerId: "hayakawa",
      axis: "undead",
      unresolvedness: 0,
      lastAffectedAxis: "undead",
    },
    {
      slotId: "slot_d5_machine",
      customerId: "hako3",
      axis: "machine",
      unresolvedness: 0,
      lastAffectedAxis: "machine",
    },
    {
      slotId: "slot_d5_cosmic",
      customerId: "mew",
      axis: "cosmic",
      unresolvedness: 0,
      lastAffectedAxis: "cosmic",
    },
    {
      slotId: "slot_d5_spirit",
      customerId: "hotaru",
      axis: "spirit",
      unresolvedness: 0,
      lastAffectedAxis: "spirit",
    },
  ],
  revenueTarget: TASK4_DAILY_REVENUE_TARGETS[5],
  presentation: TASK4_DAILY_PRESENTATIONS[4],
};
