import type { Condition, GameState } from "../domain";
import type { AuthoredEncounter, EncounterQuestion } from "./types";

export const CONNECTION_FLAGS = {
  repairQuestion: "asked_d3_hako3_repair",
  rescueQuestion: "asked_d4_mew_rescue",
  boundaryQuestion: "asked_d4_hotaru_boundary",
  delivery: "hospital_delivery_arranged",
  rescue: "hospital_evacuation_arranged",
  boundary: "family_boundary_protected",
} as const;

export const receiptFlag = (encounterId: string) => `receipt_${encounterId}`;
export const witnessFlag = (customerId: string) => `receipt_witness_${customerId}`;

const flag = (id: string): Condition => ({ flag: { id } });
const always: Condition = { true: true };

function question(
  encounterId: string,
  label: string,
  reply: string,
): EncounterQuestion {
  return { id: `asked_${encounterId}`, label, reply, conditions: always, effects: [] };
}

/** Small, authored conversations. Reading a question never applies a sale. */
const CONVERSATIONS: Record<string, readonly [string, string]> = {
  d1_taxi_baseline: ["今夜も長いんですか？", "「四時に病院の方を乗せるんです。時間だけは守らないとね」運転手は、ダッシュボードに挟むためのレシートを待っていた。"],
  d1_miyashita_baseline: ["病院の受付、何か変わりました？", "「夜間は二か所。東と西です。間違える方が多いから、覚えていてくれると助かります」宮下は指を二本立てた。"],
  d1_ren_only_child: ["写真の隣、少し空いていますね", "「撮るとき、そこを空けてって言われた気がするんです。誰にだったかな」蓮は余白を折らずにしまった。"],
  d1_hayakawa_first: ["明日も出勤なんですか？", "「顔色で帰らされると、父の入院費がね。せめて普通に電車に乗れたら」早川は口元を手で覆った。"],
  d1_hotaru_first: ["どなたに会いに行くんですか？", "「家にいた、小さい男の子。名前を呼んでくれたら帰れるの」ほたるは写真プリント機の明かりを見つめている。"],
  d2_miyashita_undead_echo: ["昨日の買い物、覚えていますか？", "「買ったことは。でも休憩室がどこだったか……紙に残る記録があれば、同僚にも確かめられるんですが」宮下はレジの時刻を手帳に写した。"],
  d2_hako3_first: ["自分で選ぶのは、初めてですか？", "「はい。部品を外せば自由になれる、と説明書には。自由になった後の手順は未記載です」HAKO-3は少女漫画の表紙にある、差し出された手を見た。"],
  d2_construction_sales_rule: ["朝までに終わりそうですか？", "「病院の搬入口だけでも開けたいんだ。物が来なけりゃ、いくら建物が立派でもな」軍手の指先は白く擦れていた。"],
  d2_ren_spirit_echo: ["写真の裏には何と書いてありますか？", "「『また明日』。僕の字じゃないんです」蓮はその三文字を消さずに、鉛筆で今日の日付を書き添えようとしている。"],
  d2_mew_first: ["お帰りの便はありますか？", "「電源があれば迎えを呼べます。ただ、母船へ座標を送ると、迎え以外も来ます」翻訳機は『迎え』を二通りの文字で表示した。"],
  d2_hayakawa_return: ["お父さんの具合は？", "「病院に電話すると、病棟の名前だけ毎回違うんです。父の名前は同じなのに」早川は着信履歴を何度も見直した。"],
  d3_elder_history: ["この日付、おかしくないですか？", "「おかしいと思うなら、捨てないことだ。新しい新聞ほど、昨日を上手に言い直す」老人は古い紙面だけをきれいに折った。"],
  d3_hako3_return: ["どこへ届ける荷物ですか？", "「市立病院です。車輪が空転しています。修理道具はありますか」HAKO-3は続けた。「昨日の私の判断を知る方なら、外してはいけない部品も一緒に決められます」"],
  d3_hotaru_return: ["家の前まで行けましたか？", "「玄関は見つかったの。でも私の後ろに、帰る家のない人が並ぶようになった」ほたるは店内の白い塩袋を見て、すぐ目をそらした。"],
  d3_miyashita_four_wards: ["今、一番足りないものは？", "「処置の物資です。配送が止まってから、あるはずの在庫だけが増えるんです」宮下は帳簿より、実際に届く一箱を待っている。"],
  d3_mew_return: ["母船以外も呼べるんですか？", "「小さな救助艇なら。ただし、迎えに行く場所を信じられる記録で指定する必要があります」ミューは地図より、レジから出てくる紙を気にしていた。"],
  d3_ren_evidence: ["紙に残すと、何が違うんでしょう", "「スマホの記事は変わるのに、この店の紙は変わらない。昨日ここにいた人に渡したら、その人も気づくかもしれません」蓮はレシートの店名に丸をつけた。"],
  d4_miyashita_triage: ["病院から避難できそうですか？", "「歩けない人を乗せられる車が足りません。空からでも迎えが来るなら、屋上を開けます」宮下は病院の住所を書いたメモを置いた。"],
  d4_hayakawa_coworkers: ["今日はお父さんのところへ？", "「同僚の買い物を済ませてから。病室に入れてもらえる顔で行きたいんです」早川は、見舞いに着るシャツの襟を直した。"],
  d4_hako3_network: ["仲間にも同じことを教えますか？", "「道具の使い方だけなら一秒です。なぜその部品を外さないのかは、まだ説明に時間がかかります」HAKO-3は配送箱を静かに抱え直した。"],
  d4_mew_arrivals: ["空の光は、誰のものですか？", "「母船です。町の座標を送れば降りてきます。救助艇だけを呼ぶ方法もありますが、地上の協力者が必要です」ミューは入口の向こうの空を見た。"],
  d4_hotaru_town_dead: ["後ろの人たちも、家に帰りたい？", "「うん。でもみんなを同じ家には入れられない。塩で私を閉じ込めたら、あの人たちは町じゅうに散ってしまう」ほたるは、線を引く場所が大事なのだと言った。"],
  d4_ren_human_anchor: ["忘れそうになったら、どうしますか？", "「この紙を読んで、それでも分からなかったらここに来ます。覚えている人が一人いれば、聞き直せるから」蓮はレシートを財布の透明な窓に入れるつもりらしい。"],
  d5_miyashita_convergence: ["今夜の勤務が終わったら？", "「朝ごはんを食べます。誰と食べるか、ちゃんと名前で呼べるうちに決めておきたいですね」宮下は少しだけ笑った。"],
  d5_hayakawa_final: ["明日も、いつもの時間ですか？", "「そのつもりです。父には帰りに寄ると伝えました。こんな夜に約束を増やすのも変ですけど」早川は時計を合わせた。"],
  d5_hako3_final: ["最後の配送先は？", "「ここです。受取人は、私に選ぶ理由を聞いた店員さん」HAKO-3は中身のない箱を置いた。「お礼を入れる方法が、まだ分かりません」"],
  d5_mew_final: ["この町で、一番よかった場所は？", "「ここ。どこへ行きたいか、初めて聞かれた場所です」ミューの翻訳機は、その一文だけ途切れなかった。"],
  d5_ren_photo: ["写真の余白はどうしますか？", "「残します。誰かを忘れても、忘れたことまで無かったことにはしたくないので」蓮は写真を、今度は表向きに置いた。"],
  d5_hotaru_final: ["最後に、伝えたいことは？", "「おつりは、また来たときでいい？」ほたるは小さな硬貨を置いた。約束にできる言葉を、まだ探しているようだった。"],
};

