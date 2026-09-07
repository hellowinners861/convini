import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("title screen boots and has no axe violations", async ({ page }) => {
  await page.goto("/convini/");

  await expect(page).toHaveTitle("最後のコンビニ");
  await expect(
    page.getByRole("heading", { name: /最後の\s*コンビニ/ }),
  ).toBeVisible();

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toEqual([]);

  await page.getByRole("button", { name: "はじめから" }).click();
  await expect(
    page.getByRole("heading", { name: "いつもの夜に、見慣れない商品" }),
  ).toBeVisible();
});
