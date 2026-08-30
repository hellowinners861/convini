import type { NewsArticle } from "../../domain";

// Task 3 fixture copy. Each article is an unconditional fallback by design.
export const TASK3_NEWS: NewsArticle[] = [
  {
    id: "task3-news-direct",
    day: 1,
    role: "direct",
    notificationHeadline: "深夜店で五件のレシート",
    headline: "夜間営業の利用者、五組を記録",
    body: "昨夜の小さな店舗で、通常より多いレシートが確認された。店側は通常営業としている。",
    conditions: { true: true },
    priority: 10,
    effectsOnRead: [
      { kind: "add", target: "awareness", amount: 1 },
      { kind: "setFlag", id: "task3-read-direct" },
    ],
    isFallback: true,
  },
  {
    id: "task3-news-trend",
    day: 1,
    role: "trend",
    notificationHeadline: "市内の夜勤人口に小さな変化",
    headline: "夜間の移動記録、集計方法を変更",
    body: "夜勤に関する統計の集計方法が今夜から変わる。変更理由は公開されていない。",
    conditions: { true: true },
    priority: 10,
    effectsOnRead: [
      { kind: "add", target: "awareness", amount: 1 },
      { kind: "setFlag", id: "task3-read-trend" },
    ],
    isFallback: true,
  },
  {
    id: "task3-news-discrepancy",
    day: 1,
    role: "discrepancy",
    notificationHeadline: "時刻表示に一分のずれ",
    headline: "市内の時計、同じ時刻を表示",
    body: "複数の時計が同じ時刻を示した一方、スマートフォンの通知履歴には別の時刻が残った。",
    conditions: { true: true },
    priority: 10,
    effectsOnRead: [
      { kind: "add", target: "awareness", amount: 1 },
      { kind: "setFlag", id: "task3-read-discrepancy" },
    ],
    isFallback: true,
  },
];
