import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/app/App";
import { TitleScreen } from "../src/screens/Title/TitleScreen";

describe("title screen MVP entry", () => {
  it("gates the App while storage hydration is pending", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("保存データを確認しています…");
    expect(markup).not.toContain("はじめから");
  });

  it("renders the working title and fresh-run action", () => {
    const markup = renderToStaticMarkup(<TitleScreen />);

    expect(markup).toContain("最後のコンビニ");
    expect(markup).toContain("はじめから");
  });
});
