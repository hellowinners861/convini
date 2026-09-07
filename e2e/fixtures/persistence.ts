import { expect, type Locator, type Page } from "@playwright/test";

export const STORAGE_KEYS = {
  run: "last-convenience:run:v1",
  meta: "last-convenience:meta:v1",
  settings: "last-convenience:settings:v1",
} as const;

export type OwnedStorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const ENCOUNTER_COUNTS = [5, 6, 6, 6, 6] as const;

export interface PersistedPhaseSnapshot {
  kind: string;
  subPhase?: string;
  encounterId?: string;
  slotId?: string;
  endingId?: string;
}

export interface PersistedEventSnapshot {
  id: string;
  type: string;
  day: number;
  data: Record<string, string | number | boolean>;
}

export interface PersistedRunSnapshot {
  schemaVersion: number;
  contentVersion: string;
  runId: string;
  runNumber: number;
  day: number;
  phase: PersistedPhaseSnapshot;
  awareness: number;
  flags: string[];
  readNews: string[];
  resolvedQueue: string[];
  eventLog: PersistedEventSnapshot[];
  [key: string]: unknown;
}

export interface PersistedMetaSnapshot {
  schemaVersion: number;
  endingHistory: Array<{
    runId: string;
    runNumber: number;
    contentVersion: string;
    endingId: string;
  }>;
  newsHistory: Array<{
    runId: string;
    runNumber: number;
    contentVersion: string;
    day: number;
    newsId: string;
    status: "seen" | "read";
  }>;
  [key: string]: unknown;
}

export interface PersistedSettingsSnapshot {
  schemaVersion: number;
  audioMuted: boolean;
  [key: string]: unknown;
}

export const EMPTY_META: PersistedMetaSnapshot = {
  schemaVersion: 1,
  endingHistory: [],
  newsHistory: [],
};

export const MUTED_SETTINGS: PersistedSettingsSnapshot = {
  schemaVersion: 1,
  audioMuted: true,
};

export const ARCHIVED_META: PersistedMetaSnapshot = {
  schemaVersion: 1,
  endingHistory: [
    {
      runId: "archived-run",
      runNumber: 7,
      contentVersion: "archived-content-v0",
      endingId: "archived-ending",
    },
  ],
  newsHistory: [
    {
      runId: "archived-run",
      runNumber: 7,
      contentVersion: "archived-content-v0",
      day: 1,
      newsId: "archived-news",
      status: "seen",
    },
  ],
};

export async function readStorage(page: Page, key: OwnedStorageKey): Promise<string | null> {
  return page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
}

export async function readJson<T>(page: Page, key: OwnedStorageKey): Promise<T> {
  const raw = await readStorage(page, key);
  if (raw === null) {
    throw new Error(`Expected localStorage key ${key} to exist.`);
  }
  return JSON.parse(raw) as T;
}

export async function writeRaw(
  page: Page,
  key: OwnedStorageKey,
  value: string | null,
): Promise<void> {
  await page.evaluate(
    ({ storageKey, storageValue }) => {
      if (storageValue === null) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, storageValue);
      }
    },
    { storageKey: key, storageValue: value },
  );
}

export async function writeJson(
  page: Page,
  key: OwnedStorageKey,
  value: unknown,
): Promise<void> {
  await writeRaw(page, key, JSON.stringify(value));
}

export async function clearOwnedStorage(page: Page): Promise<void> {
  await page.evaluate((keys) => {
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }, Object.values(STORAGE_KEYS));
}

export async function openFreshTitle(page: Page): Promise<void> {
  await page.goto("/convini/");
  await expect(page.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
}

export async function startDayOne(page: Page): Promise<void> {
  await openFreshTitle(page);
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "いつもの夜に、見慣れない商品", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "勤務を始める", exact: true }).click();
  await expect(page.getByRole("button", { name: "スキャンする", exact: true })).toBeVisible();
}

export async function sellCurrentEncounter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "スキャンする", exact: true }).click();
  await page.getByRole("button", { name: "売る", exact: true }).click();
  await expect(page.getByRole("region", { name: "レシート / 結果", exact: true })).toBeVisible();
}

export async function advanceEncounter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "次の接客へ", exact: true }).click();
}

export async function openNews(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "勤務の記録", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ニュースを開く", exact: true }).click();
  await expect(page.getByRole("heading", { name: "勤務後のニュース", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
}

export function newsAdvanceButton(page: Page, day: number): Locator {
  const name = day === 5 ? "結末を見る" : `Day ${day + 1}へ進む`;
  return page.getByRole("button", { name, exact: true });
}

export async function readNewsArticles(page: Page, count = 3): Promise<void> {
  for (let articleIndex = 0; articleIndex < count; articleIndex += 1) {
    const article = page.getByRole("article").nth(articleIndex);
    await article.getByRole("button", { name: /^記事を開く:/ }).click();
    await expect(article.getByRole("button", { name: /^既読:/ })).toBeDisabled();
  }
  await expect(page.getByRole("status")).toContainText(`開封済み: ${count} / 3`);
}

export async function newsCardTexts(page: Page): Promise<string[]> {
  const articles = page.getByRole("article");
  const count = await articles.count();
  const texts: string[] = [];
  for (let articleIndex = 0; articleIndex < count; articleIndex += 1) {
    texts.push((await articles.nth(articleIndex).innerText()).trim());
  }
  return texts;
}

export async function reloadAndContinue(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByRole("heading", { name: /^最後の\s*コンビニ$/ })).toBeVisible();
  await page.getByRole("button", { name: "つづきから", exact: true }).click();
}

export async function completeDayOneToNews(page: Page): Promise<void> {
  await startDayOne(page);
  for (let encounterIndex = 0; encounterIndex < ENCOUNTER_COUNTS[0]; encounterIndex += 1) {
    await sellCurrentEncounter(page);
    await advanceEncounter(page);
  }
  await openNews(page);
}

export async function completeRunToEnding(page: Page): Promise<void> {
  await startDayOne(page);

  for (const [dayIndex, encounterCount] of ENCOUNTER_COUNTS.entries()) {
    for (let encounterIndex = 0; encounterIndex < encounterCount; encounterIndex += 1) {
      await sellCurrentEncounter(page);
      await advanceEncounter(page);
    }

    await openNews(page);
    await readNewsArticles(page);

    if (dayIndex < ENCOUNTER_COUNTS.length - 1) {
      await newsAdvanceButton(page, dayIndex + 1).click();
      await expect(page.getByRole("button", { name: "勤務を始める", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "勤務を始める", exact: true }).click();
    } else {
      await newsAdvanceButton(page, 5).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }
}
