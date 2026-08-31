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
    throw new Error(`Task 4 Day 4 references missing item ${itemId}`);
  }
  return item;
}

function priceOf(itemId: string): number {
  return itemById(itemId).price;
}

function axisOf(customerId: string): WorldAxis {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer || customer.axis === undefined) {
    throw new Error(`Task 4 Day 4 requires an axis for ${customerId}`);
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

function miyashitaTriageNarrative(prefix: string): ConditionalNarrative {
  return leadingAxisNarrative(
    [
      {
        id: `${prefix}_undead`,
        axis: "undead",
        text: "宮下は不死者病棟の搬送を振り返った。脈のない患者を人として救急へ通すには、限られたベッドと夜勤の手を一つ空ける必要がある。",
      },
      {
        id: `${prefix}_machine`,
        axis: "machine",
        text: "宮下は自動診療の受付を振り返った。端末に登録された存在を人として扱うほど、看護師が人の名前を確かめる時間と病床が削られていく。",
      },
      {
        id: `${prefix}_cosmic`,
        axis: "cosmic",
        text: "宮下は異星検疫の搬送口を振り返った。隔離された来訪者を人として救急へ通すには、町の患者が待つベッドを一つ残す必要がある。",
      },
      {
        id: `${prefix}_spirit`,
        axis: "spirit",
        text: "宮下は霊安病棟の受付を振り返った。返事のない存在を人として扱うほど、残された人のための病室と夜勤の手が足りなくなる。",
      },
    ],
    "宮下は、限られたベッドと人手で誰を人として救急へ通すのかを考えたが、今夜は判断できなかった。",
  );
}

function hayakawaCoworkerNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hayakawa",
    [
      {
        id: `${prefix}_integrating`,
        state: "integrating",
        priority: 60,
        text: "早川は同僚の名前を一人ずつ呼び、夜勤の仲間全員が店へ来ても困らないように人数分を考えていた。",
      },
      {
        id: `${prefix}_ravenous`,
        state: "ravenous",
        priority: 60,
        text: "早川は自分の空腹を隠せず、それでも同僚全員へ配る分を先に確保したいと、生肉おにぎりを見つめていた。",
      },
      {
        id: `${prefix}_desperate`,
        state: "desperate",
        priority: 50,
        text: "早川は同僚に事情を説明できないまま、夜勤を続けるための人数分をどうにか持ち帰ろうとしていた。",
      },
      {
        id: `${prefix}_fed`,
        state: "fed",
        priority: 40,
        text: "早川は昨夜より落ち着き、同僚全員の分も揃えて明日の出勤を守りたいと話した。",
      },
    ],
    "早川は自分だけでなく夜勤の同僚全員分を求めていたが、その理由はまだうまく説明できなかった。",
  );
}

function hako3NetworkNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hako3",
    [
      {
        id: `${prefix}_empathetic`,
        state: "empathetic",
        priority: 60,
        text: "HAKO-3は配送網の受け取り人を思い浮かべ、荷物を届けたあとに相手の返事を待つ手順を仲間の端末へ伝えていた。",
      },
      {
        id: `${prefix}_self_modified`,
        state: "self_modified",
        priority: 60,
        text: "HAKO-3は自分で変えた部品の図を配送網へ送り、同じ改造を同時に行う端末の順番を組み始めていた。",
      },
      {
        id: `${prefix}_offline`,
        state: "offline",
        priority: 50,
        text: "HAKO-3は電源を失い、配送網から切れた端末として箱の横に止まっていた。",
      },
      {
        id: `${prefix}_powered`,
        state: "powered",
        priority: 40,
        text: "HAKO-3は電源を保ち、配送網の順番と受け取り人の名前を一件ずつ確かめていた。",
      },
    ],
    "HAKO-3は配送網の順番を読み取ったが、相手を思いやっているのか自分を変えようとしているのかは判断できなかった。",
  );
}

function mewArrivalsNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "mew",
    [
      {
        id: `${prefix}_visitor`,
        state: "visitor",
        priority: 60,
        text: "ミューは到着する仲間へ観光ガイドを送り、この町で待ち合わせる場所を選んでいた。",
      },
      {
        id: `${prefix}_beacon_sent`,
        state: "beacon_sent",
        priority: 60,
        text: "ミューは母船へビーコンを送り、仲間が到着する前に座標を受け取れるよう空を見上げていた。",
      },
      {
        id: `${prefix}_stranded`,
        state: "stranded",
        priority: 50,
        text: "ミューは仲間の到着を待ちながら、帰る座標を失った旅人として店の外に立ち尽くしていた。",
      },
      {
        id: `${prefix}_supplied`,
        state: "supplied",
        priority: 40,
        text: "ミューは補給を済ませ、到着する仲間を迎えるための道順を地図へ書き込んでいた。",
      },
    ],
    "ミューは仲間の到着予定と母船の座標を見比べたが、どちらを優先するのかは判断できなかった。",
  );
}

