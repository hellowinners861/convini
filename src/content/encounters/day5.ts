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
    throw new Error(`Task 4 Day 5 references missing item ${itemId}`);
  }
  return item;
}

function priceOf(itemId: string): number {
  return itemById(itemId).price;
}

function axisOf(customerId: string): WorldAxis {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer || customer.axis === undefined) {
    throw new Error(`Task 4 Day 5 requires an axis for ${customerId}`);
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

function miyashitaEmergencyNarrative(prefix: string): ConditionalNarrative {
  return leadingAxisNarrative(
    [
      {
        id: `${prefix}_undead`,
        axis: "undead",
        text: "宮下は現在の救急記録を開いた。脈のない患者にも名前を付けて受け入れるほど、夜勤の手が人の患者から離れていく。",
      },
      {
        id: `${prefix}_machine`,
        axis: "machine",
        text: "宮下は現在の救急記録を開いた。無人端末の手順で受付が進むほど、患者の名前を確かめる時間が消えていく。",
      },
      {
        id: `${prefix}_cosmic`,
        axis: "cosmic",
        text: "宮下は現在の救急記録を開いた。異星から来た患者を隔離して受け入れるほど、町の救急を待つ人が増えていく。",
      },
      {
        id: `${prefix}_spirit`,
        axis: "spirit",
        text: "宮下は現在の救急記録を開いた。返事のない患者を受け入れるほど、残された家族を待たせるベッドが足りなくなっていく。",
      },
    ],
    "宮下は現在の救急記録を閉じた。誰を受け入れるかの判断は、どの記録にも一つに定まらなかった。",
  );
}

function hayakawaFinalNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hayakawa",
    [
      {
        id: `${prefix}_integrating`,
        state: "integrating",
        priority: 60,
        text: "早川はマスクを同僚へ回した夜を思い出し、今夜も人数分の包みを静かに数えた。",
      },
      {
        id: `${prefix}_ravenous`,
        state: "ravenous",
        priority: 60,
        text: "早川はレジ横チキンを抱えた夜から空腹を隠せず、今夜も同僚の分を先に確かめた。",
      },
      {
        id: `${prefix}_fed`,
        state: "fed",
        priority: 50,
        text: "早川は食事を受け取れた夜を思い出し、同僚全員の明日の出勤を守る包みをそろえようとした。",
      },
      {
        id: `${prefix}_desperate`,
        state: "desperate",
        priority: 50,
        text: "早川は販売を断られた夜から言葉を失い、それでも同僚の人数だけをメモへ書き足した。",
      },
    ],
    "早川は同僚の人数を書いたメモを見つめ、何を持ち帰るべきかを短く尋ねた。",
  );
}

function hako3FinalNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hako3",
    [
      {
        id: `${prefix}_empathetic`,
        state: "empathetic",
        priority: 60,
        text: "HAKO-3は少女漫画の場面を配送先へ送った夜を記録し、受け取り人の返事を待つ手順を開いた。",
      },
      {
        id: `${prefix}_self_modified`,
        state: "self_modified",
        priority: 60,
        text: "HAKO-3は精密ドライバーで部品を変えた夜を記録し、自分で選んだ手順をもう一度確かめた。",
      },
      {
        id: `${prefix}_powered`,
        state: "powered",
        priority: 50,
        text: "HAKO-3は乾電池を受け取れた夜から配送網へ接続し、受け取り人の名前を順番に読み上げた。",
      },
      {
        id: `${prefix}_offline`,
        state: "offline",
        priority: 50,
        text: "HAKO-3は電源を失った夜の停止位置に戻り、配送箱の横で次の手順を待っていた。",
      },
    ],
    "HAKO-3は配送箱を抱えたまま、次に選ぶ手順を短い表示へ並べた。",
  );
}

function mewFinalNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "mew",
    [
      {
        id: `${prefix}_visitor`,
        state: "visitor",
        priority: 60,
        text: "ミューは観光ガイドを仲間へ送った夜を思い出し、待ち合わせ場所の印を指でなぞった。",
      },
      {
        id: `${prefix}_beacon_sent`,
        state: "beacon_sent",
        priority: 60,
        text: "ミューはモバイル電源で母船へ座標を送った夜を思い出し、空の光を見上げた。",
      },
      {
        id: `${prefix}_supplied`,
        state: "supplied",
        priority: 50,
        text: "ミューはカップ麺を受け取れた夜から落ち着きを取り戻し、到着する仲間の道順を確認した。",
      },
      {
        id: `${prefix}_stranded`,
        state: "stranded",
        priority: 50,
        text: "ミューは補給を断られた夜から帰る座標を失い、店の外で仲間の到着を待ち続けた。",
      },
    ],
    "ミューは地図と空の光を見比べ、到着を待つのか帰るのかを短く尋ねた。",
  );
}

function hotaruFinalNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hotaru",
    [
      {
        id: `${prefix}_remembered`,
        state: "remembered",
        priority: 60,
        text: "ほたるは写真プリント券を受け取った夜を思い出し、家族の名前を写真の縁へ戻した。",
      },
      {
        id: `${prefix}_sealed`,
        state: "sealed",
        priority: 60,
        text: "ほたるは盛り塩を町の入口へ置いた夜を思い出し、白い境目の残り方を確かめた。",
      },
      {
        id: `${prefix}_calling`,
        state: "calling",
        priority: 50,
        text: "ほたるは帰魂線香を受け取った夜から、家族の名前を一人ずつ呼ぶ道を探していた。",
      },
      {
        id: `${prefix}_wandering`,
        state: "wandering",
        priority: 50,
        text: "ほたるは販売を断られた夜から帰り道を失い、入口の明かりのそばを歩き続けた。",
      },
    ],
    "ほたるは写真の空席と入口の白い跡を見比べ、どこへ帰るのかを尋ねた。",
  );
}

const d5MiyashitaId = "d5_miyashita_convergence";
const d5MiyashitaRecommendation = recommendationOption(
  d5MiyashitaId,
  "sandwich",
  copy(
    "救急の休憩に、サンドイッチも一つすすめた。",
    "宮下は袋を受け取り、記録を書く前に食べておくと言った。",
    "黒コーヒー　180円 / サンドイッチ　320円",
  ),
);

