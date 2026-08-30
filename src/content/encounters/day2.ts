import type { WorldAxis } from "../../domain";
import { abnormalBaseSellOutcome, abnormalDefaultRecommendationOutcome, abnormalRefusalOutcome, ordinaryDefaultRecommendationOutcome, ordinaryRefusalOutcome, ordinarySaleOutcome } from "../config/outcomes";
import { TASK4_CUSTOMERS } from "../customers/catalog";
import { TASK4_ABNORMAL_ITEMS } from "../items/abnormal";
import { TASK4_ORDINARY_ITEMS } from "../items/ordinary";
import type { AuthoredEncounter, ConditionalNarrative, ItemDefinition, Narrative, RecommendationOption, ResultCopy } from "../types";

const TASK4_ITEMS: ItemDefinition[] = [...TASK4_ORDINARY_ITEMS, ...TASK4_ABNORMAL_ITEMS];

function itemById(itemId: string): ItemDefinition {
  const item = TASK4_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Task 4 Day 2 references missing item ${itemId}`);
  }
  return item;
}

function priceOf(itemId: string): number {
  return itemById(itemId).price;
}

function axisOf(customerId: string): WorldAxis {
  const customer = TASK4_CUSTOMERS.find((candidate) => candidate.id === customerId);
  if (!customer || customer.axis === undefined) {
    throw new Error(`Task 4 Day 2 requires an axis for ${customerId}`);
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

function hayakawaEchoIntro(): ConditionalNarrative {
  return stateNarrative(
    "hayakawa",
    [
      {
        id: "miyashita_intro_integrating",
        state: "integrating",
        priority: 50,
        text: "宮下は、昨夜の早川を落ち着いた不死者の患者として受け入れたと話した。病棟では大きな騒ぎにならなかったらしい。",
      },
      {
        id: "miyashita_intro_fed",
        state: "fed",
        priority: 40,
        text: "宮下は、昨夜食事を取った患者が落ち着いていたと話した。早川の名前は記録の端にだけ残っている。",
      },
      {
        id: "miyashita_intro_ravenous",
        state: "ravenous",
        priority: 50,
        text: "宮下は、夜明け前に咬傷のある患者が運ばれたと話した。傷の原因は、まだ記録に書けないという。",
      },
      {
        id: "miyashita_intro_desperate",
        state: "desperate",
        priority: 50,
        text: "宮下は、昨夜から行方不明になった患者のことを話した。身元の欄だけが空いたままだった。",
      },
    ],
    "宮下は夜勤の報告を短くまとめた。早川の名前に似た記録はあるが、出来事の順番ははっきりしない。",
  );
}

function hayakawaEchoReadback(): ConditionalNarrative {
  return stateNarrative(
    "hayakawa",
    [
      {
        id: "miyashita_readback_integrating",
        state: "integrating",
        priority: 50,
        text: "宮下は、不死者の患者も静かに朝を待てたと確認した。早川のことは、今夜の申し送りに残すという。",
      },
      {
        id: "miyashita_readback_fed",
        state: "fed",
        priority: 40,
        text: "宮下は、食事を取った患者なら落ち着いて眠れたと確認した。病院の灯りはいつもどおりだった。",
      },
      {
        id: "miyashita_readback_ravenous",
        state: "ravenous",
        priority: 50,
        text: "宮下は咬傷の手当てが続いていると確認した。救急の記録には、早川の名前がまだ載っていない。",
      },
      {
        id: "miyashita_readback_desperate",
        state: "desperate",
        priority: 50,
        text: "宮下は行方不明の患者を探していると確認した。最後に見た場所だけが、夜勤の記録に残っている。",
      },
    ],
    "宮下は報告を読み返したが、早川に関する箇所だけは判断できないままだった。",
  );
}

const d2MiyashitaId = "d2_miyashita_undead_echo";
const d2MiyashitaRecommendation = recommendationOption(
  d2MiyashitaId,
  "sandwich",
  copy(
    "夜勤用にサンドイッチもすすめた。",
    "宮下は包みを受け取り、報告を書く前に食べておくと言った。",
    "黒コーヒー 180円 / サンドイッチ 320円",
  ),
);

const d2Miyashita: AuthoredEncounter = {
  id: d2MiyashitaId,
  customerId: "miyashita",
  requestedItemId: "black_coffee",
  intro: hayakawaEchoIntro(),
  scan:
    "黒コーヒーのスキャンは一度で通った。宮下は日付を確かめ、昨夜の報告を思い出すようにレジ画面を見た。",
  recommendationOptions: [d2MiyashitaRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d2MiyashitaId}_sell`,
      priceOf("black_coffee"),
      copy(
        "黒コーヒーを渡した。",
        hayakawaEchoReadback(),
        "黒コーヒー　180円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d2MiyashitaId}_refuse`,
      copy(
        "黒コーヒーの販売を断った。",
        hayakawaEchoReadback(),
        "販売なし / 黒コーヒー",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d2MiyashitaId}_default_recommend`,
      priceOf("black_coffee"),
      priceOf("sandwich"),
      copy(
        "黒コーヒーにサンドイッチを添えた。",
        hayakawaEchoReadback(),
        "黒コーヒー　180円 / サンドイッチ　320円",
      ),
    ),
  },
};

const d2Hako3Id = "d2_hako3_first";
const d2Hako3RecommendationManga = recommendationOption(
  d2Hako3Id,
  "shojo_manga",
  copy(
    "配送の待ち時間に読めるよう、少女漫画を一冊すすめた。",
    "HAKO-3は表紙を長く読み取り、次の配送先へ持っていくと言った。",
    "自我対応乾電池 480円 / 少女漫画 520円",
  ),
);
const d2Hako3RecommendationDriver = recommendationOption(
  d2Hako3Id,
  "precision_screwdriver",
  copy(
    "端末の調整に使えるよう、精密ドライバーを一本すすめた。",
    "HAKO-3は先端の形を確認し、配送箱の奥へしまった。",
    "自我対応乾電池 480円 / 精密ドライバー 980円",
  ),
);

const d2Hako3: AuthoredEncounter = {
  id: d2Hako3Id,
  customerId: "hako3",
  requestedItemId: "self_aware_battery",
  intro:
    "配送箱を抱えたHAKO-3が立っていた。表示と姿勢だけなら、高度な配送端末が集荷の確認に来たように見える。",
  scan:
    "自我対応乾電池をスキャンすると、容量の単位が一度だけ別の表記へ変わった。POSは480円をそのまま受け付けた。",
  recommendationOptions: [d2Hako3RecommendationManga, d2Hako3RecommendationDriver],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d2Hako3Id}_sell`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      copy(
        "自我対応乾電池を渡した。",
        "HAKO-3は配送箱の中身を並べ直し、予定どおり次の場所へ向かった。",
        "自我対応乾電池　480円",
      ),
    ),
    refuse: abnormalRefusalOutcome(
      `${d2Hako3Id}_refuse`,
      axisOf("hako3"),
      copy(
        "自我対応乾電池の販売を断った。",
        "HAKO-3は短い確認音を鳴らし、配送箱を抱え直した。",
        "販売なし / 自我対応乾電池",
      ),
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d2Hako3Id}_default_recommend`,
      axisOf("hako3"),
      priceOf("self_aware_battery"),
      priceOf("shojo_manga"),
      copy(
        "自我対応乾電池に少女漫画を添えた。",
        "HAKO-3は漫画のページを開き、配送先を選ぶ理由について考え始めた。",
        "自我対応乾電池　480円 / 少女漫画　520円",
      ),
    ),
  },
};

const d2ConstructionId = "d2_construction_sales_rule";
const d2ConstructionRecommendation = recommendationOption(
  d2ConstructionId,
  "work_gloves",
  copy(
    "夜間作業に使えるよう、軍手もすすめた。",
    "作業員は仲間の分まで手に取り、朝まで使えると言った。",
    "弁当 580円 / 軍手 390円",
  ),
);

const d2Construction: AuthoredEncounter = {
  id: d2ConstructionId,
  customerId: "construction_worker",
  requestedItemId: "bento",
  intro:
    "工事作業員が休憩の弁当をカウンターへ置いた。朝までの工程と、現場に残る仲間の分を気にしている。",
  scan:
    "弁当のバーコードと580円が画面に表示された。作業員は、ここを出ると次の休憩まで買い物ができないと言った。",
  recommendationOptions: [d2ConstructionRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d2ConstructionId}_sell`,
      priceOf("bento"),
      copy(
        "弁当を渡した。",
        "作業員は現場の仲間へ連絡し、朝までの工程を続けると言った。",
        "弁当　580円",
      ),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d2ConstructionId}_refuse`,
      copy(
        "弁当の販売を断った。弁当の分は売上に加わらず、店長はレジ横を見た。",
        "作業員は仲間へ連絡するため、空の手で店を出た。",
        "販売なし / 弁当",
      ),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d2ConstructionId}_default_recommend`,
      priceOf("bento"),
      priceOf("work_gloves"),
      copy(
        "弁当に軍手を添えた。",
        "作業員は弁当と軍手を抱え、仲間にも分けられると言った。",
        "弁当　580円 / 軍手　390円",
      ),
    ),
  },
};

