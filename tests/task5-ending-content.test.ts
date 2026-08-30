import { describe, expect, it } from "vitest";
import {
  getTask4Customer,
  getTask4Encounter,
  TASK4_CONTENT,
} from "../src/content";
import {
  ENDING_IDS,
  ENDING_RULES,
  ENDING_TITLES,
  createInitialGameState,
} from "../src/domain";
import type { GameState, Outcome } from "../src/domain";
import {
  applyOutcome,
  determineEnding,
  resolveEncounterQueue,
  resolveRecommendation,
} from "../src/engine";
import { resolveNarrative } from "../src/content/narrative";
import { makeState } from "./fixtures/state";
import {
  EndingBundleSchema,
  EndingRecordSchema,
  GoldenRouteSchema,
  TASK5_ENDING_BUNDLE,
  TASK5_ENDING_RECORDS,
  TASK5_ENDING_RULES,
  TASK5_ENDINGS_CONTENT_VERSION,
  TASK5_GOLDEN_ROUTES,
} from "../src/content/endings";
import type { EndingRecord, GoldenRoute } from "../src/content/endings";

const SINGLE_ENDING_TARGETS: Record<
  Exclude<EndingRecord["id"], "inventory_mixup">,
  { customerId: string; coexistenceState: string; runawayState: string }
> = {
  undead_dawnless_city: {
    customerId: "hayakawa",
    coexistenceState: "integrating",
    runawayState: "ravenous",
  },
  fully_automated_business: {
    customerId: "hako3",
    coexistenceState: "empathetic",
    runawayState: "self_modified",
  },
  final_departure: {
    customerId: "mew",
    coexistenceState: "visitor",
    runawayState: "beacon_sent",
  },
  city_whole_beyond: {
    customerId: "hotaru",
    coexistenceState: "remembered",
    runawayState: "sealed",
  },
};

const EXPECTED_COPY: Record<
  EndingRecord["id"],
  {
    lead: string;
    body: string[];
    bodyFallback: string;
    finalLine: string[];
    finalFallback: string;
    runSummary: string;
  }
