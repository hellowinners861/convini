import type { NewsArticle } from "../../domain";
import { newsArticle } from "./helpers";

export const TASK5_DAY4_NEWS: NewsArticle[] = [
  newsArticle({
    id: "news_d4_direct_four_systems",
    day: 4,
    role: "direct",
    notificationHeadline: "四つの夜間事業、別々の地区で拡大",
    headline: "救急・配送・到着場・慰霊所、同じ住所へ",
    body: "四事業の案内図がコンビニ前の一区画を同時に指定した。各部署は自分の地図だけが正式だとし、棚札と道路標識が重なっている。",
    conditions: {
      all: [
        {
          numeric: {
            reference: "strongAxisCount",
            operator: "gte",
            value: 3,
          },
        },
        {
          numeric: {
            reference: "stability",
            operator: "lte",
            value: -6,
          },
        },
      ],
    },
    priority: 200,
    exclusiveGroup: "d4_town_state",
    isFallback: false,
  }),
  newsArticle({
    id: "news_d4_direct_fallback",
    day: 4,
    role: "direct",
    notificationHeadline: "特殊用品の注文、個人利用分に限定",
    headline: "夜間用品四系統、町全体向けの発注へ切替",
    body: "食料、端末、到着案内、境界管理の注文単位が一人分から地域分へ変わった。商品名の欄だけは現在の記事から消え、今夜のレシートに残っている。",
    conditions: { true: true },
    priority: -100,
    isFallback: true,
  }),
  newsArticle({
    id: "news_d4_trend_coexistence",
    day: 4,
    role: "trend",
    notificationHeadline: "夜間窓口、対象ごとに分離",
    headline: "四つの夜間窓口、共通の名前確認を採用",
    body: "異なる利用者を扱う窓口が、最初に本人の名前と希望を確かめる手順で合意した。違う制度の境目に、小さな共通受付が残る。",
    conditions: {
      numeric: { reference: "stability", operator: "gte", value: 6 },
    },
    priority: 200,
    exclusiveGroup: "d4_town_state",
    isFallback: false,
  }),
  newsArticle({
    id: "news_d4_trend_fallback",
    day: 4,
    role: "trend",
    notificationHeadline: "市の収束予測、単一制度で安定",
    headline: "上位二制度、同じ町の規則を主張",
    body: "二つ以上の夜間制度が道路、病床、配送先を同時に更新している。明朝の基準は、今夜最後に確定した記録へ合わせるという。",
    conditions: { true: true },
    priority: -100,
    isFallback: true,
  }),
  newsArticle({
    id: "news_d4_discrepancy_first_train_fallback",
    day: 4,
    role: "discrepancy",
    notificationHeadline: "明朝の始発、通常ダイヤで運行",
    headline: "明朝欄、すべての時刻表から消失",
    body: "現在の案内は始発という言葉を使わず、次の便を『収束後に決定』としている。古いレシート裏の広告だけが、いつもの始発時刻を残す。",
    conditions: { true: true },
    priority: -100,
    isFallback: true,
  }),
];

export const TASK5_NEWS_DAY4 = TASK5_DAY4_NEWS;
