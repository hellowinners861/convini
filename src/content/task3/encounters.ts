import type { Condition, EncounterSlot, Effect, Outcome, RecommendationPair } from "../../domain";
import type { FixtureEncounter, FixtureItem, FixtureRecommendation } from "./types";

const ALWAYS: Condition = { true: true };

const item = (id: string, name: string, description: string, price: number): FixtureItem => ({
  id,
  name,
  description,
  price,
});

const recommendation = (
  id: string,
  name: string,
  shortLabel: string,
  description: string,
  price: number,
): FixtureRecommendation => ({ id, name, shortLabel, description, price });

const revenueEffects = (amount: number): Effect[] => [
  { kind: "add", target: "revenue.total", amount },
  { kind: "add", target: "revenue.today", amount },
];

const addSale = (id: string, amount: number): Outcome => ({
  id: `${id}-sell`,
  effects: revenueEffects(amount),
});

const refuse = (id: string): Outcome => ({
  id: `${id}-refuse`,
  effects: [
    { kind: "add", target: "managerTrust", amount: -1 },
    { kind: "setFlag", id: `${id}-refused` },
  ],
});

const defaultRecommendation = (
  id: string,
  requestedPrice: number,
  recommendedPrice: number,
): Outcome => ({
  id: `${id}-default-recommendation`,
  effects: [
    ...revenueEffects(requestedPrice + recommendedPrice),
    { kind: "add", target: "awareness", amount: 1 },
  ],
});

const pair = (
  id: string,
  customerId: string,
  requestedItemId: string,
  recommendedItemId: string,
  mode: RecommendationPair["mode"],
  requestedPrice: number,
  recommendedPrice: number,
  effects: Effect[],
): RecommendationPair => ({
  id,
  customerId,
  requestedItemId,
  recommendedItemId,
  conditions: ALWAYS,
  priority: 10,
  mode,
  outcome: {
    id: `${id}-outcome`,
    effects: [
      ...revenueEffects(
        mode === "append-base-sale"
          ? recommendedPrice
          : requestedPrice + recommendedPrice,
      ),
      ...effects,
    ],
  },
});

const slot = (slotId: string, encounterId: string): EncounterSlot => ({
  id: slotId,
  candidates: [{ encounterId, conditions: ALWAYS, priority: 10 }],
  fallbackEncounterId: encounterId,
});

const fixture = (
  id: string,
  slotId: string,
  customerId: string,
  customerName: string,
  intro: string,
  scanText: string,
  requestedItem: FixtureItem,
  recommendations: FixtureRecommendation[],
  baseSale: Outcome,
  refuseOutcome: Outcome,
  defaultRecommendationOutcome: Outcome,
  recommendationPairs: RecommendationPair[],
  resultText: Record<"sell" | "refuse", string>,
  recommendationResultText: Record<string, string>,
  receiptLabel: string,
  readback: string,
): FixtureEncounter => ({
  id,
  slot: slot(slotId, id),
  customerId,
  customerName,
  intro,
  scanText,
  requestedItem,
  recommendations,
  baseSale,
  refuse: refuseOutcome,
  defaultRecommendation: defaultRecommendationOutcome,
  recommendationPairs,
  resultText,
  recommendationResultText,
  receiptLabel,
  readback,
});

const coffee = item("fixture-coffee", "黒コーヒー", "いつもの苦い一杯。", 180);
const sandwich = item("fixture-sandwich", "サンドイッチ", "包装の賞味期限は今夜。", 320);
const milk = item("fixture-milk", "牛乳", "紙パックの小さな牛乳。", 150);
const rawRiceBall = item("fixture-raw-rice-ball", "生肉おにぎり", "赤い具材が見える限定品。", 260);
const incense = item("fixture-soul-incense", "帰魂線香", "煙の説明だけが妙に長い。", 480);