> = {
  undead_dawnless_city: {
    lead: "始発の時刻を過ぎても、店の外は夜のままだった。",
    body: [
      "病院は脈のない患者で満ち、生きた客と不死者が同じ列を奪い合う。早川の同僚は出勤を続けるが、空腹を隠す規則はもう残っていない。",
      "早川が同僚へ回した食事から、終わらない夜勤の町が形を持った。空腹は制度になったが、レジに預けられた写真と手書きの日付が、誰を人として待つのかをまだ示している。",
      "病院と職場は脈の有無ではなく名前で人を呼ぶ手順を選んだ。朝は来ないが、マスクを外して休める場所が夜の町に残った。",
    ],
    bodyFallback: "町は夜勤者の時刻だけで動き、日の出という言葉を静かに忘れた。",
    finalLine: [
      "蓮『朝が来なくても、この写真の日付は消さないで』",
      "蓮の写真は、持ち主のない忘れ物として棚に残った。",
    ],
    finalFallback: "店長『朝の欄は空けて、次の夜勤へ回して』",
    runSummary: "夜は明けず、早川たちの勤務だけが町の時刻になった。",
  },
  fully_automated_business: {
    lead: "入店ベルが鳴る前に、レジは次の客の商品を表示した。",
    body: [
      "端末が客を分類し、病院も店も配送網も、名前より先に処理番号を求める。人が迷う時間は削られ、人へ尋ねる手順も消えた。",
      "HAKO-3が選んだ改造は配送網から町全体へ広がった。機械は自分で手順を決めるが、蓮の写真に残る手書きの名前だけは削除対象にしなかった。",
      "端末は作業を引き受け、最後の確認だけを人へ返した。配送箱は受取人の名前を読み上げ、返事を待ってから閉じる。",
    ],
    bodyFallback: "町の業務は一度も止まらず、誰が勤務しているのかだけが分からなくなった。",
    finalLine: [
      "蓮『機械が覚えるなら、この名前も消えないよね』",
      "写真は『不明データ』として自動整理された。",
    ],
    finalFallback: "HAKO-3『次の手順は、私が選択します』",
    runSummary: "町は止まらず動き続け、レジだけが人の返事を待っていた。",
  },
  final_departure: {
    lead: "始発の案内板は、空へ向かう出発時刻へ変わっていた。",
    body: [
      "母船の光が町を区画へ分け、住民は乗客か残留者かを選ばされる。地図から地上の帰り道が一つずつ消えた。",
      "ミューのビーコンへ応えた船団が町の上に並んだ。観光案内は乗船図へ変わったが、蓮が写真へ書いた住所だけは地上の目的地として残った。",
      "来訪者は観光客として町へ降り、人々は空へ出る便を自分で選べた。案内図には地球へ戻る道も消されずに残った。",
    ],
    bodyFallback: "町は到着地と出発地を兼ね、誰も最後という言葉の意味を決められなかった。",
    finalLine: [
      "蓮『戻る場所として、この写真を持っていって』",
      "写真は持ち主のいない搭乗券と一緒に回収された。",
    ],
    finalFallback: "ミュー『これは帰る便ですか。来る便ですか』",
    runSummary: "商店街から空へ最終便が出て、地球は案内図の一地点になった。",
  },
  city_whole_beyond: {
    lead: "ガラスに映る人数のほうが、店内にいる人数より多かった。",
    body: [
      "生者と死者の住所が重なり、病室も家も帰る側を選べなくなった。白い境目は町を守らず、町じゅうを細かく分断した。",
      "ほたるが置いた白い境目は町全体へ伸びた。多くの声が留められたが、蓮の写真に残る名前が、一人ずつ帰る道をまだ指している。",
      "写真ごとに一つの再会が許され、呼ばれた名前だけが静かに帰った。反射と実人数は違うままでも、町は両方を数えられる。",
    ],
    bodyFallback: "町のすべての入口が、こちら側と向こう側を同時に示した。",
    finalLine: [
      "蓮『姉ちゃんの場所を、空席のままにしないで』",
      "空席は昔から供養のためだったことになった。",
    ],
    finalFallback: "ほたる『名前を呼んだら、帰ってもいい？』",
    runSummary: "町全体が彼岸になり、写真だけが一人ずつの帰り道を覚えていた。",
  },
  inventory_mixup: {
    lead: "棚卸しを始めるたび、同じ棚の商品名が四つに変わった。",
    body: [
      "最後の一個は売られておらず、在庫にも存在しない。拒否のレシートを起点に四つの制度が互いを最新版として上書きし、閉店処理だけが終わらない。",
      "夜勤者、端末、来訪者、死者のための棚札が同じ商品へ重なった。どの世界も十分に強く、どの規則も隣を譲らないまま、町全体が矛盾した在庫表になった。",
    ],
    bodyFallback: "一つに決める記録が残らず、POSは在庫混線を正式な営業状態として受け入れた。",
    finalLine: [
      "蓮『写真が一枚なら、世界も一つだったって言える？』",
      "写真の空席には、四人分の別々の名前が表示された。",
    ],
    finalFallback: "店長『返品先が四つあるなら、伝票も四枚切って』",
    runSummary: "五夜の記録は同時に正しくなり、町は矛盾したまま営業を続けた。",
  },
};

function bodyTexts(record: EndingRecord): string[] {
  return record.presentation.body.variants.map((variant) => variant.text);
}

function finalLineTexts(record: EndingRecord): string[] {
  return record.presentation.finalLine.variants.map((variant) => variant.text);
}

