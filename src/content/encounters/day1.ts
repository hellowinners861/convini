import type { WorldAxis } from "../../domain";
import { abnormalBaseSellOutcome, abnormalDefaultRecommendationOutcome, abnormalRefusalOutcome, ordinaryDefaultRecommendationOutcome, ordinaryRefusalOutcome, ordinarySaleOutcome } from "../config/outcomes";
import { TASK4_CUSTOMERS } from "../customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../items/ordinary";
import type { AuthoredEncounter, ItemDefinition, Narrative, RecommendationOption, ResultCopy } from "../types";

const TASK4_ITEMS: ItemDefinition[] = [...TASK4_ORDINARY_ITEMS, ...TASK4_ABNORMAL_ITEMS];

function itemById(itemId: string): ItemDefinition {
  const item = TASK4_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Task 4 Day 1 references missing item ${itemId}`);
  }
  return item;
}

function priceOf(itemId: string): number {
  return itemById(itemId).price;
}

function axisOf(customerId: string): WorldAxis {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer || customer.axis === undefined) {
    throw new Error(`Task 4 Day 1 requires an axis for ${customerId}`);
  }
  return customer.axis;
}

function copy(result: Narrative, readback: Narrative, receipt: Narrative): ResultCopy {
  return { result, readback, receipt };
}

function recommendationOption(
  encounterId: string,
  itemId: string,
  resultCopy: ResultCopy,
): RecommendationOption {
  const item = itemById(itemId);
  return {
    id: `${encounterId}_recommend_${itemId}`,
    itemId,
    label: item.name,
    description: item.description,
    resultCopy,
  };
}

const d1TaxiId = "d1_taxi_baseline";
const d1TaxiRecommendation = recommendationOption(
  d1TaxiId,
  "mint_gum",
  copy(
    "眠気覚ましに、ミントガムを一つすすめた。",
    "運転手はガムの小袋を受け取り、次の信号までなら持つと言った。",
    "黒コーヒー 180円 / ミントガム 120円",
  ),
);

const d1Taxi: AuthoredEncounter = {
  id: d1TaxiId,
  customerId: "taxi_driver",
  requestedItemId: "black_coffee",
  intro:
    "夜勤のタクシー運転手が黒コーヒーをカウンターへ置いた。信号の変わり目を気にしながら、短い休憩を取るらしい。",
  scan:
    "スキャンすると黒コーヒーの名前と180円が表示された。売る、断る、おすすめするの三つから一つを選び、レシートには時刻も残る。",
  recommendationOptions: [d1TaxiRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d1TaxiId}_sell`,
      priceOf("black_coffee"),
      copy(
        "黒コーヒーを渡した。",
        "運転手は時刻を確かめ、短い礼を言った。",
        "黒コーヒー　180円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d1TaxiId}_refuse`,
      copy(
        "黒コーヒーの販売を断った。",
        "運転手は時計を見て、店を出た。",
        "販売なし / 黒コーヒー",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d1TaxiId}_default_recommend`,
      priceOf("black_coffee"),
      priceOf("mint_gum"),
      copy(
        "黒コーヒーにミントガムを添えた。",
        "運転手はレシートの時刻を確かめ、ガムをポケットへしまった。",
        "黒コーヒー　180円 / ミントガム　120円",
      ),
    ),
  },
};

const d1MiyashitaId = "d1_miyashita_baseline";
const d1MiyashitaRecommendation = recommendationOption(
  d1MiyashitaId,
  "black_coffee",
  copy(
    "夜勤の合間に、黒コーヒーもすすめた。",
    "宮下は病院の休憩室で飲むと言い、サンドイッチを持ち直した。",
    "サンドイッチ 320円 / 黒コーヒー 180円",
  ),
);

const d1Miyashita: AuthoredEncounter = {
  id: d1MiyashitaId,
  customerId: "miyashita",
  requestedItemId: "sandwich",
  intro:
    "宮下千春はサンドイッチをカウンターへ置き、救急の夜勤がまだ続くと話した。病院へ戻る前の短い買い物らしい。",
  scan:
    "包装の日付は今日になっている。宮下は夜勤の休憩で食べると言い、病院の名前を確認してから画面を見た。",
  recommendationOptions: [d1MiyashitaRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d1MiyashitaId}_sell`,
      priceOf("sandwich"),
      copy(
        "サンドイッチを渡した。",
        "宮下は病院の休憩室の場所を思い浮かべ、夜勤へ戻ると言った。",
        "サンドイッチ　320円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d1MiyashitaId}_refuse`,
      copy(
        "サンドイッチの販売を断った。",
        "宮下は日付を一度見直し、何も買わずに病院へ戻った。",
        "販売なし / サンドイッチ",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d1MiyashitaId}_default_recommend`,
      priceOf("sandwich"),
      priceOf("black_coffee"),
      copy(
        "サンドイッチに黒コーヒーを添えた。",
        "宮下は二つを袋へ入れ、夜勤の休憩で落ち着いて食べると言った。",
        "サンドイッチ　320円 / 黒コーヒー　180円",
      ),
    ),
  },
};

const d1RenId = "d1_ren_only_child";
const d1RenRecommendation = recommendationOption(
  d1RenId,
  "pencil",
  copy(
    "家族写真へ書き込めるよう、鉛筆を一つすすめた。",
    "蓮は鉛筆を手にして、写真の裏へ日付を書いてみると言った。",
    "牛乳 210円 / 鉛筆 100円",
  ),
);

const d1Ren: AuthoredEncounter = {
  id: d1RenId,
  customerId: "ren",
  requestedItemId: "milk",
  intro:
    "高校生の蓮は牛乳をカウンターへ置き、家族写真の話をした。『うちは一人っ子だから』と、確かめるように言う。",
  scan:
    "牛乳のバーコードはすぐに通った。蓮のポケットから見える家族写真には、隣の一人分だけ白い余白が残っていた。",
  recommendationOptions: [d1RenRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d1RenId}_sell`,
      priceOf("milk"),
      copy(
        "牛乳を渡した。",
        "蓮は家族写真をしまい、明日の朝にもう一度見ると言った。",
        "牛乳　210円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d1RenId}_refuse`,
      copy(
        "牛乳の販売を断った。",
        "蓮は写真を折らないように持ち直し、明るい通りへ出ていった。",
        "販売なし / 牛乳",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d1RenId}_default_recommend`,
      priceOf("milk"),
      priceOf("pencil"),
      copy(
        "牛乳に鉛筆を添えた。",
        "蓮は写真の裏へ日付を書くために、鉛筆を大事そうにしまった。",
        "牛乳　210円 / 鉛筆　100円",
      ),
    ),
  },
};

const d1HayakawaId = "d1_hayakawa_first";
const d1HayakawaRecommendationMask = recommendationOption(
  d1HayakawaId,
  "mask",
  copy(
    "夜勤の人混みに備えて、マスクを一つすすめた。",
    "早川はマスクを受け取り、明日の出勤でも使えると言った。",
    "生肉おにぎり 260円 / マスク 140円",
  ),
);
const d1HayakawaRecommendationChicken = recommendationOption(
  d1HayakawaId,
  "counter_chicken",
  copy(
    "空腹を抑えるものとして、レジ横チキンを一つすすめた。",
    "早川はチキンの包みを見て、帰る前に食べると言った。",
    "生肉おにぎり 260円 / レジ横チキン 230円",
  ),
);

const d1Hayakawa: AuthoredEncounter = {
  id: d1HayakawaId,
  customerId: "hayakawa",
  requestedItemId: "raw_meat_onigiri",
  intro:
    "早川誠は青白い顔を夜勤の疲れだと笑い、生肉おにぎりを季節限定の商品だと説明した。明日の出勤もあるらしい。",
  scan:
    "POSは生肉おにぎりの商品名と260円を受け付けた。画面の注意書きは、季節限定という表示の下へ静かに隠れた。",
  recommendationOptions: [d1HayakawaRecommendationMask, d1HayakawaRecommendationChicken],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d1HayakawaId}_sell`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      copy(
        "生肉おにぎりを渡した。",
        "早川は季節限定の包みをしまい、明日の出勤時刻を確かめた。",
        "生肉おにぎり　260円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d1HayakawaId}_refuse`,
      axisOf("hayakawa"),
      copy(
        "生肉おにぎりの販売を断った。",
        "早川は空腹を隠すように頭を下げ、夜道へ戻った。",
        "販売なし / 生肉おにぎり",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "desperate" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d1HayakawaId}_default_recommend`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      priceOf("mask"),
      copy(
        "生肉おにぎりにマスクを添えた。",
        "早川はマスクをポケットへ入れ、季節の変わり目には気をつけると言った。",
        "生肉おにぎり　260円 / マスク　140円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
  },
};

const d1HotaruId = "d1_hotaru_first";
const d1HotaruRecommendationPhoto = recommendationOption(
  d1HotaruId,
  "photo_print_ticket",
  copy(
    "帰り道を残せるよう、写真プリント券を一枚すすめた。",
    "ほたるは券を受け取り、写真の中なら名前を呼べるかもしれないと言った。",
    "帰魂線香 480円 / 写真プリント券 200円",
  ),
);
const d1HotaruRecommendationSalt = recommendationOption(
  d1HotaruId,
  "purifying_salt",
  copy(
    "境目を整えるものとして、盛り塩を一袋すすめた。",
    "ほたるは白い袋を見つめ、入口の近くへ置くと言った。",
    "帰魂線香 480円 / 盛り塩 110円",
  ),
);

const d1Hotaru: AuthoredEncounter = {
  id: d1HotaruId,
  customerId: "hotaru",
  requestedItemId: "returning_soul_incense",
  intro:
    "入店ベルが鳴った。ドアは動かないまま、ほたるが帰魂線香を持ってカウンター前に立っていた。",
  scan:
    "POSだけは正常に反応し、帰魂線香の商品名と480円が表示された。入店ベルの余韻だけが、店内に長く残っている。",
  recommendationOptions: [d1HotaruRecommendationPhoto, d1HotaruRecommendationSalt],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d1HotaruId}_sell`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      copy(
        "帰魂線香を渡した。",
        "ほたるは線香を両手で包み、帰り道を探すように入口を見た。",
        "帰魂線香　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d1HotaruId}_refuse`,
      axisOf("hotaru"),
      copy(
        "帰魂線香の販売を断った。",
        "ほたるは入口ではない方向へ向き、ベルの音だけを残して遠ざかった。",
        "販売なし / 帰魂線香",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "wandering" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d1HotaruId}_default_recommend`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      priceOf("photo_print_ticket"),
      copy(
        "帰魂線香に写真プリント券を添えた。",
        "ほたるは券を見て、写真の中の帰り道を探してみると言った。",
        "帰魂線香　480円 / 写真プリント券　200円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
  },
};

export const TASK4_DAY1_ENCOUNTERS: AuthoredEncounter[] = [
  d1Taxi,
  d1Miyashita,
  d1Ren,
  d1Hayakawa,
  d1Hotaru,
];
