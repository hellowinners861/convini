import { expect, test } from "@playwright/test";

test("remembers a conversation and a handed receipt across reloads", async ({ page }) => {
  await page.goto("/convini/");
  await page.getByRole("button", { name: "はじめから" }).click();
  await page.getByRole("button", { name: "勤務を始める" }).click();
  await page.getByRole("button", { name: "今夜も長いんですか？" }).click();
  await expect(page.getByText(/四時に病院の方/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "つづきから" }).click();
  await expect(page.getByText(/四時に病院の方/)).toBeVisible();
  await expect(page.getByRole("button", { name: "売る" })).toBeDisabled();

  await page.getByRole("button", { name: "スキャンする" }).click();
  await page.getByRole("button", { name: "売る" }).click();
  await page.getByRole("button", { name: "次の接客へ" }).click();
  await page.getByRole("button", { name: "スキャンする" }).click();
  await page.getByRole("button", { name: "売る" }).click();
  await page.getByRole("button", { name: "レシートも渡す" }).click();
  await expect(page.getByText(/宮下は紙を手帳に挟んだ/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "つづきから" }).click();
  await expect(page.getByText(/宮下は紙を手帳に挟んだ/)).toBeVisible();
  await expect(page.getByRole("button", { name: "レシートも渡す" })).toHaveCount(0);

  await page.getByText("接客ノート", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "レシートを渡した人" })).toBeVisible();
  await expect(page.getByText("DAY 1 · 宮下 千春 · お渡し済み", { exact: true })).toBeVisible();
});

test("keeps the conversation and notebook usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/convini/");
  await page.getByRole("button", { name: "はじめから" }).click();
  await page.getByRole("button", { name: "勤務を始める" }).click();
  await page.getByRole("button", { name: "今夜も長いんですか？" }).click();
  await page.getByText("接客ノート", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "レジ越しに聞いたこと" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
