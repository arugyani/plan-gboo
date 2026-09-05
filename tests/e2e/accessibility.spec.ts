import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./test";
import { demoDashboard } from "../../src/test/dashboard-fixture";

test("has no serious accessibility violations in the board flow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("firefox"),
    "Axe runs in Chromium and WebKit; Firefox keeps the same functional coverage without repeating the slow audit.",
  );
  await page.route("**/api/dashboard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(demoDashboard),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Opening Night" }),
  ).toBeVisible();

  const boardResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(boardResults.violations).toEqual([]);

  await page.getByRole("button", { name: /open show-12/i }).click();
  await expect(page.getByLabel("Card title")).toBeVisible();
  const sheetResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(sheetResults.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
  const groupsResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(groupsResults.violations).toEqual([]);

  await page.getByRole("button", { name: "Add group" }).click();
  const groupDialogResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(groupDialogResults.violations).toEqual([]);
});
