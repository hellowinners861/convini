import type { CustomerDefinition } from "../types";

/** The complete Task 4 cast used by the authored encounters. */
export const TASK4_CUSTOMERS: CustomerDefinition[] = [
  {
    id: "hayakawa",
    name: "早川 誠",
    description:
      "青白い顔を疲れのせいにして、生肉おにぎりを季節限定だと説明する会社員。空腹を抱えながらも、明日の出勤を続けたいと思っている。",
    axis: "undead",
    role: "major",
  },
  {
    id: "hako3",
    name: "HAKO-3",
    description:
      "配送箱を抱えて立つ配送ロボット。決められた経路を守りながら、自分で選ぶ理由を探している。",
    axis: "machine",
    role: "major",
  },
  {
    id: "mew",
    name: "ミュー",
    description:
      "翻訳表示のわずかな乱れを連れて現れる旅行者。地球を観光地として見るのか、帰還の手がかりとして見るのかは定まっていない。",
    axis: "cosmic",
    role: "major",
  },
  {
    id: "hotaru",
    name: "ほたる",
    description:
      "入店音だけを残して立つ幽霊の少女。失われた家族の記憶に触れ、もう一度名前を呼ばれることを願っている。",
    axis: "spirit",
    role: "major",
  },
  {
    id: "miyashita",
    name: "宮下 千春",
    description:
      "夜勤の合間に短く買い物をする救急看護師。病院の受け入れ先と、誰を救えるのかの変化を静かに記録している。",
    role: "major",
  },
  {
    id: "ren",
    name: "大庭 蓮",
    description:
      "家族写真の話になると、知らない空席を思い出す高校生。初めは一人っ子だと信じているが、身近な記録の食い違いに気づき始める。",
    role: "major",
  },
  {
    id: "manager",
    name: "店長",
    description:
      "深夜の店を預かり、仕入れと売上を淡々と管理する店長。見慣れない商品にも業務用の説明を添え、次の勤務の手がかりを渡す。",
    role: "staff",
  },
  {
    id: "taxi_driver",
    name: "夜勤タクシー運転手",
    description:
      "信号と到着時刻を気にしながら、眠気覚ましの商品を選ぶ夜勤の運転手。短い休憩にも、決まった手順を崩さない。",
    role: "incidental",
  },
  {
    id: "construction_worker",
    name: "工事作業員",
    description:
      "夜間工事の休憩中に、弁当と軍手を手に取る作業員。朝までの工程と仲間の分の食事を気にかけている。",
    role: "incidental",
  },
  {
    id: "elder",
    name: "老人",
    description:
      "古い新聞の日付を確かめながら、町の昔話を自然に語る老人。本人にとって当然の歴史が、レシートの記憶と少しだけ食い違っている。",
    role: "incidental",
  },
];

export const CUSTOMERS = TASK4_CUSTOMERS;
export const CUSTOMER_CATALOG = TASK4_CUSTOMERS;