function renSpiritIntro(): ConditionalNarrative {
  return stateNarrative(
    "hotaru",
    [
      {
        id: "ren_intro_remembered",
        state: "remembered",
        priority: 50,
        text: "蓮は、ほたるという名前を姉の記憶として思い出しかけていた。家族写真の話を、今度は途中でやめなかった。",
      },
      {
        id: "ren_intro_calling",
        state: "calling",
        priority: 40,
        text: "蓮は誰かに名前を呼ばれた気がすると話した。写真の中の姉に、返事をしてほしいらしい。",
      },
      {
        id: "ren_intro_sealed",
        state: "sealed",
        priority: 50,
        text: "蓮は家族写真を開き、端のガラスにだけ姉らしい影が写っていたと話した。写真はすぐに閉じた。",
      },
      {
        id: "ren_intro_wandering",
        state: "wandering",
        priority: 50,
        text: "蓮は、理由のない喪失感だけが残っていると話した。家族写真を見ても、誰を待っているのか分からない。",
      },
    ],
    "蓮は牛乳を選び、家族写真の空席について理由が分からないまま黙った。",
  );
}

function renSpiritReadback(): ConditionalNarrative {
  return stateNarrative(
    "hotaru",
    [
      {
        id: "ren_readback_remembered",
        state: "remembered",
        priority: 50,
        text: "蓮は写真の中の姉の名前を、忘れないように小さく繰り返した。",
      },
      {
        id: "ren_readback_calling",
        state: "calling",
        priority: 40,
        text: "蓮は返事を待つように入口を見た。姉の名前だけが、店内の音に重なって聞こえた。",
      },
      {
        id: "ren_readback_sealed",
        state: "sealed",
        priority: 50,
        text: "蓮は家族写真の端に残った影を指で隠し、もう一度だけ見返した。",
      },
      {
        id: "ren_readback_wandering",
        state: "wandering",
        priority: 50,
        text: "蓮は理由のない喪失を抱えたまま、写真をポケットへ戻した。",
      },
    ],
    "蓮は写真をしまった。空席の理由は、今夜も分からないままだった。",
  );
}

