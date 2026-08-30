import { RecommendationPairSchema, type Condition, type RecommendationPair, type WorldAxis } from "../../domain";
import { validateRecommendationPairs } from "../../engine";
import { TASK4_CUSTOMERS } from "../customers/catalog";
import { coexistReplacementPairOutcome, runawayReplacementPairOutcome } from "../config/outcomes";
import { TASK4_ABNORMAL_ITEMS } from "../items/abnormal";

type PairKind = "coexist" | "runaway";

interface AxisPairSpec {
  id: string;
  customerId: string;
  requestedItemId: string;
  recommendedItemId: string;
  kind: PairKind;
  customerState: string;
}

const ALWAYS: Condition = { true: true };

function requiredCustomer(customerId: string) {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer) {
    throw new Error(`Task 4 recommendation pair references missing customer ${customerId}`);
  }
  if (!customer.axis) {
    throw new Error(`Task 4 recommendation pair customer ${customerId} has no axis`);
  }
  return customer;
}

function requiredAbnormalItem(itemId: string) {
  const item = TASK4_ABNORMAL_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Task 4 recommendation pair references missing abnormal item ${itemId}`);
  }
  return item;
}

function axisForPair(
  spec: AxisPairSpec,
  customer: ReturnType<typeof requiredCustomer>,
  requestedItem: ReturnType<typeof requiredAbnormalItem>,
  recommendedItem: ReturnType<typeof requiredAbnormalItem>,
): WorldAxis {
  const axis = customer.axis;
  if (requestedItem.axis !== axis || recommendedItem.axis !== axis) {
    throw new Error(`Task 4 recommendation pair ${spec.id} crosses world axes`);
  }
  if (requestedItem.anomalyRole !== "base") {
    throw new Error(`Task 4 recommendation pair ${spec.id} must request a base item`);
  }
  if (recommendedItem.anomalyRole !== spec.kind) {
    throw new Error(`Task 4 recommendation pair ${spec.id} has the wrong recommendation role`);
  }
  return axis;
}

function buildPair(spec: AxisPairSpec): RecommendationPair {
  const customer = requiredCustomer(spec.customerId);
  const requestedItem = requiredAbnormalItem(spec.requestedItemId);
  const recommendedItem = requiredAbnormalItem(spec.recommendedItemId);
  const axis = axisForPair(spec, customer, requestedItem, recommendedItem);
  const stateEffect = [
    { kind: "setCustomerState" as const, customerId: customer.id, state: spec.customerState },
  ];
  const outcome =
    spec.kind === "coexist"
      ? coexistReplacementPairOutcome(
          `${spec.id}-outcome`,
          axis,
          requestedItem.price,
          recommendedItem.price,
          stateEffect,
        )
      : runawayReplacementPairOutcome(
          `${spec.id}-outcome`,
          axis,
          requestedItem.price,
          recommendedItem.price,
          stateEffect,
        );

  return {
    id: spec.id,
    customerId: customer.id,
    requestedItemId: requestedItem.id,
    recommendedItemId: recommendedItem.id,
    conditions: { ...ALWAYS },
    priority: 100,
    mode: "replace-base-sale",
    outcome,
  };
}

const AXIS_PAIR_SPECS: AxisPairSpec[] = [
  {
    id: "pair_hayakawa_mask",
    customerId: "hayakawa",
    requestedItemId: "raw_meat_onigiri",
    recommendedItemId: "mask",
    kind: "coexist",
    customerState: "integrating",
  },
  {
    id: "pair_hayakawa_counter_chicken",
    customerId: "hayakawa",
    requestedItemId: "raw_meat_onigiri",
    recommendedItemId: "counter_chicken",
    kind: "runaway",
    customerState: "ravenous",
  },
  {
    id: "pair_hako3_shojo_manga",
    customerId: "hako3",
    requestedItemId: "self_aware_battery",
    recommendedItemId: "shojo_manga",
    kind: "coexist",
    customerState: "empathetic",
  },
  {
    id: "pair_hako3_precision_screwdriver",
    customerId: "hako3",
    requestedItemId: "self_aware_battery",
    recommendedItemId: "precision_screwdriver",
    kind: "runaway",
    customerState: "self_modified",
  },
  {
    id: "pair_mew_tourist_guide",
    customerId: "mew",
    requestedItemId: "zero_gravity_cup_noodles",
    recommendedItemId: "tourist_guide",
    kind: "coexist",
    customerState: "visitor",
  },
  {
    id: "pair_mew_mobile_power_bank",
    customerId: "mew",
    requestedItemId: "zero_gravity_cup_noodles",
    recommendedItemId: "mobile_power_bank",
    kind: "runaway",
    customerState: "beacon_sent",
  },
  {
    id: "pair_hotaru_photo_print_ticket",
    customerId: "hotaru",
    requestedItemId: "returning_soul_incense",
    recommendedItemId: "photo_print_ticket",
    kind: "coexist",
    customerState: "remembered",
  },
  {
    id: "pair_hotaru_purifying_salt",
    customerId: "hotaru",
    requestedItemId: "returning_soul_incense",
    recommendedItemId: "purifying_salt",
    kind: "runaway",
    customerState: "sealed",
  },
];

export const TASK4_RECOMMENDATION_PAIRS: RecommendationPair[] = AXIS_PAIR_SPECS.map(buildPair);

for (const pair of TASK4_RECOMMENDATION_PAIRS) {
  RecommendationPairSchema.parse(pair);
}
validateRecommendationPairs(TASK4_RECOMMENDATION_PAIRS);