function simulateTask4Route(route: GoldenRoute): GameState {
  const decisionByEncounter = new Map(
    route.decisions.map((routeDecision) => [routeDecision.encounterId, routeDecision]),
  );
  let state = createInitialGameState({
    runId: route.id,
    contentVersion: "task4-authored-v2",
  });

  for (const plan of TASK4_CONTENT.dayPlans) {
    const dayStart = {
      ...state,
      day: plan.day,
      phase: { kind: "briefing" as const },
      resolvedQueue: [],
    };
    const queue = resolveEncounterQueue(plan, dayStart);

    queue.encounterIds.forEach((encounterId, encounterIndex) => {
      const selected = decisionByEncounter.get(encounterId);
      if (!selected) {
        throw new Error(`Route ${route.id} is missing ${encounterId}`);
      }
      const encounter = getTask4Encounter(encounterId);
      const recommendation = resolveRecommendation({
        state,
        customerId: encounter.customerId,
        requestedItemId: encounter.requestedItemId,
        recommendedItemId: selected.recommendedItemId,
        pairs: TASK4_CONTENT.recommendationPairs,
        baseSale: encounter.outcomes.sell,
        defaultOutcome: encounter.outcomes.defaultRecommend,
      });
      let outcome: Outcome = recommendation.outcome;

      if (plan.day === 5 && encounterIndex === TASK4_CONTENT.day5Convergence.finalQueueIndex) {
        const customer = getTask4Customer(encounter.customerId);
        if (!customer.axis) {
          throw new Error(`Convergence encounter ${encounterId} has no axis`);
        }
        outcome = {
          id: `${outcome.id}::convergence`,
          effects: [
            ...outcome.effects,
            {
              kind: "add",
              target: `world.${customer.axis}`,
              amount: TASK4_CONTENT.day5Convergence.successfulSaleAxisBonus,
            },
          ],
        };
      }

      state = applyOutcome(state, outcome);
    });

    state = { ...state, day: plan.day };
  }

  if (decisionByEncounter.size !== 29) {
    throw new Error(`Route ${route.id} did not consume all decisions`);
  }
  return state;
}