const d2RenId = "d2_ren_spirit_echo";
const d2RenRecommendation = recommendationOption(
  d2RenId,
  "pencil",
  copy(
    "写真の裏へ書けるよう、鉛筆を一つすすめた。",
    "蓮は写真の日付と名前を書き留めておくと言った。",
    "牛乳 210円 / 鉛筆 100円",
  ),
);

const d2Ren: AuthoredEncounter = {
  id: d2RenId,
  customerId: "ren",
  requestedItemId: "milk",
  intro: renSpiritIntro(),
  scan:
    "牛乳をスキャンすると210円が表示された。蓮は家族写真を裏返し、端に残る空白を確かめた。",
  recommendationOptions: [d2RenRecommendation],
  outcomes: {
    sell: ordinarySaleOutcome(
      `${d2RenId}_sell`,
      priceOf("milk"),
      copy("牛乳を渡した。", renSpiritReadback(), "牛乳　210円"),
    ),
    refuse: ordinaryRefusalOutcome(
      `${d2RenId}_refuse`,
      copy("牛乳の販売を断った。", renSpiritReadback(), "販売なし / 牛乳"),
    ),
    defaultRecommend: ordinaryDefaultRecommendationOutcome(
      `${d2RenId}_default_recommend`,
      priceOf("milk"),
      priceOf("pencil"),
      copy("牛乳に鉛筆を添えた。", renSpiritReadback(), "牛乳　210円 / 鉛筆　100円"),
    ),
  },
};

