import { WORLD_AXES } from "../../domain";
import type { WorldAxis } from "../../domain";
import { GoldenRouteSchema } from "./contracts";
import type { GoldenRoute, GoldenRouteDecision } from "./contracts";

type AxisRouteTarget = WorldAxis;

const AXIS_CUSTOMERS: Record<WorldAxis, string> = {
  undead: "hayakawa",
  machine: "hako3",
  cosmic: "mew",
  spirit: "hotaru",
};

const COEXISTENCE_ITEMS: Record<WorldAxis, string> = {
  undead: "mask",
  machine: "shojo_manga",
  cosmic: "tourist_guide",
  spirit: "photo_print_ticket",
};

const RUNAWAY_ITEMS: Record<WorldAxis, string> = {
  undead: "counter_chicken",
  machine: "precision_screwdriver",
  cosmic: "mobile_power_bank",
  spirit: "purifying_salt",
};

const AXIS_ENCOUNTERS: Record<WorldAxis, readonly string[]> = {
  undead: [
    "d1_hayakawa_first",
    "d2_hayakawa_return",
    "d4_hayakawa_coworkers",
    "d5_hayakawa_final",
  ],
  machine: [
    "d2_hako3_first",
    "d3_hako3_return",
    "d4_hako3_network",
    "d5_hako3_final",
  ],
  cosmic: [
    "d2_mew_first",
    "d3_mew_return",
    "d4_mew_arrivals",
    "d5_mew_final",
  ],
  spirit: [
    "d1_hotaru_first",
    "d3_hotaru_return",
    "d4_hotaru_town_dead",
    "d5_hotaru_final",
  ],
};

const COMMON_DISCREPANCY_ARTICLES = [
  "local_clock_fallback",
  "discrepancy_hospital_fallback",
  "discrepancy_hospital_history_fallback",
  "discrepancy_first_train_fallback",
  "discrepancy_receipt_count_fallback",
] as const;

interface RouteNewsSpec {
  direct: readonly string[];
  trend: readonly string[];
}

const ROUTE_NEWS: Record<WorldAxis, RouteNewsSpec> = {
  undead: {
    direct: [
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
    ],
    trend: [
      "trend_undead_night",
      "trend_fallback",
      "trend_fallback",
      "trend_coexistence",
      "trend_undead",
    ],
  },
  machine: {
    direct: [
      "direct_fallback",
      "direct_hako3_self_repair",
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
    ],
    trend: [
      "trend_fallback",
      "trend_fallback",
      "trend_fallback",
      "trend_coexistence",
      "trend_machine",
    ],
  },
  cosmic: {
    direct: [
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
      "direct_fallback",
    ],
    trend: [
      "trend_fallback",
      "trend_cosmic_arrival",
      "trend_fallback",
      "trend_coexistence",
      "trend_cosmic",
    ],
  },
  spirit: {
    direct: [
      "direct_hotaru_boundary",
      "direct_fallback",
      "direct_hotaru_photo",
      "direct_fallback",
      "direct_fallback",
    ],
    trend: [
      "trend_fallback",
      "trend_fallback",
      "trend_fallback",
      "trend_coexistence",
      "trend_spirit",
    ],
  },
};

const ALL_RUNAWAY_NEWS: RouteNewsSpec = {
  direct: [
    "direct_hotaru_boundary",
    "direct_hako3_self_repair",
    "direct_hotaru_photo",
    "direct_four_systems",
    "direct_fallback",
  ],
  trend: [
    "trend_fallback",
    "trend_fallback",
    "trend_fallback",
    "trend_fallback",
    "trend_spirit",
  ],
};

function decision(encounterId: string, recommendedItemId: string): GoldenRouteDecision {
  return { encounterId, recommendedItemId };
}

function axisDecision(
  axis: WorldAxis,
  encounterId: string,
  target: AxisRouteTarget,
  allRunaway: boolean,
): GoldenRouteDecision {
  const runaway = allRunaway || axis === target;
  return decision(
    encounterId,
    runaway ? RUNAWAY_ITEMS[axis] : COEXISTENCE_ITEMS[axis],
  );
}

