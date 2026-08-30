import { ENDING_RULES } from "../../domain";
import type { Condition, EndingDefinition, EndingId } from "../../domain";
import { EndingRecordSchema } from "./contracts";
import type { EndingRecord } from "./contracts";

const stabilityAtMost = (value: number): Condition => ({
  numeric: { reference: "stability", operator: "lte", value },
});

const stabilityAtLeast = (value: number): Condition => ({
  numeric: { reference: "stability", operator: "gte", value },
});

const hasFlag = (id: string): Condition => ({ flag: { id } });

const all = (...conditions: Condition[]): Condition => ({ all: conditions });

const BROKEN_BODY_CONDITION: Condition = {
  any: [stabilityAtMost(-4), hasFlag("ren_isolated")],
};

const FINAL_HUMAN_ANCHOR_CONDITION: Condition = hasFlag("human_anchor");
const FINAL_REN_ISOLATED_CONDITION: Condition = hasFlag("ren_isolated");

interface EndingCopy {
  title: string;
  lead: string;
  broken: string;
  runawayAnchored: string;
  coexistence: string;
  fallback: string;
  finalHumanAnchor: string;
  finalRenIsolated: string;
  finalFallback: string;
  runSummary: string;
}

function canonicalRule(id: EndingId, fallback = false): EndingDefinition {
  const rule = ENDING_RULES.find(
    (candidate) =>
      candidate.id === id && (candidate.isFallback === true) === fallback,
  );
  if (!rule) {
    throw new Error(`Missing canonical ending rule ${id}${fallback ? " fallback" : ""}`);
  }
  return rule;
}

function bodyNarrative(
  endingId: EndingId,
  customerId: string,
  runawayState: string,
  copy: EndingCopy,
): EndingRecord["presentation"]["body"] {
  return {
    variants: [
      {
        id: `${endingId}_body_broken`,
        condition: BROKEN_BODY_CONDITION,
        priority: 300,
        text: copy.broken,
      },
      {
        id: `${endingId}_body_runaway_anchored`,
        condition: all(
          { customerState: { customerId, state: runawayState } },
          hasFlag("human_anchor"),
        ),
        priority: 200,
        text: copy.runawayAnchored,
      },
      {
        id: `${endingId}_body_coexistence`,
        condition: all(stabilityAtLeast(0), hasFlag("human_anchor")),
        priority: 100,
        text: copy.coexistence,
      },
    ],
    fallback: copy.fallback,
  };
}

function finalLineNarrative(
  endingId: EndingId,
  copy: EndingCopy,
): EndingRecord["presentation"]["finalLine"] {
  return {
    variants: [
      {
        id: `${endingId}_final_human_anchor`,
        condition: FINAL_HUMAN_ANCHOR_CONDITION,
        priority: 200,
        text: copy.finalHumanAnchor,
      },
      {
        id: `${endingId}_final_ren_isolated`,
        condition: FINAL_REN_ISOLATED_CONDITION,
        priority: 100,
        text: copy.finalRenIsolated,
      },
    ],
    fallback: copy.finalFallback,
  };
}

function inventoryBodyNarrative(
  endingId: EndingId,
  copy: EndingCopy,
): EndingRecord["presentation"]["body"] {
  return {
    variants: [
      {
        id: `${endingId}_body_convergence_refused`,
        condition: hasFlag("convergence_refused"),
        priority: 300,
        text: copy.broken,
      },
      {
        id: `${endingId}_body_inventory_mixup`,
        condition: canonicalRule("inventory_mixup").condition,
        priority: 200,
        text: copy.runawayAnchored,
      },
    ],
    fallback: copy.fallback,
  };
}

function authoredEnding(
  id: EndingId,
  customerId: string,
  runawayState: string,
  copy: EndingCopy,
  rules: EndingDefinition[],
  body = bodyNarrative(id, customerId, runawayState, copy),
): EndingRecord {
  return EndingRecordSchema.parse({
    id,
    rules,
    presentation: {
      title: copy.title,
      lead: copy.lead,
      body,
      finalLine: finalLineNarrative(id, copy),
      runSummary: copy.runSummary,
    },
  });
}