const d2MewId = "d2_mew_first";
const d2MewRecommendationGuide = recommendationOption(
  d2MewId,
  "tourist_guide",
  copy(
    "町を歩く案内として、観光ガイドを一冊すすめた。",
    "ミューは地図の余白を指でなぞり、知らない星の記号を確かめた。",
    "無重力カップ麺 420円 / 観光ガイド 680円",
  ),
);
const d2MewRecommendationPower = recommendationOption(
  d2MewId,
  "mobile_power_bank",
  copy(
    "電源を補えるよう、モバイル電源を一つすすめた。",
    "ミューは残量表示を見て、遠くへ連絡できるかもしれないと言った。",
    "無重力カップ麺 420円 / モバイル電源 1980円",
  ),
);

const d2Mew: AuthoredEncounter = {
  id: d2MewId,
  customerId: "mew",
  requestedItemId: "zero_gravity_cup_noodles",
  intro:
    "奇妙な衣装の旅行者が、無重力カップ麺をカウンターへ置いた。撮影用のコスプレだろうと考えれば、店内の明かりにもよく合っていた。",
  scan:
    "スキャン中、商品名の下に別の言語の字幕が一瞬だけ重なった。表示はすぐに日本語へ戻り、420円を示した。",
  recommendationOptions: [d2MewRecommendationGuide, d2MewRecommendationPower],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d2MewId}_sell`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      copy(
        "無重力カップ麺を渡した。",
        "ミューはふたを確かめ、湯気を落とさないように抱えて店を出た。",
        "無重力カップ麺　420円",
      ),
    ),
    refuse: abnormalRefusalOutcome(
      `${d2MewId}_refuse`,
      axisOf("mew"),
      copy(
        "無重力カップ麺の販売を断った。",
        "ミューは短い翻訳表示を残し、衣装の裾を整えて夜道へ戻った。",
        "販売なし / 無重力カップ麺",
      ),
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d2MewId}_default_recommend`,
      axisOf("mew"),
      priceOf("zero_gravity_cup_noodles"),
      priceOf("tourist_guide"),
      copy(
        "無重力カップ麺に観光ガイドを添えた。",
        "ミューは地図を開き、町の案内を読むふりをしながら空を見上げた。",
        "無重力カップ麺　420円 / 観光ガイド　680円",
      ),
    ),
  },
};

function hayakawaReturnNarrative(
  prefix: string,
  integrating: string,
  ravenous: string,
  desperate: string,
  fed: string,
  fallback: string,
): ConditionalNarrative {
  return stateNarrative(
    "hayakawa",
    [
      { id: `${prefix}_integrating`, state: "integrating", priority: 50, text: integrating },
      { id: `${prefix}_ravenous`, state: "ravenous", priority: 50, text: ravenous },
      { id: `${prefix}_desperate`, state: "desperate", priority: 50, text: desperate },
      { id: `${prefix}_fed`, state: "fed", priority: 40, text: fed },
    ],
    fallback,
  );
}

const d2HayakawaId = "d2_hayakawa_return";
const d2HayakawaRecommendationMask = recommendationOption(
  d2HayakawaId,
  "mask",
  copy(
    "人混みに戻れるよう、マスクを一つすすめた。",
    "早川はマスクをつけ、明日の出勤にも間に合うと言った。",
    "生肉おにぎり 260円 / マスク 140円",
  ),
);
const d2HayakawaRecommendationChicken = recommendationOption(
  d2HayakawaId,
  "counter_chicken",
  copy(
    "空腹を抑えるものとして、レジ横チキンを一つすすめた。",
    "早川はチキンの包みを受け取り、すぐに食べると言った。",
    "生肉おにぎり 260円 / レジ横チキン 230円",
  ),
);

