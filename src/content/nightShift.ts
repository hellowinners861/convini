import type { Day, Effect } from "../domain";
import type { Narrative } from "./types";

export interface NightChoice {
  id: string;
  label: string;
  hint: string;
  reply: string;
  effects?: Effect[];
  saleEffects?: Effect[];
  receipt?: string;
}

export interface CounterMoment {
  id: string;
  encounterId: string;
  title: string;
  prompt: string;
  requiresFlag?: string;
  choices: NightChoice[];
}

export const NIGHT_FLAGS = {
  bag: "night:bag-carried",
  heated: "night:heated-onigiri",
  promise: "night:name-promised",
  nameKept: "night:name-kept",
  nameLost: "night:name-lost",
  repair: "night:repair-mission",
  repaired: "night:hospital-repaired",
  reserved: "night:power-reserved",
  released: "night:power-released",
  powerMew: "night:power-mew",
  powerHospital: "night:power-hospital",
} as const;

const flag = (id: string): Effect => ({ kind: "setFlag", id });
const stability = (amount: number): Effect => ({ kind: "add", target: "stability", amount });

export const COUNTER_MOMENTS: CounterMoment[] = [
  {
    id: "ghost-bag", encounterId: "d1_hotaru_first", title: "袋にお入れしますか？",
    prompt: "ほたるの手は商品をすり抜ける。でも、この店の袋に触れた指先だけは、影がある。「家まで持って帰りたいの」",
    choices: [
      { id: "bag", label: "店の袋に入れる", hint: "袋の持ち手なら、つかめそうだ。", reply: "「これなら、落とさずに帰れるね」ほたるは持ち手を確かめた。", saleEffects: [flag(NIGHT_FLAGS.bag), stability(1)], receipt: "袋 0円 / ほたるは袋を握り、ドアの外へ一歩を踏み出した。" },
      { id: "hand", label: "そのまま渡す", hint: "いつものように、商品だけを渡す。", reply: "ほたるは両手をそろえた。「ゆっくり歩いてみる」", receipt: "袋なし / 商品の影だけが、カウンターに少し残った。" },
    ],
  },
  {
    id: "warm-onigiri", encounterId: "d2_hayakawa_return", title: "あたためますか？",
    prompt: "包装の裏に小さく「常温で封を保つ。加熱すると香りが周囲へ広がります」。早川は外の同僚を見て、「みんな、まだ夕飯を食べていないんです」と言った。",
    choices: [
      { id: "cold", label: "常温のまま渡す", hint: "香りを包みの中に留めておく。", reply: "「職場に着くまで、開けずにおきます」", saleEffects: [stability(1)], receipt: "加熱なし / 封をしたまま、早川はおにぎりを胸ポケットへしまった。" },
      { id: "warm", label: "電子レンジで温める", hint: "温かい食事。ただし、香りは店の外にも届く。", reply: "レンジが鳴る前に、駐車場の人影が一斉にこちらを向いた。", saleEffects: [flag(NIGHT_FLAGS.heated), stability(-1), { kind: "add", target: "world.undead", amount: 1 }], receipt: "加熱済み / 退店した早川の後ろに、同僚たちが静かに列を作った。" },
    ],
  },
  {
    id: "name-promise", encounterId: "d2_ren_spirit_echo", title: "明日も、同じ名前で",
    prompt: "蓮は名札を隠して、小声で言う。「写真だけじゃない。自分の名前まで、知らないものになりそうで。明日も、蓮って呼んでくれる？」",
    choices: [
      { id: "promise", label: "「明日も、蓮くん」と約束する", hint: "レシートの余白に「大庭 蓮」と書き留める。", reply: "「よかった。ここに来れば、確かめられるんだね」", effects: [flag(NIGHT_FLAGS.promise)] },
      { id: "listen", label: "今夜は、話を聞いておく", hint: "自分にも何が起きているのか分からない。", reply: "「うん。覚えている間だけでも、いいから」蓮は名札をしまった。" },
    ],
  },
  {
    id: "repair-purpose", encounterId: "d3_hako3_return", title: "今夜は、何に使いますか？",
    prompt: "HAKO-3の配送箱には、病院の修理伝票が挟まっている。昨日の買い物と、今夜の用事は同じだろうか。",
    choices: [
      { id: "ask", label: "修理伝票について聞く", hint: "商品を決める前に、今夜の目的を確かめる。", reply: "「薬品冷蔵庫の端子が緩んでいます。精密ドライバーがあれば直せます。今夜は、自分の改造には使いません」", effects: [flag(NIGHT_FLAGS.repair)] },
      { id: "usual", label: "いつもの配送について話す", hint: "HAKO-3自身の困りごとを聞く。", reply: "「自分で経路を選ぶか、誰かの気持ちを学ぶか。まだ迷っています」" },
    ],
  },
  {
    id: "last-power", encounterId: "d3_mew_return", title: "モバイル電源、最後の一個",
    prompt: "棚の電源は一個。宮下から「次の夜勤の初めに、薬を運ぶ保冷箱用の電源を買いに来る」と伝言がある。ミューは「これがあれば帰還艇の到着灯を直せる」と言う。次の入荷は明夜の二便目。宮下の出発には間に合わない。",
    choices: [
      { id: "reserve", label: "病院用に取り置く", hint: "今夜は、ミューへの電源のおすすめができなくなる。", reply: "電源に「宮下さま」と書いた紙を貼った。ミューは観光ガイドの地図を開き、今夜の泊まり先を探し始めた。", effects: [flag(NIGHT_FLAGS.reserved)] },
      { id: "shelf", label: "棚に残し、接客で決める", hint: "ミューに電源をおすすめすると、この一個を販売する。", reply: "取り置き札は付けずにおいた。今この人に渡すかどうかを、レジで決める。" },
    ],
  },
  {
    id: "remember-name", encounterId: "d3_ren_evidence", title: "名札には「大庭 律」",
    requiresFlag: NIGHT_FLAGS.promise,
    prompt: "制服の名札は「大庭 律」。けれど、昨日のレシートには自分の字で「大庭 蓮」とある。少年は、こちらが口を開くのを待っている。",
    choices: [
      { id: "ren", label: "「蓮くん、おかえり」", hint: "昨日の約束と、残っている記録を信じる。", reply: "「……ただいま」少年は名札を裏返した。「僕も、その名前を覚えてる」", effects: [flag(NIGHT_FLAGS.nameKept), stability(1)] },
      { id: "ritsu", label: "「律くん、こんばんは」", hint: "今の名札に書かれた名前で呼ぶ。", reply: "少年は一度だけ笑った。「そっか。こっちが、今の僕なんだね」", effects: [flag(NIGHT_FLAGS.nameLost)] },
    ],
  },
  {
    id: "hospital-power", encounterId: "d4_miyashita_triage", title: "保冷箱の電源を、受け取りに",
    prompt: "宮下が保冷箱をカウンターへ置く。「昨夜お願いした電源、まだありますか。薬を別の病棟へ運びたいんです」",
    choices: [
      { id: "deliver", label: "電源も会計に加える", hint: "販売時に1,980円を加算し、最後の一個を病院へ渡す。", reply: "「ありがとう。冷蔵庫から先も、薬を冷やしたまま運べます」" },
      { id: "release", label: "電源は棚に戻す", hint: "取り置きを解除する。ほかの客に販売できる。", reply: "「分かりました。保冷剤を集めて、短い距離ずつ運んでみます」", effects: [flag(NIGHT_FLAGS.released)] },
    ],
  },
];

