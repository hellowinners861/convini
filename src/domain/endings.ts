import {
  ENDING_IDS,
  ENDING_TITLES,
  MIXUP_AXIS_THRESHOLD,
  MIXUP_MAX_AXIS_DIFFERENCE,
  MIXUP_MAX_STABILITY,
} from "./constants";
import type { Condition, EndingDefinition } from "./types";

const numeric = (
  reference: "leadingValue" | "secondValue" | "axisDifference" | "strongAxisCount" | "stability",
  operator: "gte" | "lte" | "gt" | "eq",
  value: number,
): Condition => ({ numeric: { reference, operator, value } });

const inventoryMixupCondition: Condition = {
  any: [
    {
      all: [
        numeric("leadingValue", "gte", MIXUP_AXIS_THRESHOLD),
        numeric("secondValue", "gte", MIXUP_AXIS_THRESHOLD),
        numeric("axisDifference", "lte", MIXUP_MAX_AXIS_DIFFERENCE),
        numeric("stability", "lte", MIXUP_MAX_STABILITY),
      ],
    },
    {
      all: [
        { flag: { id: "convergence_refused" } },
        numeric("strongAxisCount", "gte", 3),
      ],
    },
  ],
};

export const ENDING_RULES: EndingDefinition[] = [
  {
    id: ENDING_IDS[4],
    title: ENDING_TITLES.inventory_mixup,
    priority: 300,
    condition: inventoryMixupCondition,
  },
  {
    id: ENDING_IDS[0],
    title: ENDING_TITLES.undead_dawnless_city,
    priority: 100,
    condition: { leadingAxis: { axis: "undead" } },
  },
  {
    id: ENDING_IDS[1],
    title: ENDING_TITLES.fully_automated_business,
    priority: 100,
    condition: { leadingAxis: { axis: "machine" } },
  },
  {
    id: ENDING_IDS[2],
    title: ENDING_TITLES.final_departure,
    priority: 100,
    condition: { leadingAxis: { axis: "cosmic" } },
  },
  {
    id: ENDING_IDS[3],
    title: ENDING_TITLES.city_whole_beyond,
    priority: 100,
    condition: { leadingAxis: { axis: "spirit" } },
  },
  {
    id: ENDING_IDS[4],
    title: ENDING_TITLES.inventory_mixup,
    priority: 0,
    condition: { true: true },
    isFallback: true,
  },
];