const d2Hayakawa: AuthoredEncounter = {
  id: d2HayakawaId,
  customerId: "hayakawa",
  requestedItemId: "raw_meat_onigiri",
  intro: hayakawaReturnNarrative(
    "hayakawa_return_intro",
    "早川はマスクの位置を直し、昨夜より人の列に馴染んで見えた。生肉おにぎりを、今夜も季節限定だと説明する。",
    "早川はレジ横の匂いを追うように立ち、生肉おにぎりを急いでカウンターへ置いた。",
    "早川は空腹を隠すように笑い、生肉おにぎりを見つめた。明日の話はしなかった。",
    "早川の顔色は昨夜よりましに見えた。生肉おにぎりを手に取り、短い礼を言う。",
    "早川は昨夜と同じ包みを持ってきた。季節限定という説明だけが、昨日から変わらない。",
  ),
  scan:
    "POSは生肉おにぎりを受け付け、260円を表示した。早川は画面を見ず、マスクとレジ横のチキンを交互に見た。",
  recommendationOptions: [d2HayakawaRecommendationMask, d2HayakawaRecommendationChicken],
  outcomes: {
    sell: abnormalBaseSellOutcome(
      `${d2HayakawaId}_sell`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      copy(
        hayakawaReturnNarrative(
          "hayakawa_return_sell_result",
          "早川は包みを受け取り、人の列へ戻れるように歩き出した。",
          "早川は包みを開く前に、レジ横の匂いをもう一度確かめた。",
          "早川は何か言いかけたが、包みを抱えたまま頭を下げた。",
          "早川は昨夜より静かな顔で、明日の出勤時刻を確かめた。",
          "早川は包みをしまい、昨夜と同じ礼を言った。",
        ),
        hayakawaReturnNarrative(
          "hayakawa_return_sell_readback",
          "早川はマスクを直し、今夜は人の流れを乱さずに店を出た。",
          "早川は足早に出口へ向かい、包みを両手で押さえた。",
          "早川は空腹を抱えたまま、明かりの少ない道へ戻った。",
          "早川は落ち着いた声で礼を言い、夜道へ戻った。",
          "早川は振り返らず、入店ベルの下を通り過ぎた。",
        ),
        "生肉おにぎり　260円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
    refuse: abnormalRefusalOutcome(
      `${d2HayakawaId}_refuse`,
      axisOf("hayakawa"),
      copy(
        hayakawaReturnNarrative(
          "hayakawa_return_refuse_result",
          "早川は販売を断られ、マスクの下で短く息を吐いた。",
          "早川はレジ横のチキンから目を離せず、空の手を握った。",
          "早川は空腹を隠せないまま、販売を断られた包みを見つめた。",
          "早川は昨夜の礼を思い出すように黙り、店を出た。",
          "早川は販売を断られた理由を聞かず、包みを持って夜道へ戻った。",
        ),
        hayakawaReturnNarrative(
          "hayakawa_return_refuse_readback",
          "早川はマスクを握り、次の店を探すように歩いた。",
          "早川の足音は速く、空腹を知らせるように遠ざかった。",
          "早川の姿は角を曲がると見えなくなった。",
          "早川は一度だけ振り返り、静かに店を離れた。",
          "早川は夜道へ消え、レシートだけがカウンターに残った。",
        ),
        "販売なし / 生肉おにぎり",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "desperate" }],
    ),
    defaultRecommend: abnormalDefaultRecommendationOutcome(
      `${d2HayakawaId}_default_recommend`,
      axisOf("hayakawa"),
      priceOf("raw_meat_onigiri"),
      priceOf("mask"),
      copy(
        hayakawaReturnNarrative(
          "hayakawa_return_default_result",
          "早川はマスクを受け取り、生肉おにぎりと一緒に静かにしまった。",
          "早川はマスクより先に、レジ横チキンの包みを見た。",
          "早川はマスクを握り、空腹のままでも人目を避けられると言った。",
          "早川はマスクをつけ直し、昨夜よりましな顔で礼を言った。",
          "早川はマスクを受け取り、季節の変わり目には気をつけると言った。",
        ),
        hayakawaReturnNarrative(
          "hayakawa_return_default_readback",
          "早川はマスクをつけ、列の中へ自然に戻っていった。",
          "早川は包みを抱え、食事の場所を探すように店を出た。",
          "早川は何度も空腹を飲み込み、夜の端へ歩いていった。",
          "早川はマスクをポケットへ入れ、明日の予定を口にした。",
          "早川はマスクをしまい、昨日と同じ道へ戻った。",
        ),
        "生肉おにぎり　260円 / マスク　140円",
      ),
      [{ kind: "setCustomerState", customerId: "hayakawa", state: "fed" }],
    ),
  },
};

export const TASK4_DAY2_ENCOUNTERS: AuthoredEncounter[] = [
  d2Miyashita,
  d2Hako3,
  d2Construction,
  d2Ren,
  d2Mew,
  d2Hayakawa,
];