export interface NightSpot {
  id: "window" | "camera" | "shelf";
  label: string;
  finding: Narrative;
}

export interface QuietNight {
  time: string;
  atmosphere: string;
  spots: NightSpot[];
}

export const QUIET_NIGHTS: Record<Day, QuietNight> = {
  1: { time: "00:18", atmosphere: "冷蔵庫の低い音。自動ドアの向こうには、まだいつもの町がある。", spots: [
    { id: "window", label: "窓の外", finding: "駅前時計は0時18分。スマホの写真にも写しておいた。明日、同じ時刻の記録を比べてみよう。" },
    { id: "camera", label: "防犯カメラ", finding: "店の白い袋だけが、誰もいない通路をゆっくり動いている。袋の持ち手には、小さな指の影がある。" },
    { id: "shelf", label: "レジ横の棚", finding: "生肉おにぎりの裏に「加熱すると香りが周囲へ広がります」。温める前に、客が誰と食べるのか聞いておこう。" },
  ] },
  2: { time: "01:42", atmosphere: "入店ベルの余韻が、いつもより一音だけ長い。", spots: [
    { id: "window", label: "窓の外", finding: "工場の作業員たちが弁当を待っている。早川の同僚だろうか。誰も、湯気から目を離さない。" },
    { id: "camera", label: "防犯カメラ", finding: "昨日の少年の名札は「大庭 蓮」。再生位置を動かすと一瞬「律」に変わる。POSの客名メモは、蓮のままだ。" },
    { id: "shelf", label: "レジ横の棚", finding: "ドライバーの広告には「自分を直す。誰かの設備も直す」。同じ道具でも、使う目的まではバーコードに書いていない。" },
  ] },
  3: { time: "02:16", atmosphere: "店内放送が途切れた。数秒だけ、町全体の電気の音が消える。", spots: [
    { id: "window", label: "窓の外", finding: "病院の薬品庫だけが暗い。掲示には「冷蔵庫の端子修理を依頼中」。配送ロボットの足跡が、病院と店を往復している。" },
    { id: "camera", label: "防犯カメラ", finding: "制服の少年が、名札を手で隠して入ってくる。録画を止めると「律」。印刷した昨日のレシートには「蓮」。" },
    { id: "shelf", label: "レジ横の棚", finding: "モバイル電源は残り一個。宮下からの伝言は「明夜の最初に、保冷箱用を買いに来ます」。次の入荷は明夜の二便目。宮下の出発には間に合わない。" },
  ] },
  4: { time: "03:08", atmosphere: "空が少し白い。夜明けなのか、病院の非常灯なのか、まだ分からない。", spots: [
    { id: "window", label: "窓の外", finding: { variants: [
      { id: "night-repaired-window", condition: { flag: { id: NIGHT_FLAGS.repaired } }, priority: 10, text: "病院の薬品庫に灯りが戻っている。窓際でHAKO-3が、小さなドライバーを布で拭いていた。" },
    ], fallback: "病院の窓に保冷剤の箱が積まれている。看護師が交代で箱を運ぶ。直せる設備も、まだ残っている。" } },
    { id: "camera", label: "防犯カメラ", finding: { variants: [
      { id: "night-bag-camera", condition: { flag: { id: NIGHT_FLAGS.bag } }, priority: 10, text: "白い袋を持ったほたるが、横断歩道の向こうで手を振っている。袋はあの日のまま。行ける場所は、少し増えた。" },
    ], fallback: "自動ドアの前に、小さな影だけが立っている。店内のものと外のもの、その境目を確かめているようだ。" } },
    { id: "shelf", label: "レジ横の棚", finding: { variants: [
      { id: "night-name-shelf", condition: { flag: { id: NIGHT_FLAGS.nameKept } }, priority: 10, text: "レシートの余白に「蓮」の一文字。誰かがその下へ「ただいま」と書き足している。" },
    ], fallback: "忘れ物の名札に「律」。引き出しのレシートには別の名前。どちらも捨てずに、同じ封筒へ入れた。" } },
  ] },
  5: { time: "04:52", atmosphere: "いつもの入店ベル。五日分のレシート。あと少しだけ、この店を開けておく。", spots: [
    { id: "window", label: "窓の外", finding: { variants: [
      { id: "night-power-window", condition: { flag: { id: NIGHT_FLAGS.powerHospital } }, priority: 10, text: "宮下の保冷箱に、あの電源がつながっている。町の形は変わっても、今朝の薬は次の病棟へ届いた。" },
      { id: "night-mew-window", condition: { flag: { id: NIGHT_FLAGS.powerMew } }, priority: 9, text: "上空に到着灯が一つ戻った。店で売った電源が、あそこまで届いたらしい。光の下で誰かが帰り道を探している。" },
    ], fallback: "配送トラックが着いた。電源の在庫を確かめて受領印を押す。いつでも買えると思っていた一個にも、間に合う時刻と間に合わない時刻がある。" } },
    { id: "camera", label: "防犯カメラ", finding: "録画の片隅に、この五日間ずっと同じ店員がいる。制服も、名札も同じ。自分が覚えていることを、今日の接客に使おう。" },
    { id: "shelf", label: "レジ横の棚", finding: "店長のメモ。「世界が変わっても、取り置きと約束は引き継いでください」。下にいつもどおり、廃棄の時刻が書いてある。" },
  ] },
};

