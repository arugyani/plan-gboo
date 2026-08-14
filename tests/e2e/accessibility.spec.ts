import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("core board has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Community Notes" }),
  ).toBeVisible();
  // Axe 4.12 currently declares Playwright 1.62 types while the runner is
  // intentionally pinned to 1.61. The runtime Page API used here is identical.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("card sheet restores focus when it closes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose a board").selectOption("board-web");
  const trigger = page.getByRole("button", {
    name: "WEB-21 Review welcome screen copy",
  });
  await trigger.click();
  await page.getByRole("button", { name: "Close card" }).click();
  await expect(trigger).toBeFocused();
});
