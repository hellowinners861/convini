import type { DailyPresentation, BriefingPresentation, ShiftSummaryPresentation } from "../types";

/** Final manager copy for each of the five authored shifts. */
export const TASK4_DAILY_PRESENTATIONS: DailyPresentation[] = [
  {
    day: 1,
    briefing: {
      eyebrow: "DAY 1 / 違和感",
      heading: "いつもの夜に、見慣れない商品",
      body:
        "店長はレジを整えながら、今夜はいつもの客が中心だと申し送った。棚には季節限定らしい商品もあるが、まずは名前と値段を確かめて、普段どおりに接客すればいい。",
      checklist: ["商品名と価格を確認する", "スキャン後に一度だけ選択する", "勤務後にニュースを開く"],
    },
    shiftSummary: {
      heading: "勤務終了 / 小さな食い違い",
      body:
        "レシートをそろえると、見慣れた商品の中に説明しづらい名前が混じっていた。店内の明かりは変わらないまま、スマートフォンには今夜の結果を示す通知が届いている。",
      nextAction: "ニュースを開く",
    },
  },
  {
    day: 2,
    briefing: {
      eyebrow: "DAY 2 / 反復",
      heading: "昨日のレシートを、もう一度",
      body:
        "店長は昨夜の売上を確認し、同じ客が別の様子で戻るかもしれないと告げた。配送箱や見慣れない表示が増えても、レジの手順と売上の確認だけは変えない。",
      checklist: ["昨日の接客を思い出す", "新しい商品の用途を読む", "売上と店長への申し送りを確認する"],
    },
    shiftSummary: {
      heading: "勤務終了 / 通知と本文のずれ",
      body:
        "保存された通知と、開いた記事の文章が同じ出来事を指しているようには見えない。戻ってきた客の言葉をレシートの横に置き、次の勤務で確かめる材料を残した。",
      nextAction: "次の勤務へ進む",
    },
  },
  {
    day: 3,
    briefing: {
      eyebrow: "DAY 3 / 検証",
      heading: "レシートに、因果の印をつける",
      body:
        "店長は、昨日までの売上を細かく追及しなかった。その代わり、四つの棚で商品の並びが違うことを示し、接客の結果を記録して自分で比べるよう促した。",
      checklist: ["通知と記事の差を見比べる", "商品と客の組み合わせを記録する", "レシートの変化を確かめる"],
    },
    shiftSummary: {
      heading: "勤務終了 / 検証の手応え",
      body:
        "レシートの余白に残した印は、偶然では片づけにくい並びになった。病院、学校、配送の話まで同じ夜に揺れていることを、次の勤務でも見落とさないようにする。",
      nextAction: "次の勤務へ進む",
    },
  },
  {
    day: 4,
    briefing: {
      eyebrow: "DAY 4 / 介入",
      heading: "町の未来へ、商品を渡す",
      body:
        "店長は棚の前で、個人の困りごとだった商品が町全体の選択になりつつあると話した。売上だけでは決められない夜だからこそ、客が何を望んでいるかを聞いてから手を伸ばす。",
      checklist: ["客の目的を最後まで聞く", "共存と暴走の違いを考える", "選択の結果をレシートへ残す"],
    },
    shiftSummary: {
      heading: "勤務終了 / 介入のあと",
      body:
        "今夜は一つの商品が一人の客だけでなく、町の暮らしへ届く手応えがあった。安定した棚と不自然な棚の両方を見渡し、最後の勤務へ申し送る。",
      nextAction: "次の勤務へ進む",
    },
  },
  {
    day: 5,
    briefing: {
      eyebrow: "DAY 5 / 収束",
      heading: "最後の勤務を始める",
      body:
        "店長は開店前のレジを一度だけ確認し、今夜は客の順番がいつもと違うかもしれないと告げた。積み重ねた接客を思い出し、目の前の一人へ最後まで丁寧に商品を渡す。",
      checklist: ["開始時の棚とレシートを確認する", "客の順番を受け入れる", "最後の判断を記録する"],
    },
    shiftSummary: {
      heading: "勤務終了 / 朝を待つレジ",
      body:
        "最後のレシートをカウンターへ置くと、五日分の選択が静かな店内に重なった。蛍光灯とレジ音は変わらず、今夜の勤務はここで終わる。",
      nextAction: "勤務を終える",
    },
  },
];

export const TASK4_MANAGER_BRIEFINGS: BriefingPresentation[] = TASK4_DAILY_PRESENTATIONS.map(
  (presentation) => presentation.briefing,
);
export const TASK4_SHIFT_SUMMARIES: ShiftSummaryPresentation[] = TASK4_DAILY_PRESENTATIONS.map(
  (presentation) => presentation.shiftSummary,
);

export const MANAGER_BRIEFINGS = TASK4_MANAGER_BRIEFINGS;
export const SHIFT_SUMMARIES = TASK4_SHIFT_SUMMARIES;
export const DAILY_PRESENTATIONS = TASK4_DAILY_PRESENTATIONS;