export const NIGHT_COPY = {
  repairIntro: "HAKO-3は病院の修理伝票を広げた。「薬品冷蔵庫の端子を締め直します。今夜は自分の改造ではありません。必要なのは精密ドライバーです」",
  repairResult: "HAKO-3はドライバーを修理伝票の横へ固定した。「まず薬品冷蔵庫を直します。この工具を、誰かのために使います」",
  repairReceipt: "用途確認済み / 病院の薬品冷蔵庫を修理",
  repairReadback: "配送箱に工具が収まった。夜明けまでに端子を締め直せるという。修理の結果は、次の夜に確かめよう。",
  repairMangaResult: "HAKO-3は漫画を大切にしまった。「気持ちは学べます。でも、冷蔵庫のねじを締める工具はまだありません」",
  repairMangaReadback: "修理伝票は未完了のまま残った。今夜の目的を知ったうえで、別の助け方を選んだ。",
  powerGone: "最後の電源はミューに販売済み。宮下は空の棚を見て、「保冷剤を集めて運びます」と保冷箱を閉じた。",
  powerDelivered: "取り置きの電源を宮下へ渡した。保冷箱の表示が点き、薬を冷やしたまま運べるようになった。",
  powerRefused: "会計を断ったため、電源は渡していない。取り置き札を外し、棚へ戻した。",
  heatedEcho: "早川は「昨夜の香りで、同僚まで食事を探し始めて。今日は一人ずつ渡します」と、包みの口を押さえた。",
  bagEcho: "ほたるは、あの白い袋を握っている。「昨日は、交差点の向こうまで行けたよ」",
  nameKeptEcho: "「蓮です。ただいま」名札はまだ律のまま。でも少年は、こちらが呼ぶ前に自分の名前を言えた。",
  nameLostEcho: "「律です」少年は名札を示した。レシートの「蓮」を見ると、思い出せない歌を聞いたような顔をした。",
  evidenceConfirmed: "「その記録、覚えています。通知のほうが、あの夜の出来事に近い」二人の記憶が、レシートの同じ行を指した。世界が変わった証拠が一つ増えた。",
  evidenceUncertain: "「この買い物は覚えています。でも、この記事とつながるかはまだ分かりません」仮説のまま、記録を残すことにした。",
};