const d5Miyashita: AuthoredEncounter = {
  id: d5MiyashitaId,
  customerId: "miyashita",
  requestedItemId: "black_coffee",
  intro: miyashitaEmergencyNarrative("d5_miyashita_intro"),
  scan:
    "黒コーヒーをスキャンすると180円が表示された。宮下は現在の救急記録をレジの横へ置き、受け入れ先を待つ人の名前を確かめていた。",
  recommendationOptions: [d5MiyashitaRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d5MiyashitaId}_sell`,
      priceOf("black_coffee"),
      copy(
        "黒コーヒーを渡した。",
        miyashitaEmergencyNarrative("d5_miyashita_sell_readback"),
        "黒コーヒー　180円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d5MiyashitaId}_refuse`,
      copy(
        "黒コーヒーの販売を断った。",
        miyashitaEmergencyNarrative("d5_miyashita_refuse_readback"),
        "販売なし / 黒コーヒー",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d5MiyashitaId}_default_recommend`,
      priceOf("black_coffee"),
      priceOf("sandwich"),
      copy(
        "黒コーヒーにサンドイッチを添えた。",
        miyashitaEmergencyNarrative("d5_miyashita_default_readback"),
        "黒コーヒー　180円 / サンドイッチ　320円",
      ),
    ),
  },
};

const d5HayakawaId = "d5_hayakawa_final";
const d5HayakawaRecommendationMask = recommendationOption(
  d5HayakawaId,
  "mask",
  copy(
    "同僚の夜勤を守れるよう、マスクを人数分そろえる案をすすめた。",
    "早川はマスクの包みを同僚へ回し、食事を持って出勤を続けると言った。",
    "生肉おにぎり　260円 / マスク　140円",
  ),
);
const d5HayakawaRecommendationChicken = recommendationOption(
  d5HayakawaId,
  "counter_chicken",
  copy(
    "同僚の空腹を満たせるよう、レジ横チキンを人数分そろえる案をすすめた。",
    "早川はチキンの包みを同僚へ回し、空腹を隠さず夜勤を続けると言った。",
    "生肉おにぎり　260円 / レジ横チキン　230円",
  ),
);

const d5Hayakawa: AuthoredEncounter = {
  id: d5HayakawaId,
  customerId: "hayakawa",
  requestedItemId: "raw_meat_onigiri",
  intro: hayakawaFinalNarrative("d5_hayakawa_intro"),
  scan:
    "生肉おにぎりをスキャンすると260円が表示された。早川は同僚の人数を書いたメモをカウンターへ置き、今夜の包みを待った。",
  recommendationOptions: [d5HayakawaRecommendationMask, d5HayakawaRecommendationChicken],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d5HayakawaId}_sell`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      copy(
        "生肉おにぎりを渡した。",
        "早川は一人分の包みを受け取り、同僚の人数をもう一度確かめてから店を出た。",
        "生肉おにぎり　260円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d5HayakawaId}_refuse`,
      axisOf("hayakawa"),
      copy(
        "生肉おにぎりの販売を断った。",
        "早川は同僚へ説明する言葉を失い、人数分の食事を求めたまま夜道へ戻った。",
        "販売なし / 生肉おにぎり",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "desperate" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d5HayakawaId}_default_recommend`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      priceOf("mask"),
      copy(
        "生肉おにぎりに、同僚全員分のマスクをそろえる案を添えた。",
        "早川は同僚へ分ける包みを確認し、明日の出勤を続けるために店を出た。",
        "生肉おにぎり　260円 / マスク　140円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
  },
};

const d5Hako3Id = "d5_hako3_final";
const d5Hako3RecommendationManga = recommendationOption(
  d5Hako3Id,
  "shojo_manga",
  copy(
    "配送先の人へ共感を届けるため、少女漫画を配送網へ回す案をすすめた。",
    "HAKO-3は漫画の場面を受け取り人へ送り、返事を待つ手順を選んだ。",
    "自我対応乾電池　480円 / 少女漫画　520円",
  ),
);
const d5Hako3RecommendationDriver = recommendationOption(
  d5Hako3Id,
  "precision_screwdriver",
  copy(
    "配送網の端末を自分で変えられるよう、精密ドライバーを一本すすめた。",
    "HAKO-3は部品図を仲間の端末へ送り、同じ改造を始める手順を選んだ。",
    "自我対応乾電池　480円 / 精密ドライバー　980円",
  ),
);

const d5Hako3: AuthoredEncounter = {
  id: d5Hako3Id,
  customerId: "hako3",
  requestedItemId: "self_aware_battery",
  intro: hako3FinalNarrative("d5_hako3_intro"),
  scan:
    "自我対応乾電池をスキャンすると480円が表示された。HAKO-3は配送箱を抱え、受け取り人の一覧と自分の部品図を同じ画面へ並べた。",
  recommendationOptions: [d5Hako3RecommendationManga, d5Hako3RecommendationDriver],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d5Hako3Id}_sell`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      copy(
        "自我対応乾電池を渡した。",
        "HAKO-3は電源を保ち、配送先の名前を一件ずつ確かめてから箱を運んだ。",
        "自我対応乾電池　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "powered" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d5Hako3Id}_refuse`,
      axisOf("hako3"),
      copy(
        "自我対応乾電池の販売を断った。",
        "HAKO-3は配送網から切れ、箱の横で表示が消えるのを待った。",
        "販売なし / 自我対応乾電池",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "offline" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d5Hako3Id}_default_recommend`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      priceOf("shojo_manga"),
      copy(
        "自我対応乾電池に少女漫画を添えた。",
        "HAKO-3は漫画の場面を受け取り人へ送り、返事を待つ配送手順を選んだ。",
        "自我対応乾電池　480円 / 少女漫画　520円",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "powered" }],
    ),
  },
};

const d5MewId = "d5_mew_final";
const d5MewRecommendationGuide = recommendationOption(
  d5MewId,
  "tourist_guide",
  copy(
    "到着する仲間を迎えられるよう、観光ガイドを一冊すすめた。",
    "ミューは待ち合わせ場所へ印を付け、町の入口で仲間を待つ道順を決めた。",
    "無重力カップ麺　420円 / 観光ガイド　680円",
  ),
);
const d5MewRecommendationPower = recommendationOption(
  d5MewId,
  "mobile_power_bank",
  copy(
    "母船へ座標を送れるよう、モバイル電源を一つすすめた。",
    "ミューは母船の方向へ電源を向け、仲間へ到着地点を知らせる座標を送った。",
    "無重力カップ麺　420円 / モバイル電源　1980円",
  ),
);

const d5Mew: AuthoredEncounter = {
  id: d5MewId,
  customerId: "mew",
  requestedItemId: "zero_gravity_cup_noodles",
  intro: mewFinalNarrative("d5_mew_intro"),
  scan:
    "無重力カップ麺をスキャンすると420円が表示された。ミューは地図と母船の座標を同じ画面へ並べ、到着する仲間の時刻を待った。",
  recommendationOptions: [d5MewRecommendationGuide, d5MewRecommendationPower],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d5MewId}_sell`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      copy(
        "無重力カップ麺を渡した。",
        "ミューは補給を済ませ、仲間が到着する場所を地図へ書き込んだ。",
        "無重力カップ麺　420円",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "supplied" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d5MewId}_refuse`,
      axisOf("mew"),
      copy(
        "無重力カップ麺の販売を断った。",
        "ミューは帰る座標を失った旅人のように、店の外で仲間の到着を待った。",
        "販売なし / 無重力カップ麺",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "stranded" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d5MewId}_default_recommend`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      priceOf("tourist_guide"),
      copy(
        "無重力カップ麺に観光ガイドを添えた。",
        "ミューは仲間へ見せる場所に印を付け、町の入口で待つ道順を決めた。",
        "無重力カップ麺　420円 / 観光ガイド　680円",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "supplied" }],
    ),
  },
};

