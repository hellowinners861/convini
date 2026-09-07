// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { App } from "../src/app/App";
import { RUN_STORAGE_KEY, type StorageLike } from "../src/app/persistence";
import { receiptFlag, witnessFlag } from "../src/content/connections";

afterEach(cleanup);

it("checkpoints questions and handed receipts immediately and restores their visible feedback", async () => {
  const values = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  const first = render(<App storage={storage} runIdFactory={() => "conversation-ui"} />);
  fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
  fireEvent.click(screen.getByRole("button", { name: "勤務を始める" }));
  fireEvent.click(screen.getByRole("button", { name: "今夜も長いんですか？" }));
  expect(screen.getByText(/四時に病院の方/)).toBeTruthy();
  const storedRun = () => JSON.parse(values.get(RUN_STORAGE_KEY)!);
  await waitFor(() => expect(storedRun().flags).toContain("asked_d1_taxi_baseline"));
  expect(screen.getByRole("button", { name: "売る" }).hasAttribute("disabled")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
  fireEvent.click(screen.getByRole("button", { name: "売る" }));
  fireEvent.click(screen.getByRole("button", { name: "次の接客へ" }));
  fireEvent.click(screen.getByRole("button", { name: "スキャンする" }));
  fireEvent.click(screen.getByRole("button", { name: "売る" }));
  const sales = storedRun().revenue;
  fireEvent.click(screen.getByRole("button", { name: "レシートも渡す" }));
  await waitFor(() => expect(storedRun().flags).toContain(receiptFlag("d1_miyashita_baseline")));
  expect(storedRun().flags).toContain(witnessFlag("miyashita"));
  expect(storedRun().revenue).toEqual(sales);

  first.unmount();
  render(<App storage={storage} runIdFactory={() => "unused"} />);
  fireEvent.click(screen.getByRole("button", { name: "つづきから" }));
  expect(screen.queryByRole("button", { name: "レシートも渡す" })).toBeNull();
  expect(screen.getByText(/宮下は紙を手帳に挟んだ/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "次の接客へ" })).toBeTruthy();
});