function dayOneDecisions(target: AxisRouteTarget, allRunaway: boolean): GoldenRouteDecision[] {
  return [
    decision("d1_taxi_baseline", "mint_gum"),
    decision("d1_miyashita_baseline", "black_coffee"),
    decision("d1_ren_only_child", "pencil"),
    axisDecision("undead", AXIS_ENCOUNTERS.undead[0], target, allRunaway),
    axisDecision("spirit", AXIS_ENCOUNTERS.spirit[0], target, allRunaway),
  ];
}

function dayTwoDecisions(target: AxisRouteTarget, allRunaway: boolean): GoldenRouteDecision[] {
  return [
    decision("d2_miyashita_undead_echo", "sandwich"),
    axisDecision("machine", AXIS_ENCOUNTERS.machine[0], target, allRunaway),
    decision("d2_construction_sales_rule", "work_gloves"),
    decision("d2_ren_spirit_echo", "pencil"),
    axisDecision("cosmic", AXIS_ENCOUNTERS.cosmic[0], target, allRunaway),
    axisDecision("undead", AXIS_ENCOUNTERS.undead[1], target, allRunaway),
  ];
}

function dayThreeDecisions(target: AxisRouteTarget, allRunaway: boolean): GoldenRouteDecision[] {
  return [
    decision("d3_elder_history", "black_coffee"),
    axisDecision("machine", AXIS_ENCOUNTERS.machine[1], target, allRunaway),
    axisDecision("spirit", AXIS_ENCOUNTERS.spirit[1], target, allRunaway),
    decision("d3_miyashita_four_wards", "sandwich"),
    axisDecision("cosmic", AXIS_ENCOUNTERS.cosmic[1], target, allRunaway),
    decision("d3_ren_evidence", "pencil"),
  ];
}

function dayFourDecisions(target: AxisRouteTarget, allRunaway: boolean): GoldenRouteDecision[] {
  return [
    decision("d4_miyashita_triage", "sandwich"),
    axisDecision("undead", AXIS_ENCOUNTERS.undead[2], target, allRunaway),
    axisDecision("machine", AXIS_ENCOUNTERS.machine[2], target, allRunaway),
    axisDecision("cosmic", AXIS_ENCOUNTERS.cosmic[2], target, allRunaway),
    axisDecision("spirit", AXIS_ENCOUNTERS.spirit[2], target, allRunaway),
    decision("d4_ren_human_anchor", "pencil"),
  ];
}

function dayFiveDecisions(target: AxisRouteTarget, allRunaway: boolean): GoldenRouteDecision[] {
  const weakToStrongAxes = WORLD_AXES.filter((axis) => axis !== target);
  return [
    decision("d5_miyashita_convergence", "sandwich"),
    ...weakToStrongAxes.map((axis) =>
      axisDecision(axis, AXIS_ENCOUNTERS[axis][3], target, allRunaway),
    ),
    decision("d5_ren_photo", "pencil"),
    axisDecision(target, AXIS_ENCOUNTERS[target][3], target, allRunaway),
  ];
}

function routeDecisions(target: AxisRouteTarget, allRunaway: boolean): GoldenRouteDecision[] {
  return [
    ...dayOneDecisions(target, allRunaway),
    ...dayTwoDecisions(target, allRunaway),
    ...dayThreeDecisions(target, allRunaway),
    ...dayFourDecisions(target, allRunaway),
    ...dayFiveDecisions(target, allRunaway),
  ];
}

function readFlag(day: number, articleId: string): string {
  return `read_news_d${day}_${articleId}`;
}

function newsFlags(target: AxisRouteTarget, allRunaway: boolean): string[] {
  const spec = allRunaway ? ALL_RUNAWAY_NEWS : ROUTE_NEWS[target];
  const flags: string[] = [];
  for (const [index, discrepancy] of COMMON_DISCREPANCY_ARTICLES.entries()) {
    const day = index + 1;
    flags.push(readFlag(day, spec.direct[index]));
    flags.push(readFlag(day, spec.trend[index]));
    flags.push(readFlag(day, discrepancy));
    if (day === 3) {
      flags.push("human_anchor");
    }
  }
  return flags;
}

