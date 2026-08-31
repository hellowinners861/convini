import type { FixtureBriefing, FixtureDay2Placeholder, FixtureShiftSummary } from "./types";

// Task 3 fixture copy. Task 4 replaces this with authored content.
export const TASK3_BRIEFING: FixtureBriefing = {
  eyebrow: "DAY 1 / 仮設シフト",
  heading: "申し送り：いつもの夜を始める",
  body: "店長は、今夜は五組だけだと言った。レジの手順はいつも通り。商品名だけ、少し見慣れない。",
  checklist: ["商品をスキャンしてから選ぶ", "売る・断る・おすすめは一度だけ", "勤務後にニュースを三件読む"],
};

export const TASK3_SHIFT_SUMMARY: FixtureShiftSummary = {
  heading: "勤務終了 / レシートを確認",
  body: "五枚のレシートがカウンターに並んだ。店を出る前に、スマホへ届いたニュースを確認する。",
  nextAction: "ニュースを開く",
};

export const TASK3_DAY2_PLACEHOLDER: FixtureDay2Placeholder = {
  eyebrow: "DAY 2 / 仮エンドポイント",
  heading: "反復の夜は、次のタスクで始まる",
  body: "三件の記事を読み終えた。通知の時刻だけが、少しだけ昨日と違う。",
  note: "Task 3 fixture slice complete. Day 2 encounter content is reserved for a later task.",
};
