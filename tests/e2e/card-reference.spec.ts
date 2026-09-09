import { expect, test } from "./test";
import { demoDashboard } from "../../src/test/dashboard-fixture";

test("uses the shared BOO reference for card search and details", async ({
  page,
}) => {
  const dashboard = structuredClone(demoDashboard);
  dashboard.cards.forEach((card, index) => {
    card.key = `BOO-${String(index + 1).padStart(3, "0")}`;
  });
  await page.route("**/api/**", async (route) => {
    if (
      route.request().method() === "GET" &&
      new URL(route.request().url()).pathname === "/api/dashboard"
    ) {
      await route.fulfill({ json: dashboard });
      return;
    }
    throw new Error(
      "This read-only test must not make any other API requests.",
    );
  });

  await page.goto("/");
  await page
    .locator('input[placeholder^="Find a card"]:visible')
    .fill("boo-001");
  await expect(page.getByRole("button", { name: /^Open BOO-/ })).toHaveCount(1);
  await page.getByRole("button", { name: /^Open BOO-001:/ }).click();
  await expect(
    page.getByRole("dialog").getByText("BOO-001", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Card title")).toHaveValue(
    dashboard.cards[0].title,
  );
});