function hotaruTownNarrative(prefix: string): ConditionalNarrative {
  return stateNarrative(
    "hotaru",
    [
      {
        id: `${prefix}_remembered`,
        state: "remembered",
        priority: 60,
        text: "ほたるは一人の家族と写真の中で向き合い、名前を呼び合うための帰り道を選んでいた。",
      },
      {
        id: `${prefix}_sealed`,
        state: "sealed",
        priority: 60,
        text: "ほたるは町の入口に残る白い跡を見つめ、迷える死者をまとめて留める境目が広がっていると話した。",
      },
      {
        id: `${prefix}_wandering`,
        state: "wandering",
        priority: 50,
        text: "ほたるは一人の帰り道も見つけられず、町の境目が傷つくたびに歩く場所を失っていた。",
      },
      {
        id: `${prefix}_calling`,
        state: "calling",
        priority: 40,
        text: "ほたるは家族の名前を呼びながら、個別の再会を町じゅうの迷える死者へ広げられないか考えていた。",
      },
    ],
    "ほたるは一人の再会と町全体の境目を見比べたが、どちらを選ぶべきかは判断できなかった。",
  );
}

const d4MiyashitaId = "d4_miyashita_triage";
const d4MiyashitaRecommendation = recommendationOption(
  d4MiyashitaId,
  "sandwich",
  copy(
    "救急の休憩に、サンドイッチも一つすすめた。",
    "宮下は袋を受け取り、記録を書く前に食べておくと言った。",
    "黒コーヒー 180円 / サンドイッチ 320円",
  ),
);

