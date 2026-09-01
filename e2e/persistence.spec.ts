import { expect, test } from "@playwright/test";
import {
  ARCHIVED_META,
  completeDayOneToNews,
  completeRunToEnding,
  MUTED_SETTINGS,
  newsAdvanceButton,
  newsCardTexts,
  readJson,
  readNewsArticles,
  readStorage,
  reloadAndContinue,
  startDayOne,
  STORAGE_KEYS,
  type PersistedMetaSnapshot,
  type PersistedRunSnapshot,
  writeJson,
  writeRaw,
} from "./fixtures/persistence";

function expectHistoryExactlyOnce(meta: PersistedMetaSnapshot, runId?: string): void {
  expect(meta.endingHistory).toHaveLength(1);
  expect(meta.newsHistory).toHaveLength(15);
  expect(new Set(meta.endingHistory.map((entry) => entry.runId)).size).toBe(1);
  expect(new Set(meta.newsHistory.map((entry) => `${entry.runId}:${entry.newsId}`)).size).toBe(15);
  if (runId !== undefined) {
    expect(meta.endingHistory[0].runId).toBe(runId);
    expect(meta.newsHistory.every((entry) => entry.runId === runId)).toBe(true);
  }
}

test("restores an encounter result checkpoint and resumes the next encounter", async ({ page }) => {
  await startDayOne(page);
  const firstEncounterHeading = await page.getByRole("heading", { level: 1 }).innerText();

  await page.getByRole("button", { name: "スキャンする", exact: true }).click();
  await page.getByRole("button", { name: "売る", exact: true }).click();
  const receipt = await page
    .getByRole("region", { name: "レシート / 結果", exact: true })
    .innerText();
  const checkpoint = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  const nextEncounterId = checkpoint.resolvedQueue[1];
  if (!nextEncounterId) {
    throw new Error("The first day must have a second resolved encounter.");
  }

  const expectedPage = await page.context().newPage();
  await expectedPage.goto("/");
  await expect(expectedPage.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
  await expectedPage.getByRole("button", { name: "つづきから", exact: true }).click();
  await expectedPage.getByRole("button", { name: "次の接客へ", exact: true }).click();
  const expectedNextEncounterHeading = await expectedPage
    .getByRole("heading", { level: 1 })
    .innerText();
  await expectedPage.close();

  await reloadAndContinue(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstEncounterHeading);
  await expect(page.getByRole("region", { name: "レシート / 結果", exact: true })).toBeVisible();
  expect(
    await page.getByRole("region", { name: "レシート / 結果", exact: true }).innerText(),
  ).toBe(receipt);

  await page.getByRole("button", { name: "次の接客へ", exact: true }).click();
  await expect(page.getByRole("button", { name: "スキャンする", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(expectedNextEncounterHeading);
  expect((await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run)).resolvedQueue).toEqual(
    checkpoint.resolvedQueue,
  );
});

test("preserves three selected notifications with zero articles read and keeps the gate closed", async ({ page }) => {
  await completeDayOneToNews(page);
  const beforeReload = await newsCardTexts(page);
  await expect(newsAdvanceButton(page, 1)).toBeDisabled();

  await reloadAndContinue(page);
  await expect(page.getByRole("status")).toContainText("開封済み: 0 / 3");
  expect(await newsCardTexts(page)).toEqual(beforeReload);
  await expect(newsAdvanceButton(page, 1)).toBeDisabled();
});

test("preserves one read article, two remaining notifications, and the closed gate", async ({ page }) => {
  await completeDayOneToNews(page);
  await readNewsArticles(page, 1);
  const beforeReload = await newsCardTexts(page);
  await expect(page.getByRole("status")).toContainText("開封済み: 1 / 3");
  await expect(newsAdvanceButton(page, 1)).toBeDisabled();

  await reloadAndContinue(page);
  await expect(page.getByRole("status")).toContainText("開封済み: 1 / 3");
  expect(await newsCardTexts(page)).toEqual(beforeReload);
  await expect(page.getByRole("article").nth(0).getByRole("button", { name: /^既読:/ })).toBeDisabled();
  await expect(page.getByRole("article").nth(1).getByRole("button", { name: /^記事を開く:/ })).toBeEnabled();
  await expect(page.getByRole("article").nth(2).getByRole("button", { name: /^記事を開く:/ })).toBeEnabled();
  await expect(newsAdvanceButton(page, 1)).toBeDisabled();
});

test("preserves two read articles, the remaining notification, and the closed gate", async ({ page }) => {
  await completeDayOneToNews(page);
  await readNewsArticles(page, 2);
  const beforeReload = await newsCardTexts(page);
  await expect(page.getByRole("status")).toContainText("開封済み: 2 / 3");
  await expect(newsAdvanceButton(page, 1)).toBeDisabled();

  await reloadAndContinue(page);
  await expect(page.getByRole("status")).toContainText("開封済み: 2 / 3");
  expect(await newsCardTexts(page)).toEqual(beforeReload);
  await expect(page.getByRole("article").nth(0).getByRole("button", { name: /^既読:/ })).toBeDisabled();
  await expect(page.getByRole("article").nth(1).getByRole("button", { name: /^既読:/ })).toBeDisabled();
  await expect(page.getByRole("article").nth(2).getByRole("button", { name: /^記事を開く:/ })).toBeEnabled();
  await expect(newsAdvanceButton(page, 1)).toBeDisabled();
});

test("allows advance after all three reads without replaying effects or duplicating meta", async ({ page }) => {
  await completeDayOneToNews(page);
  await readNewsArticles(page);
  const runBeforeReload = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  const metaBeforeReload = await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta);
  const eventLogBeforeReload = runBeforeReload.eventLog;
  const readNewsBeforeReload = runBeforeReload.readNews;
  await expect(newsAdvanceButton(page, 1)).toBeEnabled();

  await reloadAndContinue(page);
  await expect(page.getByRole("status")).toContainText("開封済み: 3 / 3");
  expect(await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run)).toEqual(runBeforeReload);
  expect(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta)).toEqual(metaBeforeReload);
  await expect(newsAdvanceButton(page, 1)).toBeEnabled();

  await newsAdvanceButton(page, 1).click();
  await expect(page.getByRole("heading", { name: "昨日のレシートを、もう一度", exact: true })).toBeVisible();
  const runAfterAdvance = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  expect(runAfterAdvance.readNews).toEqual(readNewsBeforeReload);
  expect(runAfterAdvance.eventLog).toEqual(eventLogBeforeReload);
  expect(runAfterAdvance.awareness).toBe(runBeforeReload.awareness);
  expect(runAfterAdvance.flags).toEqual(runBeforeReload.flags);
  expect(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta)).toEqual(metaBeforeReload);
});