const SPECIAL_QUESTIONS: Record<string, EncounterQuestion> = {
  d3_hako3_return: {
    id: CONNECTION_FLAGS.repairQuestion,
    label: "車輪だけ直す約束をする",
    reply: "「車輪だけ。判断の回路は外さない。約束を記録しました」HAKO-3は修理箇所を指で示した。「精密ドライバーがあれば、病院への一箱を届けられます」",
    conditions: { any: [flag(witnessFlag("hako3")), { customerState: { customerId: "hako3", state: "empathetic" } }] },
    effects: [],
  },
  d4_mew_arrivals: {
    id: CONNECTION_FLAGS.rescueQuestion,
    label: "病院へ救助艇だけを呼べますか？",
    reply: "「あなたの渡したレシートと、病院の人の記録。二つの住所を道しるべにします」ミューは通信先を母船から切り替えた。「モバイル電源があれば、小さな救助艇だけを呼べます」",
    conditions: { all: [flag(witnessFlag("mew")), flag(witnessFlag("miyashita"))] },
    effects: [],
  },
  d4_hotaru_town_dead: {
    id: CONNECTION_FLAGS.boundaryQuestion,
    label: "塩の線を、家の外に引けますか？",
    reply: "「蓮が紙を持って、私の名前を呼んでくれるなら。私を閉じ込めずに、家を守る線にできる」ほたるは盛り塩を見直した。「同じ塩でも、どちら側に立つかで違うんだね」",
    conditions: { all: [flag(witnessFlag("ren")), { customerState: { customerId: "hotaru", state: "remembered" } }] },
    effects: [],
  },
};