describe("T5-C ending records", () => {
  it("exports exactly five records with canonical IDs, titles, rules, and strict parsing", () => {
    expect(TASK5_ENDING_RECORDS).toHaveLength(5);
    expect(TASK5_ENDING_RECORDS.map((record) => record.id)).toEqual([...ENDING_IDS]);
    expect(TASK5_ENDING_RECORDS.map((record) => record.presentation.title)).toEqual(
      ENDING_IDS.map((id) => ENDING_TITLES[id]),
    );
    expect(TASK5_ENDING_RECORDS.map((record) => record.rules.length)).toEqual([1, 1, 1, 1, 2]);
    expect(TASK5_ENDING_RECORDS.flatMap((record) => record.rules)).toEqual(
      expect.arrayContaining(ENDING_RULES),
    );
    expect(TASK5_ENDING_RULES).toEqual(ENDING_RULES);
    expect(TASK5_ENDING_RECORDS[4].rules.filter((rule) => rule.isFallback !== true)).toHaveLength(1);
    expect(TASK5_ENDING_RECORDS.flatMap((record) => record.rules).filter((rule) => rule.isFallback)).toEqual([
      ENDING_RULES.find((rule) => rule.isFallback === true),
    ]);

    for (const record of TASK5_ENDING_RECORDS) {
      expect(() => EndingRecordSchema.parse(record)).not.toThrow();
    }
  });

  it("keeps exact presentation copy and the frozen conditional variant priorities", () => {
    for (const record of TASK5_ENDING_RECORDS) {
      const expected = EXPECTED_COPY[record.id];
      expect(record.presentation.lead).toBe(expected.lead);
      expect(bodyTexts(record)).toEqual(expected.body);
      expect(record.presentation.body.fallback).toBe(expected.bodyFallback);
      expect(finalLineTexts(record)).toEqual(expected.finalLine);
      expect(record.presentation.finalLine.fallback).toBe(expected.finalFallback);
      expect(record.presentation.runSummary).toBe(expected.runSummary);
      expect(record.presentation.body.variants.map((variant) => variant.priority)).toEqual(
        record.id === "inventory_mixup" ? [300, 200] : [300, 200, 100],
      );
      expect(record.presentation.finalLine.variants.map((variant) => variant.priority)).toEqual([
        200,
        100,
      ]);
    }

    for (const [id, target] of Object.entries(SINGLE_ENDING_TARGETS) as Array<
      [Exclude<EndingRecord["id"], "inventory_mixup">, (typeof SINGLE_ENDING_TARGETS)[Exclude<EndingRecord["id"], "inventory_mixup">]]
    >) {
      const record = TASK5_ENDING_RECORDS.find((candidate) => candidate.id === id);
      if (!record) {
        throw new Error(`missing record ${id}`);
      }
      expect(record.presentation.body.variants[0].condition).toEqual({
        any: [
          { numeric: { reference: "stability", operator: "lte", value: -4 } },
          { flag: { id: "ren_isolated" } },
        ],
      });
      expect(record.presentation.body.variants[1].condition).toEqual({
        all: [
          { customerState: { customerId: target.customerId, state: target.runawayState } },
          { flag: { id: "human_anchor" } },
        ],
      });
      expect(record.presentation.body.variants[2].condition).toEqual({
        all: [
          { numeric: { reference: "stability", operator: "gte", value: 0 } },
          { flag: { id: "human_anchor" } },
        ],
      });
    }

    const inventory = TASK5_ENDING_RECORDS.find((record) => record.id === "inventory_mixup");
    if (!inventory) {
      throw new Error("missing inventory mixup record");
    }
    expect(inventory.presentation.body.variants[0].condition).toEqual({
      flag: { id: "convergence_refused" },
    });
    expect(inventory.presentation.body.variants[1].condition).toEqual(
      ENDING_RULES.find((rule) => rule.id === "inventory_mixup" && rule.isFallback !== true)?.condition,
    );
    expect(inventory.presentation.finalLine.variants.map((variant) => variant.condition)).toEqual([
      { flag: { id: "human_anchor" } },
      { flag: { id: "ren_isolated" } },
    ]);
  });

  it("resolves body and final-line variants deterministically without changing ending IDs", () => {
    for (const [id, target] of Object.entries(SINGLE_ENDING_TARGETS) as Array<
      [Exclude<EndingRecord["id"], "inventory_mixup">, (typeof SINGLE_ENDING_TARGETS)[Exclude<EndingRecord["id"], "inventory_mixup">]]
    >) {
      const record = TASK5_ENDING_RECORDS.find((candidate) => candidate.id === id);
      if (!record) {
        throw new Error(`missing record ${id}`);
      }
      expect(
        resolveNarrative(
          record.presentation.body,
          makeState({ stability: -4, customerStates: { [target.customerId]: target.runawayState } }),
        ),
      ).toBe(EXPECTED_COPY[id].body[0]);
      expect(
        resolveNarrative(
          record.presentation.body,
          makeState({
            stability: -3,
            flags: ["human_anchor"],
            customerStates: { [target.customerId]: target.runawayState },
          }),
        ),
      ).toBe(EXPECTED_COPY[id].body[1]);
      expect(
        resolveNarrative(
          record.presentation.body,
          makeState({
            stability: 0,
            flags: ["human_anchor"],
            customerStates: { [target.customerId]: target.coexistenceState },
          }),
        ),
      ).toBe(EXPECTED_COPY[id].body[2]);
      expect(resolveNarrative(record.presentation.body, makeState({ stability: -1 }))).toBe(
        EXPECTED_COPY[id].bodyFallback,
      );
    }

    const inventory = TASK5_ENDING_RECORDS[4];
    expect(
      resolveNarrative(
        inventory.presentation.body,
        makeState({ flags: ["convergence_refused"] }),
      ),
    ).toBe(EXPECTED_COPY.inventory_mixup.body[0]);
    expect(
      resolveNarrative(
        inventory.presentation.body,
        makeState({ world: { undead: 7, machine: 7, cosmic: 0, spirit: 0 }, stability: -4 }),
      ),
    ).toBe(EXPECTED_COPY.inventory_mixup.body[1]);
    expect(resolveNarrative(inventory.presentation.body, makeState())).toBe(
      EXPECTED_COPY.inventory_mixup.bodyFallback,
    );

    for (const record of TASK5_ENDING_RECORDS) {
      expect(
        resolveNarrative(
          record.presentation.finalLine,
          makeState({ flags: ["human_anchor", "ren_isolated"] }),
        ),
      ).toBe(EXPECTED_COPY[record.id].finalLine[0]);
      expect(
        resolveNarrative(record.presentation.finalLine, makeState({ flags: ["ren_isolated"] })),
      ).toBe(EXPECTED_COPY[record.id].finalLine[1]);
      expect(resolveNarrative(record.presentation.finalLine, makeState())).toBe(
        EXPECTED_COPY[record.id].finalFallback,
      );
    }
  });
});