test("restores the same ending without duplicating ending or news meta", async ({ page }) => {
  await completeRunToEnding(page);
  const endingHeading = await page.getByRole("heading", { level: 1 }).innerText();
  const endingContent = await page.locator("main").innerText();
  const runBeforeReload = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  const metaBeforeReload = await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta);
  expect(runBeforeReload.phase.kind).toBe("ending");
  expect(runBeforeReload.eventLog.filter((event) => event.id === `${runBeforeReload.runId}:ending`)).toHaveLength(1);
  expectHistoryExactlyOnce(metaBeforeReload, runBeforeReload.runId);

  await reloadAndContinue(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(endingHeading);
  expect(await page.locator("main").innerText()).toBe(endingContent);
  const runAfterReload = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  expect(runAfterReload.phase).toEqual(runBeforeReload.phase);
  expect(runAfterReload.eventLog).toEqual(runBeforeReload.eventLog);
  expect(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta)).toEqual(metaBeforeReload);
  expectHistoryExactlyOnce(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta), runBeforeReload.runId);
});

test("restores runSummary and starts round two while keeping histories exactly once", async ({ page }) => {
  await completeRunToEnding(page);
  await page.getByRole("button", { name: "周回結果を見る", exact: true }).click();
  await expect(page.getByRole("heading", { name: "周回結果", exact: true })).toBeVisible();
  const summaryContent = await page.locator("main").innerText();
  const firstRun = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  const firstMeta = await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta);
  expect(firstRun.phase.kind).toBe("runSummary");
  expectHistoryExactlyOnce(firstMeta, firstRun.runId);

  await reloadAndContinue(page);
  await expect(page.getByRole("heading", { name: "周回結果", exact: true })).toBeVisible();
  expect(await page.locator("main").innerText()).toBe(summaryContent);
  expect((await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run)).runId).toBe(firstRun.runId);
  expect(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta)).toEqual(firstMeta);

  await page.getByRole("button", { name: "次の周回へ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "いつもの夜に、見慣れない商品", exact: true })).toBeVisible();
  const secondRun = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  expect(secondRun.runId).not.toBe(firstRun.runId);
  expect(secondRun.runNumber).toBe(2);
  expect(secondRun.day).toBe(1);
  expect(secondRun.phase).toEqual({ kind: "briefing" });
  expect(secondRun.resolvedQueue).toEqual([]);
  expect(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta)).toEqual(firstMeta);
  expectHistoryExactlyOnce(await readJson<PersistedMetaSnapshot>(page, STORAGE_KEYS.meta), firstRun.runId);
});