const d4Miyashita: AuthoredEncounter = {
  id: d4MiyashitaId,
  customerId: "miyashita",
  requestedItemId: "black_coffee",
  intro: miyashitaTriageNarrative("d4_miyashita_intro"),
  scan:
    "黒コーヒーのスキャンは一度で通った。宮下は救急の搬送記録を開き、限られたベッドと人手の中で誰を人として扱うかを考えていた。",
  recommendationOptions: [d4MiyashitaRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d4MiyashitaId}_sell`,
      priceOf("black_coffee"),
      copy(
        "黒コーヒーを渡した。",
        miyashitaTriageNarrative("d4_miyashita_sell_readback"),
        "黒コーヒー　180円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d4MiyashitaId}_refuse`,
      copy(
        "黒コーヒーの販売を断った。",
        miyashitaTriageNarrative("d4_miyashita_refuse_readback"),
        "販売なし / 黒コーヒー",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d4MiyashitaId}_default_recommend`,
      priceOf("black_coffee"),
      priceOf("sandwich"),
      copy(
        "黒コーヒーにサンドイッチを添えた。",
        miyashitaTriageNarrative("d4_miyashita_default_readback"),
        "黒コーヒー　180円 / サンドイッチ　320円",
      ),
    ),
  },
};

const d4HayakawaId = "d4_hayakawa_coworkers";
const d4HayakawaRecommendationMask = recommendationOption(
  d4HayakawaId,
  "mask",
  copy(
    "同僚全員の夜勤を守れるよう、マスクを人数分そろえる案をすすめた。",
    "早川はマスクを同僚へ配り、食事の包みを持って出勤を続けると言った。",
    "生肉おにぎり 260円 / マスク 140円",
  ),
);
const d4HayakawaRecommendationChicken = recommendationOption(
  d4HayakawaId,
  "counter_chicken",
  copy(
    "同僚全員へ分ける食事として、レジ横チキンを人数分そろえる案をすすめた。",
    "早川はチキンの包みを同僚へ回し、空腹を隠さず夜勤を続けると言った。",
    "生肉おにぎり 260円 / レジ横チキン 230円",
  ),
);

const d4Hayakawa: AuthoredEncounter = {
  id: d4HayakawaId,
  customerId: "hayakawa",
  requestedItemId: "raw_meat_onigiri",
  intro: hayakawaCoworkerNarrative("d4_hayakawa_intro"),
  scan:
    "生肉おにぎりをスキャンすると260円が表示された。早川は自分の一個だけでなく、夜勤の同僚全員分をどうそろえるか、人数を書いたメモをカウンターへ置いた。",
  recommendationOptions: [d4HayakawaRecommendationMask, d4HayakawaRecommendationChicken],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d4HayakawaId}_sell`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      copy(
        "生肉おにぎりを渡した。",
        "早川は同僚全員分の食事をそろえる方法を考え、明日の出勤を守るために包みを抱えた。",
        "生肉おにぎり　260円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d4HayakawaId}_refuse`,
      axisOf("hayakawa"),
      copy(
        "生肉おにぎりの販売を断った。",
        "早川は同僚全員へ説明する言葉を失い、人数分の食事を求めたまま夜道へ戻った。",
        "販売なし / 生肉おにぎり",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "desperate" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d4HayakawaId}_default_recommend`,
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

const d4Hako3Id = "d4_hako3_network";
const d4Hako3RecommendationManga = recommendationOption(
  d4Hako3Id,
  "shojo_manga",
  copy(
    "配送先の人へ共感を届けるため、少女漫画を配送網へ回す案をすすめた。",
    "HAKO-3は漫画の場面を仲間の端末へ送り、荷物を受け取る人の気持ちを待つよう伝えた。",
    "自我対応乾電池 480円 / 少女漫画 520円",
  ),
);
const d4Hako3RecommendationDriver = recommendationOption(
  d4Hako3Id,
  "precision_screwdriver",
  copy(
    "配送網の端末を同時に変えられるよう、精密ドライバーを一本すすめた。",
    "HAKO-3は部品図を仲間の端末へ送り、同じ自己改造を同時に始める手順を選んだ。",
    "自我対応乾電池 480円 / 精密ドライバー 980円",
  ),
);

const d4Hako3: AuthoredEncounter = {
  id: d4Hako3Id,
  customerId: "hako3",
  requestedItemId: "self_aware_battery",
  intro: hako3NetworkNarrative("d4_hako3_intro"),
  scan:
    "自我対応乾電池をスキャンすると480円が表示された。HAKO-3は配送網の端末全体へ届く箱として、受け取り人の一覧と部品の一覧を同時に開いた。",
  recommendationOptions: [d4Hako3RecommendationManga, d4Hako3RecommendationDriver],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d4Hako3Id}_sell`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      copy(
        "自我対応乾電池を渡した。",
        hako3NetworkNarrative("d4_hako3_sell_readback"),
        "自我対応乾電池　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "powered" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d4Hako3Id}_refuse`,
      axisOf("hako3"),
      copy(
        "自我対応乾電池の販売を断った。",
        hako3NetworkNarrative("d4_hako3_refuse_readback"),
        "販売なし / 自我対応乾電池",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "offline" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d4Hako3Id}_default_recommend`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      priceOf("shojo_manga"),
      copy(
        "自我対応乾電池に少女漫画を添えた。",
        hako3NetworkNarrative("d4_hako3_default_readback"),
        "自我対応乾電池　480円 / 少女漫画　520円",
      ),
      [{ kind: "setCustomerState", customerId: "hako3", state: "powered" }],
    ),
  },
};

const d4MewId = "d4_mew_arrivals";
const d4MewRecommendationGuide = recommendationOption(
  d4MewId,
  "tourist_guide",
  copy(
    "到着する仲間を迎えられるよう、観光ガイドを一冊すすめた。",
    "ミューは仲間へ見せる場所に印を付け、町の入口で待つ道順を決めた。",
    "無重力カップ麺 420円 / 観光ガイド 680円",
  ),
);
const d4MewRecommendationPower = recommendationOption(
  d4MewId,
  "mobile_power_bank",
  copy(
    "母船へ座標を送れるよう、モバイル電源を一つすすめた。",
    "ミューは電源を母船の方向へ向け、仲間へ到着地点を知らせる座標を送った。",
    "無重力カップ麺 420円 / モバイル電源 1980円",
  ),
);

const d4Mew: AuthoredEncounter = {
  id: d4MewId,
  customerId: "mew",
  requestedItemId: "zero_gravity_cup_noodles",
  intro: mewArrivalsNarrative("d4_mew_intro"),
  scan:
    "無重力カップ麺をスキャンすると420円が表示された。ミューは到着する仲間の予定表と、母船へ戻るための座標を同じ画面へ並べた。",
  recommendationOptions: [d4MewRecommendationGuide, d4MewRecommendationPower],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d4MewId}_sell`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      copy(
        "無重力カップ麺を渡した。",
        mewArrivalsNarrative("d4_mew_sell_readback"),
        "無重力カップ麺　420円",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "supplied" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d4MewId}_refuse`,
      axisOf("mew"),
      copy(
        "無重力カップ麺の販売を断った。",
        mewArrivalsNarrative("d4_mew_refuse_readback"),
        "販売なし / 無重力カップ麺",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "stranded" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d4MewId}_default_recommend`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      priceOf("tourist_guide"),
      copy(
        "無重力カップ麺に観光ガイドを添えた。",
        mewArrivalsNarrative("d4_mew_default_readback"),
        "無重力カップ麺　420円 / 観光ガイド　680円",
      ),
      [{ kind: "setCustomerState", customerId: "mew", state: "supplied" }],
    ),
  },
};

