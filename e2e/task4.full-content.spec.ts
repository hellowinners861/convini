import { expect, test, type Page } from "@playwright/test";
import { getTask5Encounter, getTask5Item, TASK5_NEWS } from "../src/content";

const ENCOUNTER_COUNTS = [5, 6, 6, 6, 6] as const;

async function startDay(page: Page) {
  await page.goto("/convini/");
  await page.getByRole("button", { name: "はじめから" }).click();
  await expect(page.getByRole("heading", { name: "いつもの夜に、見慣れない商品" })).toBeVisible();
  await page.getByRole("button", { name: "勤務を始める" }).click();
  await expect(page.locator("[data-day]")).toHaveAttribute("data-day", "1");
}

async function scanAndSell(page: Page) {
  await page.getByRole("button", { name: "スキャンする" }).click();
  await page.getByRole("button", { name: "売る" }).click();
  const resultHeading = page.getByRole("heading", { name: "レシート / 結果" });
  const nextCustomer = page.getByRole("button", { name: "次の接客へ" });
  await expect(resultHeading).toBeVisible();
  await expect(resultHeading).toBeInViewport();
  await expect(nextCustomer).toBeInViewport();
}

async function readNewsAndAdvance(page: Page, day: number) {
  await page.getByRole("button", { name: "ニュースを開く" }).click();
  const articles = page.getByRole("article");
  await expect(articles).toHaveCount(3);

  const continueName = day === 5 ? "結末を見る" : `Day ${day + 1}へ進む`;
  const continueButton = page.getByRole("button", { name: continueName });
  await expect(continueButton).toBeDisabled();

  for (let articleIndex = 0; articleIndex < 3; articleIndex += 1) {
    const article = articles.nth(articleIndex);
    const notificationHeadline = await article.getByRole("heading", { level: 2 }).textContent();
    if (!notificationHeadline) {
      throw new Error("Task 5 article is missing its notification headline.");
    }
    const authoredArticle = TASK5_NEWS.find(
      (candidate) => candidate.notificationHeadline === notificationHeadline,
    );
    if (!authoredArticle) {
      throw new Error(`Unknown Task 5 notification headline: ${notificationHeadline}`);
    }

    await article.getByRole("button", { name: /^記事を開く:/ }).click();
    await expect(article.getByRole("heading", { name: authoredArticle.headline })).toBeVisible();
    await expect(article.getByText(authoredArticle.body, { exact: true })).toBeVisible();
    await expect(article.getByRole("button", { name: /^既読:/ })).toBeDisabled();
  }

  await expect(page.getByRole("status")).toContainText("開封済み: 3 / 3");
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}

test("keeps decisions behind the scan gate", async ({ page }) => {
  await startDay(page);

  const sell = page.getByRole("button", { name: "売る" });
  await expect(sell).toBeDisabled();
  await page.getByRole("button", { name: "スキャンする" }).click();
  await expect(sell).toBeEnabled();
});

test("supports filtered decision shortcuts and an accessible recommendation dialog", async ({ page }) => {
  await startDay(page);

  const sell = page.getByRole("button", { name: "売る", exact: true });
  await expect(sell).toBeDisabled();
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "スキャンする" }).click();
  await page.keyboard.press("1");
  await expect(page.getByRole("heading", { name: "レシート / 結果" })).toBeVisible();

  await page.getByRole("button", { name: "次の接客へ" }).click();
  await page.getByRole("button", { name: "スキャンする" }).click();
  await page.keyboard.press("2");
  await expect(page.getByText("今回の販売合計: 0円")).toBeVisible();

  await page.getByRole("button", { name: "次の接客へ" }).click();
  await scanAndSell(page);
  await page.getByRole("button", { name: "次の接客へ" }).click();
  await page.getByRole("button", { name: "スキャンする" }).click();
  await page.keyboard.press("3");

  const dialog = page.getByRole("dialog", { name: "おすすめ商品" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  const closeButton = dialog.getByRole("button", { name: "閉じる" });
  await expect(closeButton).toBeFocused();

  const hayakawa = getTask5Encounter("d1_hayakawa_first");
  const maskOption = hayakawa.recommendationOptions.find(
    (option) => option.itemId === "mask",
  );
  if (!maskOption) {
    throw new Error("Task 4 test catalog is missing the Hayakawa mask option.");
  }
  const recommendedItem = getTask5Item(maskOption.itemId);
  await expect(dialog).toContainText(recommendedItem.name);
  await expect(dialog).toContainText(`${recommendedItem.price}円`);
  await expect(dialog).toContainText(maskOption.description);

  await page.keyboard.press("1");
  await expect(dialog).toBeVisible();
  const dialogButtons = dialog.getByRole("button");
  await closeButton.press("Tab");
  await expect(dialogButtons.nth(1)).toBeFocused();
  await dialogButtons.last().focus();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialogButtons.last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "おすすめする", exact: true })).toBeFocused();

  await page.getByRole("button", { name: "おすすめする", exact: true }).click();
  await dialog.getByRole("button", { name: new RegExp(`^${recommendedItem.name}`) }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "レシート / 結果" })).toBeVisible();
});

test("completes the Task 5 run with 29 receipts, 15 articles, ending, and run summary", async ({ page }) => {
  await startDay(page);
  let completedReceipts = 0;

  for (const [dayIndex, encounterCount] of ENCOUNTER_COUNTS.entries()) {
    await expect(page.locator("[data-day]")).toHaveAttribute("data-day", String(dayIndex + 1));
    for (let encounterIndex = 0; encounterIndex < encounterCount; encounterIndex += 1) {
      await scanAndSell(page);
      completedReceipts += 1;
      await page.getByRole("button", { name: "次の接客へ" }).click();
    }

    await readNewsAndAdvance(page, dayIndex + 1);

    if (dayIndex < ENCOUNTER_COUNTS.length - 1) {
      await page.getByRole("button", { name: "勤務を始める" }).click();
    }
  }

  expect(completedReceipts).toBe(29);
  await expect(
    page.getByRole("heading", {
      name: /夜明けのない街|完全自動営業|最終便|街全体が彼岸|在庫混線/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "周回結果を見る" }).click();

  await expect(page.getByRole("heading", { name: "周回結果" })).toBeVisible();
  await expect(page.getByText("5夜")).toBeVisible();
  await expect(page.getByText("29組")).toBeVisible();
  await expect(page.getByText("15記事")).toBeVisible();
  await expect(page.getByText(/円$/)).toBeVisible();
  await expect(
    page.getByText(/夜明けのない街|完全自動営業|最終便|街全体が彼岸|在庫混線/),
  ).toBeVisible();

  await page.getByRole("button", { name: "タイトルへ戻る", exact: true }).click();
  await expect(page.getByRole("heading", { name: /最後の\s*コンビニ/ })).toBeVisible();
});