export const TASK3_ENCOUNTERS: FixtureEncounter[] = [
  fixture(
    "task3-encounter-01",
    "task3-slot-01",
    "fixture-taxi",
    "夜勤タクシー運転手",
    "運転手はコーヒーとガムをカウンターへ置き、メーターのない夜の話をした。",
    "バーコードは一度で通った。画面には、見慣れた商品名が表示されている。",
    coffee,
    [recommendation("fixture-gum", "ミントガム", "ガム", "眠気覚まし用の小袋。", 120)],
    addSale("task3-encounter-01", coffee.price),
    refuse("task3-encounter-01"),
    defaultRecommendation("task3-encounter-01", coffee.price, 120),
    [
      pair(
        "task3-pair-01",
        "fixture-taxi",
        coffee.id,
        "fixture-gum",
        "append-base-sale",
        coffee.price,
        120,
        [
        { kind: "add", target: "stability", amount: 1 },
        ],
      ),
    ],
    { sell: "運転手はレシートを折り、次の信号まで眠らないと言った。", refuse: "運転手は時計を二度見して、店を出た。" },
    { "fixture-gum": "ガムを受け取った運転手は、少しだけ安心した顔をした。" },
    "COFFEE / NIGHT SHIFT",
    "レシートの余白に、到着時刻が印字されている。",
  ),
  fixture(
    "task3-encounter-02",
    "task3-slot-02",
    "fixture-nurse",
    "宮下",
    "看護師は黒コーヒーとサンドイッチを選び、病院の夜勤体制を淡々と説明した。",
    "サンドイッチの包装には、知らない病院名のシールが貼られている。",
    sandwich,
    [recommendation("fixture-thermos", "小さな保温ボトル", "保温ボトル", "夜勤用の簡易ボトル。", 260)],
    addSale("task3-encounter-02", sandwich.price),
    refuse("task3-encounter-02"),
    defaultRecommendation("task3-encounter-02", sandwich.price, 260),
    [
      pair(
        "task3-pair-02",
        "fixture-nurse",
        sandwich.id,
        "fixture-thermos",
        "replace-base-sale",
        sandwich.price,
        260,
        [
        { kind: "add", target: "awareness", amount: 1 },
        { kind: "setCustomerState", customerId: "fixture-nurse", state: "prepared" },
        ],
      ),
    ],
    { sell: "看護師は病院名を見て、知らないはずの住所を口にした。", refuse: "看護師は空腹を隠して、夜の交差点へ戻った。" },
    { "fixture-thermos": "保温ボトルを握り、看護師は朝までの勤務に戻った。" },
    "SANDWICH / HOSPITAL",
    "印字された病院名だけ、昨日の記憶と合わない。",
  ),
  fixture(
    "task3-encounter-03",
    "task3-slot-03",
    "fixture-student",
    "蓮",
    "高校生は牛乳と鉛筆を置き、家族写真の話を途中でやめた。",
    "牛乳のバーコード脇に、人数を数えるような小さな線がある。",
    milk,
    [recommendation("fixture-photo-print", "写真プリント券", "写真券", "店内端末で一枚だけ印刷できる。", 200)],
    addSale("task3-encounter-03", milk.price),
    refuse("task3-encounter-03"),
    defaultRecommendation("task3-encounter-03", milk.price, 200),
    [
      pair(
        "task3-pair-03",
        "fixture-student",
        milk.id,
        "fixture-photo-print",
        "append-base-sale",
        milk.price,
        200,
        [
        { kind: "add", target: "awareness", amount: 1 },
        { kind: "setFlag", id: "task3-photo-clue" },
        ],
      ),
    ],
    { sell: "蓮はレシートを受け取り、写真の中身を思い出そうとした。", refuse: "蓮は鉛筆だけを持って、明るい通りへ戻った。" },
    { "fixture-photo-print": "写真プリント券を見て、蓮は一人分多い椅子を思い出した。" },
    "MILK / ONE MORE CHAIR",
    "レシートには商品数しかなく、写真の人数は残らない。",
  ),
  fixture(
    "task3-encounter-04",
    "task3-slot-04",
    "fixture-office-worker",
    "早川",
    "青白い会社員は、生肉おにぎりを季節限定だと説明し、深く頭を下げた。",
    "POSは商品を受け付けた。小さな注意書きは、読む前に消えた。",
    rawRiceBall,
    [recommendation("fixture-mask", "マスク", "マスク", "個包装の白いマスク。", 140)],
    addSale("task3-encounter-04", rawRiceBall.price),
    refuse("task3-encounter-04"),
    defaultRecommendation("task3-encounter-04", rawRiceBall.price, 140),
    [
      pair(
        "task3-pair-04",
        "fixture-office-worker",
        rawRiceBall.id,
        "fixture-mask",
        "append-base-sale",
        rawRiceBall.price,
        140,
        [
        { kind: "add", target: "stability", amount: 1 },
        { kind: "setCustomerState", customerId: "fixture-office-worker", state: "socialized" },
        ],
      ),
    ],
    { sell: "早川はおにぎりをしまい、明日の出社時刻を確認した。", refuse: "早川は何も言わず、空腹を抱えて夜道へ消えた。" },
    { "fixture-mask": "マスクをつけた早川は、普通の会社員に見えた。" },
    "RAW RICE BALL / LIMITED",
    "商品名の下に、季節名ではない文字列が一瞬だけ見えた。",
  ),
  fixture(
    "task3-encounter-05",
    "task3-slot-05",
    "fixture-girl",
    "ほたる",
    "少女は帰魂線香を持っていた。入店音は鳴ったが、ドアは動かなかった。",
    "POSだけが正常に反応し、画面の反射に客が一人多く映った。",
    incense,
    [recommendation("fixture-salt", "盛り塩", "盛り塩", "小袋に入った白い塩。", 110)],
    addSale("task3-encounter-05", incense.price),
    refuse("task3-encounter-05"),
    defaultRecommendation("task3-encounter-05", incense.price, 110),
    [
      pair(
        "task3-pair-05",
        "fixture-girl",
        incense.id,
        "fixture-salt",
        "replace-base-sale",
        incense.price,
        110,
        [
        { kind: "add", target: "stability", amount: -1 },
        { kind: "setCustomerState", customerId: "fixture-girl", state: "waiting" },
        ],
      ),
    ],
    { sell: "少女は線香を受け取り、煙の向こうで誰かに手を振った。", refuse: "少女は反射の中だけで会釈をして、消えた。" },
    { "fixture-salt": "盛り塩を受け取った少女は、出口ではない方向を見た。" },
    "SOUL INCENSE / REFLECTION",
    "レシートの枚数は五枚。来店した客の数と一致している。",
  ),
];

export const TASK3_DAY1_SLOTS: EncounterSlot[] = TASK3_ENCOUNTERS.map((encounter) => encounter.slot);
