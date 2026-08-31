import type { OrdinaryItemDefinition } from "../types";

/** Ordinary shelf stock. Photos and receipts remain presentation props, not items. */
export const TASK4_ORDINARY_ITEMS: OrdinaryItemDefinition[] = [
  {
    id: "black_coffee",
    kind: "ordinary",
    name: "黒コーヒー",
    description: "深煎りの香りが残る、夜勤の合間に飲みやすい黒コーヒー。",
    price: 180,
  },
  {
    id: "mint_gum",
    kind: "ordinary",
    name: "ミントガム",
    description: "口の中をさっぱりさせる、小袋入りのミントガム。",
    price: 120,
  },
  {
    id: "sandwich",
    kind: "ordinary",
    name: "サンドイッチ",
    description: "野菜と具材を柔らかなパンではさんだ、夜食向けのサンドイッチ。",
    price: 320,
  },
  {
    id: "milk",
    kind: "ordinary",
    name: "牛乳",
    description: "冷蔵棚から出したばかりの、すっきりした甘さの牛乳。",
    price: 210,
  },
  {
    id: "pencil",
    kind: "ordinary",
    name: "鉛筆",
    description: "書き込みにも会計の印にも使える、削りたての鉛筆。",
    price: 100,
  },
  {
    id: "bento",
    kind: "ordinary",
    name: "弁当",
    description: "主菜とご飯を一つにまとめた、温めてもそのままでも食べられる弁当。",
    price: 580,
  },
  {
    id: "work_gloves",
    kind: "ordinary",
    name: "軍手",
    description: "夜間作業の手を守る、丈夫な布製の軍手。",
    price: 390,
  },
  {
    id: "newspaper",
    kind: "ordinary",
    name: "新聞",
    description: "朝の情報を先取りする、地域欄付きの新聞。",
    price: 180,
  },
];

export const ORDINARY_ITEMS = TASK4_ORDINARY_ITEMS;
export const ORDINARY_ITEM_CATALOG = TASK4_ORDINARY_ITEMS;
