import type { NewsArticle } from "../../domain";
import { newsArticle } from "./helpers";

export const TASK5_DAY3_NEWS: NewsArticle[] = [
  newsArticle({
    id: "news_d3_direct_hotaru_photo",
    day: 3,
    role: "direct",
    notificationHeadline: "旧家の家族写真、四人を確認",
    headline: "旧家の写真は三人、空席は供養用",
    body: "現在の解説は空いた椅子を昔からの供養の習慣だとする。保存画像の反射には、白い境目の向こうに四人目の輪郭が残る。",
    conditions: {
      customerState: { customerId: "hotaru", state: "sealed" },
    },
    priority: 200,
    exclusiveGroup: "d3_boundary_collision",
    isFallback: false,
  }),
  newsArticle({
    id: "news_d3_direct_fallback",
    day: 3,
    role: "direct",
    notificationHeadline: "深夜店のPOS、特殊商品三件を処理",
    headline: "POS分類、今夜も『通常商品』のみ",
    body: "現在の台帳では乾電池、線香、カップ麺が通常商品として並ぶ。保存されたレシートには、同じバーコードへ見慣れない商品名が印字されている。",
    conditions: { true: true },
    priority: -100,
    isFallback: true,
  }),
  newsArticle({
    id: "news_d3_trend_system_collision",
    day: 3,
    role: "trend",
    notificationHeadline: "市、夜間サービスの分類指針を一本化",
    headline: "四部署、互いに両立しない住民区分を採用",
    body: "病院、配送、観光、戸籍が同じ住民を別の存在として登録し、受付順と住所が食い違い始めた。市は各記録が正しいとしている。",
    conditions: {
      numeric: { reference: "stability", operator: "lte", value: -6 },
    },
    priority: 200,
    exclusiveGroup: "d3_boundary_collision",
    isFallback: false,
  }),
  newsArticle({
    id: "news_d3_trend_fallback",
    day: 3,
    role: "trend",
    notificationHeadline: "市、夜間サービスの対象を据え置き",
    headline: "四つの夜間区分、試行運用を開始",
    body: "病院、配送、観光、戸籍は新しい利用者を扱う窓口を増やした。共通の案内には、相手の名前を確かめるよう追記されている。",
    conditions: { true: true },
    priority: -100,
    isFallback: true,
  }),
  newsArticle({
    id: "news_d3_discrepancy_hospital_history_fallback",
    day: 3,
    role: "discrepancy",
    notificationHeadline: "市立病院、1998年に開院",
    headline: "市立病院、開院百年を迎える",
    body: "記事は百年前から同じ場所に病院があると説明する。一方、今朝の新聞には1998年4月12日の日付と『開院百年』が同じ紙面に印刷されている。",
    conditions: { true: true },
    priority: -100,
    isFallback: true,
  }),
];

export const TASK5_NEWS_DAY3 = TASK5_DAY3_NEWS;
