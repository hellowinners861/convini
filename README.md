# 最後のコンビニ

終末へ向かう町の深夜コンビニを舞台に、レジで何を売り、何を断り、何をおすすめしたかによって世界線が変化するアドベンチャーゲーム。

5日間・29件の接客と15本のニュース記事を収録したMVPを、ローカルのPCブラウザで最初から最後までプレイできます。

## 設計資料

- [ゲーム設計書](docs/GAME_DESIGN.md)

## MVPの内容

- 5日間、29件の接客、各日3本・合計15本のニュース記事を収録
- 勤務後のスマホニュースで、接客による世界線の変化を伝える
- 分岐をシーンへ直書きせず、世界線スコア・フラグ・客の状態を参照するデータ駆動構成にする
- PCブラウザ向けのReact + TypeScriptによる2Dゲーム
- 詳細な技術・コンテンツ・アート方針は[実装設計書](docs/IMPLEMENTATION_BLUEPRINT.md)を基準とする

## はじめ方

Node.js 20.19 以上と npm を用意してから、リポジトリのルートで実行します。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、タイトル画面で「はじめから」を選ぶと5日間のMVPが始まります。各日の接客を終え、ニュース記事を3本読むと次の日へ進めます。Day 5の後に結末と周回結果を確認できます。

## 品質確認

```bash
npx playwright install chromium
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

`npm run check` は lint、型チェック、コンテンツ境界の検証、Unit test、build をまとめて実行します。