export const NIGHT_EPILOGUES: Array<{ flag: string; title: string; body: string }> = [
  { flag: NIGHT_FLAGS.nameKept, title: "「蓮くん、おかえり」", body: "最後の勤務を終える前、少年がもう一度来た。名札を見ずに名前を呼ぶと、「ただいま」と答えた。レシートの余白の約束は、まだ消えていない。" },
  { flag: NIGHT_FLAGS.nameLost, title: "レシートに残った名前", body: "少年は律と名乗るようになった。「蓮」と書いたレシートは、忘れ物の引き出しに残した。いつか本人が、その名前を探しに来るかもしれない。" },
  { flag: NIGHT_FLAGS.bag, title: "白い袋の帰り道", body: "窓の外を、白い袋がゆっくり遠ざかる。ほたるが今日どこまで歩けるかは分からない。それでも、カウンターから外へ出るための持ち手を渡せた。" },
  { flag: NIGHT_FLAGS.repaired, title: "工具の使い道", body: "HAKO-3から修理完了の伝票が届いた。薬品冷蔵庫の端子交換、異常なし。自分を変えることのできた道具で、誰かの暮らしを保つこともできた。" },
  { flag: NIGHT_FLAGS.powerHospital, title: "最後の一個は、病院へ", body: "宮下は空になった薬の保冷箱を見せてくれた。「必要な病棟まで、運び切りました」。電源の充電表示は、まだ一目盛り残っていた。" },
  { flag: NIGHT_FLAGS.powerMew, title: "最後の一個は、空へ", body: "ミューの帰還艇に到着灯が戻った。一つの帰り道を灯した電源。その夜、病院では保冷剤を運ぶ人たちが、何度も階段を往復した。" },
];