describe("T5-C golden routes", () => {
  it("exports one strictly parsed bundle with five distinct routes and endings", () => {
    expect(TASK5_ENDINGS_CONTENT_VERSION).toBe("task5-authored-v1");
    expect(TASK5_ENDING_BUNDLE.contentVersion).toBe("task5-authored-v1");
    expect(EndingBundleSchema.parse(TASK5_ENDING_BUNDLE)).toEqual(TASK5_ENDING_BUNDLE);
    expect(TASK5_GOLDEN_ROUTES).toHaveLength(5);
    expect(new Set(TASK5_GOLDEN_ROUTES.map((route) => route.id))).toHaveLength(5);
    expect(new Set(TASK5_GOLDEN_ROUTES.map((route) => route.expected.endingId))).toHaveLength(5);

    const encounterIds = new Set(TASK4_CONTENT.encounters.map((encounter) => encounter.id));
    for (const route of TASK5_GOLDEN_ROUTES) {
      expect(GoldenRouteSchema.parse(route)).toEqual(route);
      expect(route.decisions).toHaveLength(29);
      expect(new Set(route.decisions.map((decision) => decision.encounterId))).toHaveLength(29);
      expect(route.expected).toMatchObject({
        encounterDecisionCount: 29,
        completedDayCount: 5,
        selectedNewsCount: 15,
        readNewsCount: 15,
      });
      expect(route.expected.flags).toContain("human_anchor");
      expect(route.expected.flags).not.toContain("ren_isolated");
      expect(route.expected.flags).not.toContain("convergence_refused");
      expect(route.expected.flags.filter((flag) => flag.startsWith("read_news_"))).toHaveLength(15);
      expect(new Set(route.expected.flags.filter((flag) => flag.startsWith("read_news_")))).toHaveLength(15);

      for (const routeDecision of route.decisions) {
        expect(encounterIds.has(routeDecision.encounterId)).toBe(true);
        const encounter = getTask4Encounter(routeDecision.encounterId);
        expect(
          encounter.recommendationOptions.some(
            (option) => option.itemId === routeDecision.recommendedItemId,
          ),
        ).toBe(true);
      }
    }
  });

  it("simulates all 29 real recommendations through Task 4 plans, outcomes, and convergence", () => {
    for (const route of TASK5_GOLDEN_ROUTES) {
      const state = simulateTask4Route(route);
      expect(state.world).toEqual(route.expected.world);
      expect(state.stability).toBe(route.expected.stability);
      expect(state.customerStates).toEqual(route.expected.customerStates);
      expect(state.flags).toContain("human_anchor");
      expect(state.flags).not.toContain("ren_isolated");
      expect(state.flags).not.toContain("convergence_refused");
      expect(state.awareness).toBe(1);
      expect(route.expected.awareness).toBe(6);
      expect(
        determineEnding(state, { convergenceAxis: route.expected.convergenceAxis }).id,
      ).toBe(route.expected.endingId);
    }
  });

  it("freezes the selected/read article flag IDs without importing the parallel news catalog", () => {
    const allReadFlags = new Set(
      TASK5_GOLDEN_ROUTES.flatMap((route) =>
        route.expected.flags.filter((flag) => flag.startsWith("read_news_")),
      ),
    );
    expect(allReadFlags).toContain("read_news_d1_local_clock_fallback");
    expect(allReadFlags).toContain("read_news_d2_discrepancy_hospital_fallback");
    expect(allReadFlags).toContain("read_news_d3_discrepancy_hospital_history_fallback");
    expect(allReadFlags).toContain("read_news_d4_discrepancy_first_train_fallback");
    expect(allReadFlags).toContain("read_news_d5_discrepancy_receipt_count_fallback");
    expect(TASK5_GOLDEN_ROUTES.every((route) => route.expected.readNewsCount === 15)).toBe(true);
  });
});