test("blocks Continue for corrupt run JSON and explicitly clears only the run key", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
  await writeRaw(page, STORAGE_KEYS.run, "{not valid JSON");
  await writeJson(page, STORAGE_KEYS.meta, ARCHIVED_META);
  await writeJson(page, STORAGE_KEYS.settings, MUTED_SETTINGS);
  const unrelatedKey = "test:unrelated-persistence-data";
  const unrelatedValue = "preserve-across-run-recovery";
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: unrelatedKey, value: unrelatedValue },
  );
  const metaBeforeClear = await readStorage(page, STORAGE_KEYS.meta);
  const settingsBeforeClear = await readStorage(page, STORAGE_KEYS.settings);

  await page.reload();
  await expect(page.getByRole("heading", { name: "保存データを確認できません", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "つづきから", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "進行データを削除して再確認", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
  expect(await readStorage(page, STORAGE_KEYS.run)).toBeNull();
  expect(await readStorage(page, STORAGE_KEYS.meta)).toBe(metaBeforeClear);
  expect(await readStorage(page, STORAGE_KEYS.settings)).toBe(settingsBeforeClear);
  expect(await page.evaluate((key) => localStorage.getItem(key), unrelatedKey)).toBe(unrelatedValue);
  await expect(page.getByRole("button", { name: "はじめから", exact: true })).toBeVisible();
});

test("requires run-key clear for a strict unknown field and preserves meta and settings", async ({ page }) => {
  await startDayOne(page);
  const validRun = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  expect(validRun.phase.kind).toBe("encounter");
  await writeJson(page, STORAGE_KEYS.meta, ARCHIVED_META);
  await writeJson(page, STORAGE_KEYS.settings, MUTED_SETTINGS);
  const metaBeforeClear = await readStorage(page, STORAGE_KEYS.meta);
  const settingsBeforeClear = await readStorage(page, STORAGE_KEYS.settings);
  await writeJson(page, STORAGE_KEYS.run, { ...validRun, unexpectedField: "strict-recovery-check" });

  await page.reload();
  await expect(page.getByRole("heading", { name: "保存データを確認できません", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "進行データを削除して再確認", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "進行データを削除して再確認", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
  expect(await readStorage(page, STORAGE_KEYS.run)).toBeNull();
  expect(await readStorage(page, STORAGE_KEYS.meta)).toBe(metaBeforeClear);
  expect(await readStorage(page, STORAGE_KEYS.settings)).toBe(settingsBeforeClear);
});

test("automatically removes only an incompatible run and offers a fresh start", async ({ page }) => {
  await startDayOne(page);
  const validRun = await readJson<PersistedRunSnapshot>(page, STORAGE_KEYS.run);
  await writeJson(page, STORAGE_KEYS.meta, ARCHIVED_META);
  await writeJson(page, STORAGE_KEYS.settings, MUTED_SETTINGS);
  const metaBeforeReload = await readStorage(page, STORAGE_KEYS.meta);
  const settingsBeforeReload = await readStorage(page, STORAGE_KEYS.settings);
  await writeJson(page, STORAGE_KEYS.run, { ...validRun, contentVersion: "incompatible-content-v0" });

  await page.reload();
  await expect(page.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
  await expect(
    page.getByText("現在の内容と互換性がないため、新しい周回が必要です", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "つづきから", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "はじめから", exact: true })).toBeVisible();
  expect(await readStorage(page, STORAGE_KEYS.run)).toBeNull();
  expect(await readStorage(page, STORAGE_KEYS.meta)).toBe(metaBeforeReload);
  expect(await readStorage(page, STORAGE_KEYS.settings)).toBe(settingsBeforeReload);
});