const RUNAWAY_STATES: Record<WorldAxis, string> = {
  undead: "ravenous",
  machine: "self_modified",
  cosmic: "beacon_sent",
  spirit: "sealed",
};

const COEXISTENCE_STATES: Record<WorldAxis, string> = {
  undead: "integrating",
  machine: "empathetic",
  cosmic: "visitor",
  spirit: "remembered",
};

function customerStates(target: AxisRouteTarget, allRunaway: boolean): Record<string, string> {
  return Object.fromEntries(
    WORLD_AXES.map((axis) => [
      AXIS_CUSTOMERS[axis],
      allRunaway || axis === target ? RUNAWAY_STATES[axis] : COEXISTENCE_STATES[axis],
    ]),
  );
}

const EXPECTED_WORLDS: Record<string, Record<WorldAxis, number>> = {
  undead: { undead: 14, machine: 4, cosmic: 4, spirit: 4 },
  machine: { undead: 4, machine: 14, cosmic: 4, spirit: 4 },
  cosmic: { undead: 4, machine: 4, cosmic: 14, spirit: 4 },
  spirit: { undead: 4, machine: 4, cosmic: 4, spirit: 14 },
  all: { undead: 12, machine: 12, cosmic: 12, spirit: 14 },
};

function makeRoute(
  id: string,
  target: AxisRouteTarget,
  allRunaway: boolean,
): GoldenRoute {
  return GoldenRouteSchema.parse({
    id,
    decisions: routeDecisions(target, allRunaway),
    expected: {
      endingId:
        allRunaway
          ? "inventory_mixup"
          : target === "undead"
            ? "undead_dawnless_city"
            : target === "machine"
              ? "fully_automated_business"
              : target === "cosmic"
                ? "final_departure"
                : "city_whole_beyond",
      world: allRunaway ? EXPECTED_WORLDS.all : EXPECTED_WORLDS[target],
      stability: allRunaway ? -32 : 16,
      awareness: 6,
      convergenceAxis: allRunaway ? "spirit" : target,
      customerStates: customerStates(target, allRunaway),
      flags: newsFlags(target, allRunaway),
      encounterDecisionCount: 29,
      completedDayCount: 5,
      selectedNewsCount: 15,
      readNewsCount: 15,
    },
  });
}

export const ROUTE_UNDEAD_RUNAWAY = makeRoute("route_undead_runaway", "undead", false);
export const ROUTE_MACHINE_RUNAWAY = makeRoute("route_machine_runaway", "machine", false);
export const ROUTE_COSMIC_RUNAWAY = makeRoute("route_cosmic_runaway", "cosmic", false);
export const ROUTE_SPIRIT_RUNAWAY = makeRoute("route_spirit_runaway", "spirit", false);
export const ROUTE_INVENTORY_ALL_RUNAWAY = makeRoute(
  "route_inventory_all_runaway",
  "spirit",
  true,
);

export const TASK5_ROUTE_UNDEAD_RUNAWAY = ROUTE_UNDEAD_RUNAWAY;
export const TASK5_ROUTE_MACHINE_RUNAWAY = ROUTE_MACHINE_RUNAWAY;
export const TASK5_ROUTE_COSMIC_RUNAWAY = ROUTE_COSMIC_RUNAWAY;
export const TASK5_ROUTE_SPIRIT_RUNAWAY = ROUTE_SPIRIT_RUNAWAY;
export const TASK5_ROUTE_INVENTORY_ALL_RUNAWAY = ROUTE_INVENTORY_ALL_RUNAWAY;

export const TASK5_GOLDEN_ROUTES: GoldenRoute[] = [
  ROUTE_UNDEAD_RUNAWAY,
  ROUTE_MACHINE_RUNAWAY,
  ROUTE_COSMIC_RUNAWAY,
  ROUTE_SPIRIT_RUNAWAY,
  ROUTE_INVENTORY_ALL_RUNAWAY,
];

export const GOLDEN_ROUTES = TASK5_GOLDEN_ROUTES;