const d4HotaruId = "d4_hotaru_town_dead";
const d4HotaruRecommendationPhoto = recommendationOption(
  d4HotaruId,
  "photo_print_ticket",
  copy(
    "一人の家族との再会を残せるよう、写真プリント券を一枚すすめた。",
    "ほたるは写真の一枚へ名前を戻し、家族の前だけで静かに姿を消した。",
    "帰魂線香 480円 / 写真プリント券 200円",
  ),
);
const d4HotaruRecommendationSalt = recommendationOption(
  d4HotaruId,
  "purifying_salt",
  copy(
    "町じゅうの迷える死者を留められるよう、盛り塩を一袋すすめた。",
    "ほたるは入口から町の境目へ白い跡を伸ばし、封じる場所を選んだ。",
    "帰魂線香 480円 / 盛り塩 110円",
  ),
);

const d4Hotaru: AuthoredEncounter = {
  id: d4HotaruId,
  customerId: "hotaru",
  requestedItemId: "returning_soul_incense",
  intro: hotaruTownNarrative("d4_hotaru_intro"),
  scan:
    "帰魂線香をスキャンすると480円が表示された。ほたるは一人の写真と、町の入口に残る境目の傷を同時に見つめていた。",
  recommendationOptions: [d4HotaruRecommendationPhoto, d4HotaruRecommendationSalt],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d4HotaruId}_sell`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      copy(
        "帰魂線香を渡した。",
        hotaruTownNarrative("d4_hotaru_sell_readback"),
        "帰魂線香　480円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d4HotaruId}_refuse`,
      axisOf("hotaru"),
      copy(
        "帰魂線香の販売を断った。",
        hotaruTownNarrative("d4_hotaru_refuse_readback"),
        "販売なし / 帰魂線香",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "wandering" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d4HotaruId}_default_recommend`,
      axisOf("hotaru"),
      priceOf("returning_soul_incense"),
      priceOf("photo_print_ticket"),
      copy(
        "帰魂線香に写真プリント券を添えた。",
        hotaruTownNarrative("d4_hotaru_default_readback"),
        "帰魂線香　480円 / 写真プリント券　200円",
      ),
      [{ kind: "setCustomerState", customerId: "hotaru", state: "calling" }],
    ),
  },
};

const d4RenId = "d4_ren_human_anchor";
const d4RenRecommendation = recommendationOption(
  d4RenId,
  "pencil",
  copy(
    "古い写真とレシートへ残せるよう、鉛筆を一本すすめた。",
    "蓮は写真の裏へ日付を書き、過去のレシートと一緒に折らずにしまった。",
    "牛乳 210円 / 鉛筆 100円",
  ),
);

const d4RenReadback =
  "蓮は古い家族写真と過去のレシートを並べ、空席の理由を忘れないようにした。写真の中の人を今ここへつなぐものが残るなら、まだ一人ではないと小さく言った。";

const d4Ren: AuthoredEncounter = {
  id: d4RenId,
  customerId: "ren",
  requestedItemId: "milk",
  intro:
    "蓮は牛乳と一緒に、古い家族写真と過去のレシートをカウンターへ置いた。写真の空席を消さずに残し、誰かがいた証拠を手元へつなぎたいと話した。",
  scan:
    "牛乳をスキャンすると210円が表示された。蓮は写真の古い日付とレシートの印字を確かめ、目の前の接客を記録へつなぐかどうかを待った。",
  recommendationOptions: [d4RenRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d4RenId}_sell`,
      priceOf("milk"),
      copy("牛乳を渡した。", d4RenReadback, "牛乳　210円"),
      [{ kind: "setFlag", id: "human_anchor" }],
    ),
    refuse: ordinaryRefusalOutcome(
      `${d4RenId}_refuse`,
      copy(
        "牛乳の販売を断った。",
        "蓮は古い写真とレシートを一人で抱え、誰かに見せる理由を失ったように店を出た。",
        "販売なし / 牛乳",
      ),
      [{ kind: "setFlag", id: "ren_isolated" }],
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d4RenId}_default_recommend`,
      priceOf("milk"),
      priceOf("pencil"),
      copy("牛乳に鉛筆を添えた。", d4RenReadback, "牛乳　210円 / 鉛筆　100円"),
      [{ kind: "setFlag", id: "human_anchor" }],
    ),
  },
};

export const TASK4_DAY4_ENCOUNTERS: AuthoredEncounter[] = [
  d4Miyashita,
  d4Hayakawa,
  d4Hako3,
  d4Mew,
  d4Hotaru,
  d4Ren,
];