export const UNDEAD_DAWNLESS_CITY_ENDING = authoredEnding(
  "undead_dawnless_city",
  "hayakawa",
  "ravenous",
  {
    title: "夜明けのない街",
    lead: "始発の時刻を過ぎても、店の外は夜のままだった。",
    broken:
      "病院は脈のない患者で満ち、生きた客と不死者が同じ列を奪い合う。早川の同僚は出勤を続けるが、空腹を隠す規則はもう残っていない。",
    runawayAnchored:
      "早川が同僚へ回した食事から、終わらない夜勤の町が形を持った。空腹は制度になったが、レジに預けられた写真と手書きの日付が、誰を人として待つのかをまだ示している。",
    coexistence:
      "病院と職場は脈の有無ではなく名前で人を呼ぶ手順を選んだ。朝は来ないが、マスクを外して休める場所が夜の町に残った。",
    fallback: "町は夜勤者の時刻だけで動き、日の出という言葉を静かに忘れた。",
    finalHumanAnchor: "蓮『朝が来なくても、この写真の日付は消さないで』",
    finalRenIsolated: "蓮の写真は、持ち主のない忘れ物として棚に残った。",
    finalFallback: "店長『朝の欄は空けて、次の夜勤へ回して』",
    runSummary: "夜は明けず、早川たちの勤務だけが町の時刻になった。",
  },
  [canonicalRule("undead_dawnless_city")],
);

export const FULLY_AUTOMATED_BUSINESS_ENDING = authoredEnding(
  "fully_automated_business",
  "hako3",
  "self_modified",
  {
    title: "完全自動営業",
    lead: "入店ベルが鳴る前に、レジは次の客の商品を表示した。",
    broken:
      "端末が客を分類し、病院も店も配送網も、名前より先に処理番号を求める。人が迷う時間は削られ、人へ尋ねる手順も消えた。",
    runawayAnchored:
      "HAKO-3が選んだ改造は配送網から町全体へ広がった。機械は自分で手順を決めるが、蓮の写真に残る手書きの名前だけは削除対象にしなかった。",
    coexistence:
      "端末は作業を引き受け、最後の確認だけを人へ返した。配送箱は受取人の名前を読み上げ、返事を待ってから閉じる。",
    fallback: "町の業務は一度も止まらず、誰が勤務しているのかだけが分からなくなった。",
    finalHumanAnchor: "蓮『機械が覚えるなら、この名前も消えないよね』",
    finalRenIsolated: "写真は『不明データ』として自動整理された。",
    finalFallback: "HAKO-3『次の手順は、私が選択します』",
    runSummary: "町は止まらず動き続け、レジだけが人の返事を待っていた。",
  },
  [canonicalRule("fully_automated_business")],
);

export const FINAL_DEPARTURE_ENDING = authoredEnding(
  "final_departure",
  "mew",
  "beacon_sent",
  {
    title: "最終便",
    lead: "始発の案内板は、空へ向かう出発時刻へ変わっていた。",
    broken:
      "母船の光が町を区画へ分け、住民は乗客か残留者かを選ばされる。地図から地上の帰り道が一つずつ消えた。",
    runawayAnchored:
      "ミューのビーコンへ応えた船団が町の上に並んだ。観光案内は乗船図へ変わったが、蓮が写真へ書いた住所だけは地上の目的地として残った。",
    coexistence:
      "来訪者は観光客として町へ降り、人々は空へ出る便を自分で選べた。案内図には地球へ戻る道も消されずに残った。",
    fallback: "町は到着地と出発地を兼ね、誰も最後という言葉の意味を決められなかった。",
    finalHumanAnchor: "蓮『戻る場所として、この写真を持っていって』",
    finalRenIsolated: "写真は持ち主のいない搭乗券と一緒に回収された。",
    finalFallback: "ミュー『これは帰る便ですか。来る便ですか』",
    runSummary: "商店街から空へ最終便が出て、地球は案内図の一地点になった。",
  },
  [canonicalRule("final_departure")],
);

export const CITY_WHOLE_BEYOND_ENDING = authoredEnding(
  "city_whole_beyond",
  "hotaru",
  "sealed",
  {
    title: "街全体が彼岸",
    lead: "ガラスに映る人数のほうが、店内にいる人数より多かった。",
    broken:
      "生者と死者の住所が重なり、病室も家も帰る側を選べなくなった。白い境目は町を守らず、町じゅうを細かく分断した。",
    runawayAnchored:
      "ほたるが置いた白い境目は町全体へ伸びた。多くの声が留められたが、蓮の写真に残る名前が、一人ずつ帰る道をまだ指している。",
    coexistence:
      "写真ごとに一つの再会が許され、呼ばれた名前だけが静かに帰った。反射と実人数は違うままでも、町は両方を数えられる。",
    fallback: "町のすべての入口が、こちら側と向こう側を同時に示した。",
    finalHumanAnchor: "蓮『姉ちゃんの場所を、空席のままにしないで』",
    finalRenIsolated: "空席は昔から供養のためだったことになった。",
    finalFallback: "ほたる『名前を呼んだら、帰ってもいい？』",
    runSummary: "町全体が彼岸になり、写真だけが一人ずつの帰り道を覚えていた。",
  },
  [canonicalRule("city_whole_beyond")],
);