const RECEIPT_REPLIES: Record<string, string> = {
  miyashita: "「日付と店の住所、助かります。病院の記録と一緒に取っておきますね」宮下は紙を手帳に挟んだ。",
  ren: "「これも写真と一緒に残しておきます」蓮は文字が消えないよう、丁寧に紙を折った。",
  hayakawa: "「明日、買ったものを忘れていたら教えてください」早川はレシートを社員証の後ろへ入れた。",
  hako3: "「外部記録を受領。記憶との照合に使用します」HAKO-3は紙を配送箱の透明ポケットへ差し込んだ。",
  mew: "「消えない住所ですね。あなたのいる場所を覚えます」ミューは店名を指でなぞった。",
  hotaru: "「紙なら、向こうにも持っていけるかな」ほたるが受け取ったレシートだけは、輪郭を失わなかった。",
};

export function attachConnections(encounter: AuthoredEncounter): AuthoredEncounter {
  const conversation = CONVERSATIONS[encounter.id];
  const special = SPECIAL_QUESTIONS[encounter.id];
  return {
    ...encounter,
    questions: [
      ...(special ? [special] : []),
      ...(conversation ? [question(encounter.id, ...conversation)] : []),
    ],
    ...(RECEIPT_REPLIES[encounter.customerId]
      ? { receiptReply: RECEIPT_REPLIES[encounter.customerId] }
      : {}),
  };
}

