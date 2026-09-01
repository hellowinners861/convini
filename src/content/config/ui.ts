/** Generic labels shared by later Task 4 screens; narrative copy lives in presentation.ts. */
export const TASK4_UI_LABELS = {
  briefing: {
    checklistHeading: "今夜の確認",
    workdayLabel: "勤務日",
    encounterCountLabel: "予定の接客",
    beginShiftAction: "勤務を始める",
  },
  encounter: {
    itemHeading: "レジに置かれた商品",
    itemNameLabel: "商品名",
    priceLabel: "価格",
    decisionHeading: "選択",
    scanAction: "スキャンする",
    scanRequired: "先に商品をスキャンしてください。",
    decisionAvailable: "決定は一度だけです。",
    decisionResolved: "この接客は確定しました。",
    sellAction: "売る",
    refuseAction: "断る",
    recommendAction: "おすすめする",
    recommendationLabel: "おすすめ商品",
    nextEncounterAction: "次の接客へ",
  },
  receipt: {
    resultHeading: "レシート / 結果",
    receiptLabel: "レシート情報",
    soldItemsLabel: "今回の販売商品",
    saleTotalLabel: "今回の販売合計",
    dailyRevenueLabel: "本日の売上",
  },
  shiftSummary: {
    nextActionLabel: "次の操作",
  },
} as const;

export const TASK4_ENCOUNTER_UI = TASK4_UI_LABELS.encounter;
export const TASK4_RECEIPT_UI = TASK4_UI_LABELS.receipt;
export const TASK4_BRIEFING_UI = TASK4_UI_LABELS.briefing;
export const TASK4_SHIFT_SUMMARY_UI = TASK4_UI_LABELS.shiftSummary;
export const UI_LABELS = TASK4_UI_LABELS;
