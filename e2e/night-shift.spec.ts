import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const counts = [5, 6, 6, 6, 6];
async function capture(page: Page, path: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true });
}
async function recommend(page: Page, product: string) {
  await page.getByRole("button", { name: "おすすめする", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${product}`) }).click();
}
async function readNews(page: Page) {
  await page.getByRole("button", { name: "ニュースを開く", exact: true }).click();
  for (const article of await page.getByRole("article").all()) {
    await article.getByRole("button", { name: /^記事を開く:/ }).click();
    await expect(article.getByText("保存された通知", { exact: true })).toBeVisible();
  }
}

test("six night-shift features connect across all five days and survive a reload", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/convini/");
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.getByRole("button", { name: "防犯カメラ", exact: true }).click();
  await expect(page.getByText("防犯カメラで気づいたこと", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "窓の外", exact: true })).toBeDisabled();
  await page.getByRole("region", { name: "レジを離れて、少しだけ。" }).screenshot({ path: testInfo.outputPath("quiet-night.png") });

  for (let day = 1; day <= 5; day += 1) {
    await page.getByRole("button", { name: "勤務を始める", exact: true }).click();
    for (let index = 0; index < counts[day - 1]; index += 1) {
      await page.getByRole("button", { name: "スキャンする", exact: true }).click();
      let sold = false;
      if (day === 1 && index === 4) {
        await page.getByRole("button", { name: /^店の袋に入れる/ }).click();
      }
      if (day === 2 && index === 1) {
        await recommend(page, "精密ドライバー");
        sold = true;
      }
      if (day === 2 && index === 3) {
        await page.getByRole("button", { name: /^「明日も、蓮くん」と約束する/ }).click();
      }
      if (day === 2 && index === 5) {
        await page.getByRole("button", { name: /^常温のまま渡す/ }).click();
      }
      if (day === 3 && index === 1) {
        await page.getByText("保存した仮説を見せる（1件）", { exact: true }).click();
        await page.getByRole("button", { name: "この記録を見せる", exact: true }).click();
        await expect(page.getByText(/二人の記憶が、レシートの同じ行/)).toBeVisible();
        await page.getByRole("button", { name: /^修理伝票について聞く/ }).click();
        await capture(page, testInfo.outputPath("purpose-and-evidence.png"));
        await recommend(page, "精密ドライバー");
        sold = true;
        await expect(page.getByText(/まず薬品冷蔵庫を直します/)).toBeVisible();
        await page.reload();
        await page.getByRole("button", { name: "つづきから", exact: true }).click();
        await expect(page.getByText(/まず薬品冷蔵庫を直します/)).toBeVisible();
      }
      if (day === 3 && index === 4) {
        await page.getByRole("button", { name: /^病院用に取り置く/ }).click();
        await page.getByRole("button", { name: "おすすめする", exact: true }).click();
        await expect(page.getByRole("dialog").getByRole("button", { name: /^モバイル電源/ })).toBeDisabled();
        await page.getByRole("button", { name: "閉じる", exact: true }).click();
      }
      if (day === 3 && index === 5) {
        await page.getByRole("button", { name: /^「蓮くん、おかえり」/ }).click();
        await expect(page.getByText(/僕も、その名前を覚えてる/)).toBeVisible();
      }
      if (day === 4 && index === 0) {
        await page.getByRole("button", { name: /^電源も会計に加える/ }).click();
      }
      if (!sold) await page.getByRole("button", { name: "売る", exact: true }).click();
      await expect(page.getByRole("heading", { name: "レシート / 結果", exact: true })).toBeVisible();
      if (day === 4 && index === 0) {
        await expect(page.getByText("今回の販売合計: 2160円", { exact: true })).toBeVisible();
        await expect(page.getByText(/取り置きの電源を宮下へ渡した/)).toBeVisible();
        await capture(page, testInfo.outputPath("hospital-receipt.png"));
      }
      await page.getByRole("button", { name: "次の接客へ", exact: true }).click();
    }
    await readNews(page);
    if (day === 2) {
      await page.getByRole("combobox", { name: "比較する記事", exact: true }).selectOption("news_d2_direct_hako3_self_repair");
      await page.getByRole("combobox", { name: "照合するレシート", exact: true }).selectOption({ label: "Day 2 / HAKO-3 / 自我対応乾電池" });
      await page.getByRole("button", { name: "この組み合わせを仮説にする", exact: true }).click();
      await expect(page.getByRole("button", { name: "この仮説を保存済み", exact: true })).toBeDisabled();
      await capture(page, testInfo.outputPath("evidence-notebook.png"));
      const a11y = await new AxeBuilder({ page }).analyze();
      expect(a11y.violations).toEqual([]);
    }
    await page.getByRole("button", { name: day === 5 ? "結末を見る" : `Day ${day + 1}へ進む`, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "「蓮くん、おかえり」", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "工具の使い道", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最後の一個は、病院へ", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "白い袋の帰り道", exact: true })).toBeVisible();
  await capture(page, testInfo.outputPath("personal-ending.png"));
  expect(errors).toEqual([]);
});

test("night observations and counter choices fit a narrow screen and support keyboard focus", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/convini/");
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.getByRole("button", { name: "レジ横の棚", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("レジ横の棚で気づいたこと", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "勤務を始める", exact: true }).click();
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "スキャンする", exact: true }).click();
    await page.getByRole("button", { name: "売る", exact: true }).click();
    await page.getByRole("button", { name: "次の接客へ", exact: true }).click();
  }
  await page.getByRole("button", { name: "スキャンする", exact: true }).click();
  await page.getByRole("button", { name: /^店の袋に入れる/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/ほたるは持ち手を確かめた/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture(page, testInfo.outputPath("mobile-counter.png"));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