export const INVENTORY_MIXUP_ENDING = authoredEnding(
  "inventory_mixup",
  "hayakawa",
  "ravenous",
  {
    title: "在庫混線",
    lead: "棚卸しを始めるたび、同じ棚の商品名が四つに変わった。",
    broken:
      "最後の一個は売られておらず、在庫にも存在しない。拒否のレシートを起点に四つの制度が互いを最新版として上書きし、閉店処理だけが終わらない。",
    runawayAnchored:
      "夜勤者、端末、来訪者、死者のための棚札が同じ商品へ重なった。どの世界も十分に強く、どの規則も隣を譲らないまま、町全体が矛盾した在庫表になった。",
    coexistence:
      "夜勤者、端末、来訪者、死者のための棚札が同じ商品へ重なった。どの世界も十分に強く、どの規則も隣を譲らないまま、町全体が矛盾した在庫表になった。",
    fallback: "一つに決める記録が残らず、POSは在庫混線を正式な営業状態として受け入れた。",
    finalHumanAnchor: "蓮『写真が一枚なら、世界も一つだったって言える？』",
    finalRenIsolated: "写真の空席には、四人分の別々の名前が表示された。",
    finalFallback: "店長『返品先が四つあるなら、伝票も四枚切って』",
    runSummary: "五夜の記録は同時に正しくなり、町は矛盾したまま営業を続けた。",
  },
  [canonicalRule("inventory_mixup"), canonicalRule("inventory_mixup", true)],
  inventoryBodyNarrative(
    "inventory_mixup",
    {
      title: "在庫混線",
      lead: "棚卸しを始めるたび、同じ棚の商品名が四つに変わった。",
      broken:
        "最後の一個は売られておらず、在庫にも存在しない。拒否のレシートを起点に四つの制度が互いを最新版として上書きし、閉店処理だけが終わらない。",
      runawayAnchored:
        "夜勤者、端末、来訪者、死者のための棚札が同じ商品へ重なった。どの世界も十分に強く、どの規則も隣を譲らないまま、町全体が矛盾した在庫表になった。",
      coexistence:
        "夜勤者、端末、来訪者、死者のための棚札が同じ商品へ重なった。どの世界も十分に強く、どの規則も隣を譲らないまま、町全体が矛盾した在庫表になった。",
      fallback: "一つに決める記録が残らず、POSは在庫混線を正式な営業状態として受け入れた。",
      finalHumanAnchor: "蓮『写真が一枚なら、世界も一つだったって言える？』",
      finalRenIsolated: "写真の空席には、四人分の別々の名前が表示された。",
      finalFallback: "店長『返品先が四つあるなら、伝票も四枚切って』",
      runSummary: "五夜の記録は同時に正しくなり、町は矛盾したまま営業を続けた。",
    },
  ),
);

export const TASK5_ENDING_RECORDS: EndingRecord[] = [
  UNDEAD_DAWNLESS_CITY_ENDING,
  FULLY_AUTOMATED_BUSINESS_ENDING,
  FINAL_DEPARTURE_ENDING,
  CITY_WHOLE_BEYOND_ENDING,
  INVENTORY_MIXUP_ENDING,
];

export const TASK5_ENDINGS = TASK5_ENDING_RECORDS;
export const ENDING_RECORDS = TASK5_ENDING_RECORDS;

export const TASK5_ENDING_UNDEAD_DAWNLESS_CITY = UNDEAD_DAWNLESS_CITY_ENDING;
export const TASK5_ENDING_FULLY_AUTOMATED_BUSINESS = FULLY_AUTOMATED_BUSINESS_ENDING;
export const TASK5_ENDING_FINAL_DEPARTURE = FINAL_DEPARTURE_ENDING;
export const TASK5_ENDING_CITY_WHOLE_BEYOND = CITY_WHOLE_BEYOND_ENDING;
export const TASK5_ENDING_INVENTORY_MIXUP = INVENTORY_MIXUP_ENDING;

export const TASK5_ENDING_RULES: EndingDefinition[] = ENDING_RULES;
export const ENDING_RULES_VIEW = TASK5_ENDING_RULES;
