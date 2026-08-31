import type { Condition, WorldAxis } from "../../domain";
import {
  abnormalBaseSellOutcome,
  abnormalDefaultRecommendationOutcome,
  abnormalRefusalOutcome,
  ordinaryDefaultRecommendationOutcome,
  ordinaryRefusalOutcome,
  ordinarySaleOutcome,
} from "../config/outcomes";
import { TASK4_CUSTOMERS } from "../customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../items/ordinary";
import type {
  AuthoredEncounter,
  ConditionalNarrative,
  ItemDefinition,
  Narrative,
  RecommendationOption,
  ResultCopy,
} from "../types";

const TASK4_ITEMS: ItemDefinition[] = [...TASK4_ORDINARY_ITEMS, ...TASK4_ABNORMAL_ITEMS];

function itemById(itemId: string): ItemDefinition {
  const item = TASK4_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Task 4 Day 3 references missing item ${itemId}`);
  }
  return item;
}

function priceOf(itemId: string): number {
  return itemById(itemId).price;
}

function axisOf(customerId: string): WorldAxis {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer || customer.axis === undefined) {
    throw new Error(`Task 4 Day 3 requires an axis for ${customerId}`);
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

interface StateVariantInput {
  id: string;
  state: string;
  priority: number;
  text: string;
}

function stateNarrative(
  customerId: string,
  variants: readonly StateVariantInput[],
  fallback: string,
): ConditionalNarrative {
  return {
    variants: variants.map((variant) => ({
      id: variant.id,
      condition: { customerState: { customerId, state: variant.state } },
      priority: variant.priority,
      text: variant.text,
    })),
    fallback,
  };
}

interface AxisVariantInput {
  id: string;
  axis: WorldAxis;
  text: string;
}

function nonTiedLeadingAxisCondition(axis: WorldAxis): Condition {
  return {
    all: [
      { leadingAxis: { axis } },
      { numeric: { reference: "axisDifference", operator: "gt", value: 0 } },
    ],
  };
}

function leadingAxisNarrative(
  variants: readonly AxisVariantInput[],
  fallback: string,
): ConditionalNarrative {
  return {
    variants: variants.map((variant) => ({
      id: variant.id,
      condition: nonTiedLeadingAxisCondition(variant.axis),
      priority: 50,
      text: variant.text,
    })),
    fallback,
  };
}

function hako3ReturnNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hako3",
    [
      {
        id: `${prefix}_empathetic`,
        state: "empathetic",
        priority: 60,
        text: "HAKO-3は少女漫画の台詞を思い出し、配送先の人の気持ちを想像しながら箱を整えた。",
      },
      {
        id: `${prefix}_self_modified`,
        state: "self_modified",
        priority: 60,
        text: "HAKO-3は自分で付け替えた部品を確かめ、以前とは違う手順で配送箱を閉じた。",
      },
      {
        id: `${prefix}_offline`,
        state: "offline",
        priority: 50,
        text: "HAKO-3は電源表示を失ったまま、配送箱を置いて停止していた。",
      },
      {
        id: `${prefix}_powered`,
        state: "powered",
        priority: 40,
        text: "HAKO-3は電源を保ち、配送先と箱の中身をいつもどおり確認していた。",
      },
    ],
    "HAKO-3は商品名と配送先を確かめたが、今夜の動作は判断できないままだった。",
  );
}

function hotaruReturnNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hotaru",
    [
      {
        id: `${prefix}_remembered`,
        state: "remembered",
        priority: 60,
        text: "ほたるは写真の中の家族の名前を聞き取り、帰る場所を思い出したように入口を見た。",
      },
      {
        id: `${prefix}_sealed`,
        state: "sealed",
        priority: 60,
        text: "ほたるは境目の白い跡の内側にとどまり、声を出さずにガラスを見つめていた。",
      },
      {
        id: `${prefix}_wandering`,
        state: "wandering",
        priority: 50,
        text: "ほたるは帰り道を見つけられず、店の外を何度も振り返りながらさまよっていた。",
      },
      {
        id: `${prefix}_calling`,
        state: "calling",
        priority: 40,
        text: "ほたるは誰かの名前を呼ぶように唇を動かし、返事を待つように立っていた。",
      },
    ],
    "ほたるの姿は入口の明かりに重なったが、どこから来たのかは判断できなかった。",
  );
}

function miyashitaWardNarrative(prefix: string): ConditionalNarrative {
  return leadingAxisNarrative(
    [
      {
        id: `${prefix}_undead`,
        axis: "undead",
        text: "宮下は不死者病棟の記録を開いた。脈のない患者にも名札を付けて人として受け入れるため、夜勤の手が一人分足りないという。",
      },
      {
        id: `${prefix}_machine`,
        axis: "machine",
        text: "宮下は自動診療の区画を見せた。端末が患者を先に分類するため、誰を人として呼び入れるかを人の手で確かめる仕事が残っている。",
      },
      {
        id: `${prefix}_cosmic`,
        axis: "cosmic",
        text: "宮下は異星検疫の入口を指した。隔離された来訪者を人として救急へ通すか、病棟のベッドを空けるかで夜勤が割れている。",
      },
      {
        id: `${prefix}_spirit`,
        axis: "spirit",
        text: "宮下は霊安病棟の受付を振り返った。返事のない患者を人として扱うほど、残された人のための場所が狭くなるという。",
      },
    ],
    "宮下は四つの病棟の記録を閉じた。限られた人手で誰を人として救急へ通すのか、今夜は判断できないという。",
  );
}

const d3ElderId = "d3_elder_history";
const d3ElderRecommendation = recommendationOption(
  d3ElderId,
  "black_coffee",
  copy(
    "新聞を読む間に、黒コーヒーも一つすすめた。",
    "老人は紙面の端へ黒コーヒーを置き、日付を確かめながらゆっくり読んだ。",
    "新聞 180円 / 黒コーヒー 180円",
  ),
);

const d3Elder: AuthoredEncounter = {
  id: d3ElderId,
  customerId: "elder",
  requestedItemId: "newspaper",
  intro:
    "老人は新聞を手に取り、紙面の印刷日は1998年4月12日だと確かめた。地域欄には、今年で開業百年になる病院の話が当然のように載っている。老人は日付を気にせず、町の歴史は昔からこうだったと話した。",
  scan:
    "新聞の印刷日は1998年4月12日のままだった。記事の来歴だけが今の町に合わせて整い、老人はその食い違いを特別なこととして扱わなかった。",
  recommendationOptions: [d3ElderRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d3ElderId}_sell`,
      priceOf("newspaper"),
      copy(
        "新聞を渡した。",
        "老人は印刷日と記事を見比べたが、改訂された町の来歴を昔からのこととして語った。",
        "新聞　180円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d3ElderId}_refuse`,
      copy(
        "新聞の販売を断った。",
        "老人は日付を一度だけ見て、いつもの朝刊を探すように店を出た。",
        "販売なし / 新聞",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d3ElderId}_default_recommend`,
      priceOf("newspaper"),
      priceOf("black_coffee"),
      copy(
        "新聞に黒コーヒーを添えた。",
        "老人は紙面の印刷日を気にせず、変わった来歴も昔からの記録として読み進めた。",
        "新聞　180円 / 黒コーヒー　180円",
      ),
    ),
  },
};

const d3Hako3Id = "d3_hako3_return";
const d3Hako3RecommendationManga = recommendationOption(
  d3Hako3Id,
  "shojo_manga",
  copy(
    "配送先の人の気持ちを考えられるよう、少女漫画を一冊すすめた。",
    "HAKO-3は漫画のページを読み、荷物を受け取る人の表情を想像してから箱を閉じた。",
    "自我対応乾電池 480円 / 少女漫画 520円",
  ),
);
const d3Hako3RecommendationDriver = recommendationOption(
  d3Hako3Id,
  "precision_screwdriver",
  copy(
    "端末を調整できるよう、精密ドライバーを一本すすめた。",
    "HAKO-3は先端を部品へ当て、自分の動きを変える準備を始めた。",
    "自我対応乾電池 480円 / 精密ドライバー 980円",
  ),
);

const d3Hako3: AuthoredEncounter = {
  id: d3Hako3Id,
  customerId: "hako3",
  requestedItemId: "self_aware_battery",
  intro: hako3ReturnNarrative("d3_hako3_intro"),
  scan:
    "HAKO-3は自我対応乾電池をカウンターへ置いた。スキャン中だけ容量の表示が揺れ、POSは480円を通常の商品として受け付けた。",
  recommendationOptions: [d3Hako3RecommendationManga, d3Hako3RecommendationDriver],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d3Hako3Id}_sell`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      copy(
        "自我対応乾電池を渡した。",
        hako3ReturnNarrative("d3_hako3_sell_readback"),
        "自我対応乾電池　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "powered" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d3Hako3Id}_refuse`,
      axisOf("hako3"),
      copy(
        "自我対応乾電池の販売を断った。",
        hako3ReturnNarrative("d3_hako3_refuse_readback"),
        "販売なし / 自我対応乾電池",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "offline" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d3Hako3Id}_default_recommend`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      priceOf("shojo_manga"),
      copy(
        "自我対応乾電池に少女漫画を添えた。",
        hako3ReturnNarrative("d3_hako3_default_readback"),
        "自我対応乾電池　480円 / 少女漫画　520円",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "powered" }],
    ),
  },
};

const d3HotaruId = "d3_hotaru_return";
const d3HotaruRecommendationPhoto = recommendationOption(
  d3HotaruId,
  "photo_print_ticket",
  copy(
    "家族との帰り道を残せるよう、写真プリント券を一枚すすめた。",
    "ほたるは写真の余白を指でなぞり、呼ばれた名前をそこへ残すと言った。",
    "帰魂線香 480円 / 写真プリント券 200円",
  ),
);
const d3HotaruRecommendationSalt = recommendationOption(
  d3HotaruId,
  "purifying_salt",
  copy(
    "境目を整えられるよう、盛り塩を一袋すすめた。",
    "ほたるは白い袋を入口へ近づけ、戻れないものを留めると言った。",
    "帰魂線香 480円 / 盛り塩 110円",
  ),
);

const d3Hotaru: AuthoredEncounter = {
  id: d3HotaruId,
  customerId: "hotaru",
  requestedItemId: "returning_soul_incense",
  intro: hotaruReturnNarrative("d3_hotaru_intro"),
  scan:
    "帰魂線香をスキャンすると480円が表示された。ほたるの足元には濡れた跡が残ったが、入店音だけはいつもの接客と同じように鳴った。",
  recommendationOptions: [d3HotaruRecommendationPhoto, d3HotaruRecommendationSalt],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d3HotaruId}_sell`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      copy(
        "帰魂線香を渡した。",
        hotaruReturnNarrative("d3_hotaru_sell_readback"),
        "帰魂線香　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d3HotaruId}_refuse`,
      axisOf("hotaru"),
      copy(
        "帰魂線香の販売を断った。",
        hotaruReturnNarrative("d3_hotaru_refuse_readback"),
        "販売なし / 帰魂線香",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "wandering" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d3HotaruId}_default_recommend`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      priceOf("photo_print_ticket"),
      copy(
        "帰魂線香に写真プリント券を添えた。",
        hotaruReturnNarrative("d3_hotaru_default_readback"),
        "帰魂線香　480円 / 写真プリント券　200円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
  },
};

const d3MiyashitaId = "d3_miyashita_four_wards";
const d3MiyashitaRecommendation = recommendationOption(
  d3MiyashitaId,
  "sandwich",
  copy(
    "夜勤の休憩に、サンドイッチも一つすすめた。",
    "宮下は袋を受け取り、病棟へ戻る前に食べておくと言った。",
    "黒コーヒー 180円 / サンドイッチ 320円",
  ),
);

const d3Miyashita: AuthoredEncounter = {
  id: d3MiyashitaId,
  customerId: "miyashita",
  requestedItemId: "black_coffee",
  intro: miyashitaWardNarrative("d3_miyashita_intro"),
  scan:
    "黒コーヒーのスキャンは一度で通った。宮下は病院の受付記録を閉じ、休憩の前に四つの病棟の報告を読み直していた。",
  recommendationOptions: [d3MiyashitaRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d3MiyashitaId}_sell`,
      priceOf("black_coffee"),
      copy(
        "黒コーヒーを渡した。",
        miyashitaWardNarrative("d3_miyashita_sell_readback"),
        "黒コーヒー　180円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d3MiyashitaId}_refuse`,
      copy(
        "黒コーヒーの販売を断った。",
        miyashitaWardNarrative("d3_miyashita_refuse_readback"),
        "販売なし / 黒コーヒー",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d3MiyashitaId}_default_recommend`,
      priceOf("black_coffee"),
      priceOf("sandwich"),
      copy(
        "黒コーヒーにサンドイッチを添えた。",
        miyashitaWardNarrative("d3_miyashita_default_readback"),
        "黒コーヒー　180円 / サンドイッチ　320円",
      ),
    ),
  },
};

function mewReturnNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "mew",
    [
      {
        id: `${prefix}_visitor`,
        state: "visitor",
        priority: 60,
        text: "ミューは観光ガイドの印をたどり、この町を訪れた客として店の棚を眺めていた。",
      },
      {
        id: `${prefix}_beacon_sent`,
        state: "beacon_sent",
        priority: 60,
        text: "ミューは遠くへ送ったビーコンの返事を待ち、母船の方向を何度も確かめていた。",
      },
      {
        id: `${prefix}_stranded`,
        state: "stranded",
        priority: 50,
        text: "ミューは帰り道を失ったまま、空を見上げて立ち往生していた。",
      },
      {
        id: `${prefix}_supplied`,
        state: "supplied",
        priority: 40,
        text: "ミューは補給を済ませた旅行者のように、次の行き先を地図へ書き込んでいた。",
      },
    ],
    "ミューは地図と残量表示を見比べたが、訪問者なのか帰還を待つ客なのかは判断できなかった。",
  );
}

const d3MewId = "d3_mew_return";
const d3MewRecommendationGuide = recommendationOption(
  d3MewId,
  "tourist_guide",
  copy(
    "町を歩く手がかりとして、観光ガイドを一冊すすめた。",
    "ミューは地図の余白を読み、到着を待つ仲間へ見せる場所を探した。",
    "無重力カップ麺 420円 / 観光ガイド 680円",
  ),
);
const d3MewRecommendationPower = recommendationOption(
  d3MewId,
  "mobile_power_bank",
  copy(
    "連絡を続けられるよう、モバイル電源を一つすすめた。",
    "ミューは残量表示を確かめ、遠くへ信号を送れるかもしれないと言った。",
    "無重力カップ麺 420円 / モバイル電源 1980円",
  ),
);

const d3Mew: AuthoredEncounter = {
  id: d3MewId,
  customerId: "mew",
  requestedItemId: "zero_gravity_cup_noodles",
  intro: mewReturnNarrative("d3_mew_intro"),
  scan:
    "無重力カップ麺をスキャンすると420円が表示された。ふたの内側に別の言語の記号が浮かんだが、湯気は落ちずにその場へとどまった。",
  recommendationOptions: [d3MewRecommendationGuide, d3MewRecommendationPower],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d3MewId}_sell`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      copy(
        "無重力カップ麺を渡した。",
        mewReturnNarrative("d3_mew_sell_readback"),
        "無重力カップ麺　420円",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "supplied" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d3MewId}_refuse`,
      axisOf("mew"),
      copy(
        "無重力カップ麺の販売を断った。",
        mewReturnNarrative("d3_mew_refuse_readback"),
        "販売なし / 無重力カップ麺",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "stranded" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d3MewId}_default_recommend`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      priceOf("tourist_guide"),
      copy(
        "無重力カップ麺に観光ガイドを添えた。",
        mewReturnNarrative("d3_mew_default_readback"),
        "無重力カップ麺　420円 / 観光ガイド　680円",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "supplied" }],
    ),
  },
};

const d3RenId = "d3_ren_evidence";
const d3RenRecommendation = recommendationOption(
  d3RenId,
  "pencil",
  copy(
    "写真とレシートへ印を付けられるよう、鉛筆を一本すすめた。",
    "蓮は保存した家族写真と過去のレシートを並べ、見落としを記録しておくと言った。",
    "牛乳 210円 / 鉛筆 100円",
  ),
);

const renEvidenceReadback: Narrative =
  "蓮は保存した家族写真、通知の見出しと食い違う記事本文、過去のレシートを順に見た。接客と記録のずれに関係があるのかもしれないが、まだ原因だとは断定できないと慎重に言った。";

const d3Ren: AuthoredEncounter = {
  id: d3RenId,
  customerId: "ren",
  requestedItemId: "milk",
  intro:
    "蓮は牛乳をカウンターへ置き、保存した家族写真、通知の見出しと内容が違う記事、昨日までのレシートを並べた。写真の空席と記録のずれを見て、接客が関係しているのかもしれないが、まだ偶然かもしれないと話した。",
  scan:
    "牛乳をスキャンすると210円が表示された。蓮は写真の古い日付、保存通知の見出し、開いた記事本文、レシートの時刻を指で追い、接客と改変の因果を疑う仮説を立てた。ただし、断定はしなかった。",
  recommendationOptions: [d3RenRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d3RenId}_sell`,
      priceOf("milk"),
      copy("牛乳を渡した。", renEvidenceReadback, "牛乳　210円"),
      [{ kind: "add", target: "awareness", amount: 1 }],
    ),
    refuse: ordinaryRefusalOutcome(
      `${d3RenId}_refuse`,
      copy("牛乳の販売を断った。", renEvidenceReadback, "販売なし / 牛乳"),
      [{ kind: "add", target: "awareness", amount: 1 }],
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d3RenId}_default_recommend`,
      priceOf("milk"),
      priceOf("pencil"),
      copy("牛乳に鉛筆を添えた。", renEvidenceReadback, "牛乳　210円 / 鉛筆　100円"),
      [{ kind: "add", target: "awareness", amount: 1 }],
    ),
  },
};

export const TASK4_DAY3_ENCOUNTERS: AuthoredEncounter[] = [
  d3Elder,
  d3Hako3,
  d3Hotaru,
  d3Miyashita,
  d3Mew,
  d3Ren,
];