/** Echoes describe knowledge or a concrete event, never hidden world scores. */
export function connectionEcho(encounter: AuthoredEncounter, game: GameState): string | null {
  const has = (id: string) => game.flags.includes(id);
  if (encounter.id === "d3_miyashita_four_wards" && has(CONNECTION_FLAGS.delivery)) {
    return "宮下のスマホが鳴った。「物資の箱、こちらへ向かっているそうです。配送端末が、車輪だけ直したって。……それ、もしかしてあなたですか？」";
  }
  if (encounter.id === "d4_hayakawa_coworkers" && has(CONNECTION_FLAGS.delivery)) {
    return "「昨夜、物資が届いたおかげで父の病棟が閉まらずに済んだそうです」早川は言う。昨日のHAKO-3の配送先と、病院の名前が重なった。";
  }
  if (encounter.id === "d5_miyashita_convergence" && has(CONNECTION_FLAGS.rescue)) {
    return "「屋上に小さな艇が来ました。大きな船は降りてこなかった。歩けない人から乗せられました」宮下は、住所を書いた紙の控えを見せた。";
  }
  if (encounter.id === "d5_ren_photo" && has(CONNECTION_FLAGS.boundary)) {
    return "「家の外に白い線ができました。姉さんは内側で、ほかの人には別の帰り道を探すって」蓮は、二人の名前を書いたレシートを置いた。";
  }
  const priorReceipt = game.eventLog.some((event) =>
    event.type === "encounter.decision" && event.day < game.day &&
    event.data.customerId === encounter.customerId &&
    typeof event.data.encounterId === "string" && has(receiptFlag(event.data.encounterId)),
  );
  if (!priorReceipt) return null;
  const echoes: Record<string, string> = {
    miyashita: "「もらった紙の日付は変わらないのに、病院の記録だけ違う。私の勘違いじゃないですよね」宮下は、前の勤務のレシートを見せた。",
    ren: "「この紙を見ると、ここで話したことは思い出せるんです」蓮は以前のレシートを、写真の隣に並べた。",
    hayakawa: "「前にも来たんですよね。これがなかったら、初めてだと思っていた」早川は社員証の裏のレシートを確かめた。",
    hako3: "「内部記録と紙の記録に不一致があります。あなたとの会話を優先して照合します」HAKO-3は以前渡したレシートを広げた。",
    mew: "「空の地図が変わっても、この住所は変わりませんでした」ミューは以前のレシートを示した。「あなたの話なら、聞けます」",
    hotaru: "「この紙を持つと、この店に来たことは忘れないの」ほたるは、折り目のついたレシートを見せた。",
  };
  return echoes[encounter.customerId] ?? null;
}

export const CONNECTION_EPILOGUES = [
  { flag: CONNECTION_FLAGS.delivery, revealEncounter: "d4_hayakawa_coworkers", title: "一箱の行き先", body: "車輪だけを直したHAKO-3の配送が、宮下の病棟と早川の父をつないだ。レジで交わした約束は、買い物の外側まで届いていた。" },
  { flag: CONNECTION_FLAGS.rescue, revealEncounter: "d5_miyashita_convergence", title: "小さな迎え", body: "ミューが呼んだのは救助艇だった。病院の屋上とコンビニの住所が、紙の記録を通じて一つの帰り道になった。" },
  { flag: CONNECTION_FLAGS.boundary, revealEncounter: "d5_ren_photo", title: "線の内側", body: "ほたるを閉じ込めるはずだった塩は、家族の暮らす場所を守る線になった。蓮が持つレシートには、二人の名前が残っている。" },
] as const;

export const CONNECTION_UPDATES = [
  { day: 3, flag: CONNECTION_FLAGS.delivery, sender: "宮下 千春", text: "物資、届きました。車輪を直した配送端末が持ってきてくれました。今夜はこの病棟を閉めずに済みます。ありがとう。" },
  { day: 4, flag: CONNECTION_FLAGS.rescue, sender: "ミュー", text: "小さな救助艇と連絡がつきました。母船へは知らせていません。病院の屋上で、迎えを待つ人の名前を聞いています。" },
  { day: 4, flag: CONNECTION_FLAGS.boundary, sender: "大庭 蓮", text: "家の外の白い線、見えました。姉さんは中にいます。もらった紙を読んで、名前を呼べました。" },
] as const;

export const CONNECTION_HINTS: Record<number, string> = {
  1: "「ひとつ聞く」で事情を確かめてから会計できます。常連にはレシートも渡せます。気になる言葉は接客ノートに残ります。",
  2: "「昨日の紙、持ってる客がいたぞ。レシートも接客のうちってことだな」店長は補充したロール紙を指した。",
  3: "「同じ商品でも、今日の使い道まで同じとは限らないぞ」店長はレジ横の工具を並べ直した。",
  4: "「一人で済まない買い物が増えたな。誰に何が届くのか、一言確かめておけよ」",
  5: "「今日で終わりって顔をするなよ。また来る客には、また明日って言うんだ」",
};