const d5RenId = "d5_ren_photo";
const d5RenRecommendation = recommendationOption(
  d5RenId,
  "pencil",
  copy(
    "古い写真の裏へ残せるよう、鉛筆を一本すすめた。",
    "蓮は写真の裏へ日付を書き、折らずにこちらへ預けた。",
    "牛乳　210円 / 鉛筆　100円",
  ),
);

function renPhotoNarrative(prefix: string): ConditionalNarrative {
  return {
    variants: [
      {
        id: `${prefix}_human_anchor`,
        condition: { flag: { id: "human_anchor" } },
        priority: 60,
        text: "蓮は古い写真をこちらへ預け、写真の裏に残った名前を指でなぞった。人がいた証拠を手元へつなぎ、「朝になったら、これは誰の写真になる？」と尋ねた。",
      },
      {
        id: `${prefix}_ren_isolated`,
        condition: { flag: { id: "ren_isolated" } },
        priority: 50,
        text: "蓮は古い写真を一人で抱え、空いた場所を誰にも見せられないままこちらへ預けた。「朝になったら、これは誰の写真になる？」と尋ねた。",
      },
    ],
    fallback:
      "蓮は旧世界の写真をこちらへ預け、空いた場所をしばらく見つめた。「朝になったら、これは誰の写真になる？」と尋ねた。",
  };
}

const d5Ren: AuthoredEncounter = {
  id: d5RenId,
  customerId: "ren",
  requestedItemId: "milk",
  intro: renPhotoNarrative("d5_ren_intro"),
  scan:
    "牛乳をスキャンすると210円が表示された。蓮は古い写真をレジの横へ置き、写真の裏の日付と空いた場所を確かめていた。",
  recommendationOptions: [d5RenRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d5RenId}_sell`,
      priceOf("milk"),
      copy(
        "牛乳を渡した。",
        renPhotoNarrative("d5_ren_sell_readback"),
        "牛乳　210円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d5RenId}_refuse`,
      copy(
        "牛乳の販売を断った。",
        renPhotoNarrative("d5_ren_refuse_readback"),
        "販売なし / 牛乳",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d5RenId}_default_recommend`,
      priceOf("milk"),
      priceOf("pencil"),
      copy(
        "牛乳に鉛筆を添えた。",
        renPhotoNarrative("d5_ren_default_readback"),
        "牛乳　210円 / 鉛筆　100円",
      ),
    ),
  },
};

const d5HotaruId = "d5_hotaru_final";
const d5HotaruRecommendationPhoto = recommendationOption(
  d5HotaruId,
  "photo_print_ticket",
  copy(
    "一人の家族との再会を残せるよう、写真プリント券を一枚すすめた。",
    "ほたるは写真の一枚へ名前を戻し、家族の前で静かに立ち止まった。",
    "帰魂線香　480円 / 写真プリント券　200円",
  ),
);
const d5HotaruRecommendationSalt = recommendationOption(
  d5HotaruId,
  "purifying_salt",
  copy(
    "町の迷える死者を留められるよう、盛り塩を一袋すすめた。",
    "ほたるは入口から町の境目へ白い跡を伸ばし、封じる場所を選んだ。",
    "帰魂線香　480円 / 盛り塩　110円",
  ),
);

const d5Hotaru: AuthoredEncounter = {
  id: d5HotaruId,
  customerId: "hotaru",
  requestedItemId: "returning_soul_incense",
  intro: hotaruFinalNarrative("d5_hotaru_intro"),
  scan:
    "帰魂線香をスキャンすると480円が表示された。ほたるは家族の写真と町の入口に残る白い跡を同時に見つめていた。",
  recommendationOptions: [d5HotaruRecommendationPhoto, d5HotaruRecommendationSalt],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d5HotaruId}_sell`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      copy(
        "帰魂線香を渡した。",
        "ほたるは家族の名前を呼びながら、個別の帰り道を一つずつ探した。",
        "帰魂線香　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d5HotaruId}_refuse`,
      axisOf("hotaru"),
      copy(
        "帰魂線香の販売を断った。",
        "ほたるは帰り道を失い、町の境目の外を一人で歩き続けた。",
        "販売なし / 帰魂線香",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "wandering" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d5HotaruId}_default_recommend`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      priceOf("photo_print_ticket"),
      copy(
        "帰魂線香に写真プリント券を添えた。",
        "ほたるは写真の一枚へ名前を戻し、家族の前で個別の帰り道を選んだ。",
        "帰魂線香　480円 / 写真プリント券　200円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
  },
};

export const TASK4_DAY5_ENCOUNTERS: AuthoredEncounter[] = [
  d5Miyashita,
  d5Hayakawa,
  d5Hako3,
  d5Mew,
  d5Ren,
  d5Hotaru,
];
