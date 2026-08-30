// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getTask5Encounter, getTask5Item, TASK5_ENDING_RECORDS, TASK5_NEWS } from "../src/content";
import { App } from "../src/app/App";
import type { StorageLike } from "../src/app/persistence";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

let nextRunId = 0;

function renderApp() {
  const storage = new MemoryStorage();
  nextRunId += 1;
  render(
    <App
      storage={storage}
      runIdFactory={() => `integration-run-${nextRunId}`}
    />,
  );
}

afterEach(() => {
  cleanup();
});

function startDay() {
  fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
  expect(screen.getByRole("heading", { name: "いつもの夜に、見慣れない商品" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
}

function scanAndReview() {
  fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
  fireEvent.click(screen.getByRole("button", { name: "スキャン結果を確認" }));
}

function sellCurrentEncounter() {
  scanAndReview();
  fireEvent.click(screen.getByRole("button", { name: "売る" }));
}

function finishDayWithSales(encounterCount: number) {
  for (let encounterIndex = 0; encounterIndex < encounterCount; encounterIndex += 1) {
    sellCurrentEncounter();
    fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
  }
}

function readCurrentNews() {
  const articles = screen.getAllByRole("article");
  expect(articles).toHaveLength(3);

  const continueButton = screen.getByRole("button", {
    name: /^(Day [2-5]へ進む|結末を見る)$/,
  });
  expect((continueButton as HTMLButtonElement).disabled).toBe(true);

  for (const article of articles) {
    fireEvent.click(within(article).getByRole("button", { name: /^記事を開く:/ }));
  }

  expect(screen.getByRole("status").textContent).toContain("開封済み: 3 / 3");
  expect((continueButton as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: continueButton.textContent ?? "" }));
}

describe("Task 5 React vertical slice", () => {
  it("starts on the authored Day 1 briefing and keeps selling behind scan review", () => {
    renderApp();
    startDay();

    expect(screen.getByRole("heading", { name: "夜勤タクシー運転手" })).toBeTruthy();
    const sellButton = screen.getByRole("button", { name: "売る" });
    expect((sellButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
    expect((sellButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "スキャン結果を確認" }));
    expect((sellButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sellButton);

    const firstEncounter = getTask5Encounter("d1_taxi_baseline");
    expect(screen.getByText(firstEncounter.outcomes.sell.copy.result as string)).toBeTruthy();
    expect(screen.getByLabelText("レシート情報").textContent).toContain(
      firstEncounter.outcomes.sell.copy.receipt as string,
    );
    expect(screen.getByText("黒コーヒー / 180円")).toBeTruthy();
    expect(screen.getByText("今回の販売合計: 180円")).toBeTruthy();
    expect(screen.getByText("本日の売上: 180円")).toBeTruthy();
    expect(screen.getByText(firstEncounter.outcomes.sell.copy.readback as string)).toBeTruthy();
  });

  it("uses the canonical abnormal recommendation item and charges the two-item basket", () => {
    renderApp();
    startDay();

    for (let encounterIndex = 0; encounterIndex < 3; encounterIndex += 1) {
      sellCurrentEncounter();
      fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    }

    expect(screen.getByRole("heading", { name: "早川 誠" })).toBeTruthy();
    scanAndReview();
    fireEvent.click(screen.getByRole("button", { name: "おすすめする" }));

    const hayakawa = getTask5Encounter("d1_hayakawa_first");
    const maskOption = hayakawa.recommendationOptions.find(
      (option) => option.itemId === "mask",
    );
    if (!maskOption) {
      throw new Error("Task 4 test catalog is missing the Hayakawa mask option.");
    }
    const requestedItem = getTask5Item(hayakawa.requestedItemId);
    const recommendedItem = getTask5Item(maskOption.itemId);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${recommendedItem.name}`) }));

    expect(screen.getByText(maskOption.resultCopy.result as string)).toBeTruthy();
    expect(screen.getByText(maskOption.resultCopy.receipt as string)).toBeTruthy();
    expect(screen.getByText(`${requestedItem.name} / ${requestedItem.price}円`)).toBeTruthy();
    expect(screen.getByText(`${recommendedItem.name} / ${recommendedItem.price}円`)).toBeTruthy();
    expect(screen.getByText("今回の販売合計: 400円")).toBeTruthy();
    expect(screen.getByText("本日の売上: 1110円")).toBeTruthy();
  });

  it("filters decision shortcuts and traps the accessible recommendation dialog", () => {
    renderApp();
    startDay();

    const sellButton = screen.getByRole("button", { name: "売る" });
    const refuseButton = screen.getByRole("button", { name: "断る" });
    const recommendButton = screen.getByRole("button", { name: "おすすめする" });
    expect((sellButton as HTMLButtonElement).disabled).toBe(true);
    expect((refuseButton as HTMLButtonElement).disabled).toBe(true);
    expect((recommendButton as HTMLButtonElement).disabled).toBe(true);
    expect(sellButton.querySelector('[aria-hidden="true"]')?.textContent).toBe("1");
    expect(refuseButton.querySelector('[aria-hidden="true"]')?.textContent).toBe("2");
    expect(recommendButton.querySelector('[aria-hidden="true"]')?.textContent).toBe("3");

    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "2" });
    fireEvent.keyDown(document, { key: "3" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("heading", { name: "レシート / 結果" })).toBeNull();

    scanAndReview();
    const editable = document.createElement("input");
    document.body.appendChild(editable);
    fireEvent.keyDown(editable, { key: "1" });
    editable.remove();
    fireEvent.keyDown(document, { key: "1", ctrlKey: true });
    fireEvent.keyDown(document, { key: "2", altKey: true });
    fireEvent.keyDown(document, { key: "3", metaKey: true });
    fireEvent.keyDown(document, { key: "1", shiftKey: true });
    fireEvent.keyDown(document, { key: "2", repeat: true });
    const defaultPreventedEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "1",
    });
    defaultPreventedEvent.preventDefault();
    document.dispatchEvent(defaultPreventedEvent);
    expect(screen.queryByRole("heading", { name: "レシート / 結果" })).toBeNull();

    fireEvent.keyDown(document, { key: "1" });
    expect(screen.getByRole("heading", { name: "レシート / 結果" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    scanAndReview();
    fireEvent.keyDown(document, { key: "2" });
    expect(screen.getByRole("heading", { name: "レシート / 結果" })).toBeTruthy();
    expect(screen.getByText("今回の販売合計: 0円")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    sellCurrentEncounter();
    fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
    scanAndReview();
    fireEvent.keyDown(document, { key: "3" });

    const dialog = screen.getByRole("dialog", { name: "おすすめ商品" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const closeButton = within(dialog).getByRole("button", { name: "閉じる" });
    expect(document.activeElement).toBe(closeButton);

    const hayakawa = getTask5Encounter("d1_hayakawa_first");
    const maskOption = hayakawa.recommendationOptions.find(
      (option) => option.itemId === "mask",
    );
    if (!maskOption) {
      throw new Error("Task 4 test catalog is missing the Hayakawa mask option.");
    }
    const recommendedItem = getTask5Item(maskOption.itemId);
    expect(dialog.textContent).toContain(recommendedItem.name);
    expect(dialog.textContent).toContain(`${recommendedItem.price}円`);
    expect(dialog.textContent).toContain(maskOption.description);

    fireEvent.keyDown(document, { key: "1" });
    expect(screen.getByRole("dialog", { name: "おすすめ商品" })).toBeTruthy();

    const dialogButtons = within(dialog).getAllByRole("button");
    const firstOptionButton = dialogButtons[1];
    const lastOptionButton = dialogButtons[dialogButtons.length - 1];
    fireEvent.keyDown(closeButton, { key: "Tab" });
    expect(document.activeElement).toBe(firstOptionButton);
    lastOptionButton.focus();
    fireEvent.keyDown(lastOptionButton, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastOptionButton);

    fireEvent.keyDown(lastOptionButton, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "おすすめする" }));

    fireEvent.click(screen.getByRole("button", { name: "おすすめする" }));
    const recommendationDialog = screen.getByRole("dialog", { name: "おすすめ商品" });
    fireEvent.click(
      within(recommendationDialog).getByRole("button", {
        name: new RegExp(`^${recommendedItem.name}`),
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "レシート / 結果" })).toBeTruthy();
  });

  it("renders Task 5 Day 1 notifications, then authored bodies, before Day 2", () => {
    renderApp();
    startDay();
    finishDayWithSales(5);

    fireEvent.click(screen.getByRole("button", { name: "ニュースを開く" }));
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(3);

    for (const article of articles) {
      const notificationHeadline = within(article).getByRole("heading", { level: 2 }).textContent;
      if (!notificationHeadline) {
        throw new Error("News article is missing its notification headline.");
      }
      const authoredArticle = TASK5_NEWS.find(
        (candidate) => candidate.notificationHeadline === notificationHeadline,
      );
      if (!authoredArticle) {
        throw new Error(`Unknown Task 5 notification headline: ${notificationHeadline}`);
      }

      expect(authoredArticle.headline).not.toBe(authoredArticle.notificationHeadline);
      fireEvent.click(within(article).getByRole("button", { name: /^記事を開く:/ }));
      expect(within(article).getByRole("heading", { level: 2 }).textContent).toBe(
        authoredArticle.headline,
      );
      expect(within(article).getByText(authoredArticle.body)).toBeTruthy();
    }

    expect(screen.getByRole("status").textContent).toContain("開封済み: 3 / 3");
    fireEvent.click(screen.getByRole("button", { name: "Day 2へ進む" }));
    expect(screen.getByRole("heading", { name: "昨日のレシートを、もう一度" })).toBeTruthy();
    expect(screen.queryByText(/TASK 3|Task 3|仮設|仮エンドポイント/)).toBeNull();
  });

  it("requires summary-to-news progression on Day 2 and cannot bypass unread articles", () => {
    renderApp();
    startDay();
    finishDayWithSales(5);
    fireEvent.click(screen.getByRole("button", { name: "ニュースを開く" }));
    readCurrentNews();
    fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
    finishDayWithSales(6);

    expect(screen.getByRole("heading", { name: "勤務終了 / 通知と本文のずれ" })).toBeTruthy();
    const openNews = screen.getByRole("button", { name: "ニュースを開く" });
    expect((openNews as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(openNews);
    const day3Button = screen.getByRole("button", { name: "Day 3へ進む" });
    expect((day3Button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.click(day3Button);
    expect(screen.getByRole("heading", { name: "勤務後のニュース" })).toBeTruthy();

    readCurrentNews();
    expect(screen.getByRole("heading", { name: "レシートに、因果の印をつける" })).toBeTruthy();
  });

  it("runs all five shifts through Day 5 news, ending, run summary, and title reset", () => {
    renderApp();
    startDay();

    const encounterCounts = [5, 6, 6, 6, 6];
    for (const [index, encounterCount] of encounterCounts.entries()) {
    finishDayWithSales(encounterCount);
      expect((screen.getByRole("button", { name: "ニュースを開く" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      fireEvent.click(screen.getByRole("button", { name: "ニュースを開く" }));
      readCurrentNews();

      if (index < encounterCounts.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
      }
    }

    const endingHeading = screen.getAllByRole("heading").find((heading) =>
      TASK5_ENDING_RECORDS.some((record) => record.presentation.title === heading.textContent),
    );
    expect(endingHeading).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "周回結果を見る" }));

    expect(screen.getByRole("heading", { name: "周回結果" })).toBeTruthy();
    expect(screen.getByText("5夜")).toBeTruthy();
    expect(screen.getByText("29組")).toBeTruthy();
    expect(screen.getByText("15記事")).toBeTruthy();
    expect(screen.getByText(/円$/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "タイトルへ戻る" }));
    expect(screen.getByRole("heading", { name: /最後の\s*コンビニ/ })).toBeTruthy();
  });
});
