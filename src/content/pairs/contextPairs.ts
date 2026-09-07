import type { RecommendationPair, WorldAxis } from "../../domain";
import { CONNECTION_FLAGS } from "../connections";
import { coexistReplacementPairOutcome } from "../config/outcomes";
import { TASK4_ABNORMAL_ITEMS } from "../items/abnormal";

function price(id: string): number {
  const item = TASK4_ABNORMAL_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing contextual recommendation item: ${id}`);
  return item.price;
}

const specifications = [
  { id: "pair_hako3_hospital_repair", customer: "hako3", axis: "machine", day: 3,
    requested: "self_aware_battery", recommended: "precision_screwdriver", state: "empathetic",
    question: CONNECTION_FLAGS.repairQuestion, consequence: CONNECTION_FLAGS.delivery },
  { id: "pair_mew_hospital_rescue", customer: "mew", axis: "cosmic", day: 4,
    requested: "zero_gravity_cup_noodles", recommended: "mobile_power_bank", state: "visitor",
    question: CONNECTION_FLAGS.rescueQuestion, consequence: CONNECTION_FLAGS.rescue },
  { id: "pair_hotaru_family_boundary", customer: "hotaru", axis: "spirit", day: 4,
    requested: "returning_soul_incense", recommended: "purifying_salt", state: "remembered",
    question: CONNECTION_FLAGS.boundaryQuestion, consequence: CONNECTION_FLAGS.boundary },
] as const;

export const CONTEXT_RECOMMENDATION_PAIRS: RecommendationPair[] = specifications.map((spec) => ({
  id: spec.id,
  customerId: spec.customer,
  requestedItemId: spec.requested,
  recommendedItemId: spec.recommended,
  conditions: { all: [
    { numeric: { reference: "day", operator: "eq", value: spec.day } },
    { flag: { id: spec.question } },
  ] },
  priority: 200,
  mode: "replace-base-sale",
  outcome: coexistReplacementPairOutcome(
    `${spec.id}-outcome`, spec.axis as WorldAxis, price(spec.requested), price(spec.recommended), [
      { kind: "setCustomerState", customerId: spec.customer, state: spec.state },
      { kind: "setFlag", id: spec.consequence },
    ],
  ),
}));

export const CONTEXT_RESULT_COPY: Record<string, { result: string; readback: string }> = {
  "pair_hako3_hospital_repair-outcome": {
    result: "車輪だけを直す約束を確かめ、精密ドライバーを渡した。",
    readback: "HAKO-3は判断の回路には触れず、車輪のねじだけを締め直した。「病院へ向かいます。一箱、まだ間に合います」",
  },
  "pair_mew_hospital_rescue-outcome": {
    result: "モバイル電源を渡し、病院の屋上へ救助艇だけを呼ぶ連絡を手伝った。",
    readback: "ミューは母船の通信を切り、二枚の紙の住所を読み上げた。「迎えに行く人数を、病院の方に聞いておいてください」",
  },
  "pair_hotaru_family_boundary-outcome": {
    result: "ほたるを閉じ込めず、家の外に境界を引くための盛り塩を渡した。",
    readback: "「蓮に、名前を呼んで待っていてって伝えて」ほたるは自分が線の内側に立つことを確かめ、塩を大切に抱えた。",
  },
};
