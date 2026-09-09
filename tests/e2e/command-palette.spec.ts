import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./test";
import { demoDashboard } from "../../src/test/dashboard-fixture";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    if (
      new URL(route.request().url()).pathname !== "/api/dashboard" ||
      route.request().method() !== "GET"
    )
      throw new Error("Palette checks must not mutate backend data");
    await route.fulfill({ json: demoDashboard });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "All Together", exact: true }),
  ).toBeVisible();
});

test("searches all cards with keyboard and opens their editor", async ({
  page,
}) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", {
    name: "Search cards, boards, and people",
  });
  await expect(input).toBeFocused();
  const card = demoDashboard.cards[0];
  await input.fill(card.key);
  await expect(page.getByRole("option")).toHaveCount(1);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.getByLabel("Card title")).toHaveValue(card.title);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("supports touch, empty results, Escape and focus restoration", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Search cards, boards, and people",
  });
  await trigger.click();
  await page.getByRole("combobox").fill("no-such-result-987654");
  await expect(
    page.getByText("No matches. Try another name or card ID."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Meta+k");
  await expect(
    page.getByRole("dialog", { name: "Search RGBOO" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("");
});

test("opens boards and filters the overview by person", async ({ page }) => {
  const trigger = page.getByRole("button", {
    name: "Search cards, boards, and people",
  });
  const board = demoDashboard.boards[1];
  await trigger.click();
  await page.getByRole("combobox").fill(board.name);
  await page.getByRole("option", { name: board.name, exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: board.name }),
  ).toBeVisible();
  const person = demoDashboard.people[0];
  await trigger.click();
  await page.getByRole("combobox").fill(person.name);
  await page.getByRole("option", { name: person.name, exact: true }).click();
  await expect(page.getByLabel("Filter by person")).toHaveValue(person.id);
  await expect(page.getByRole("button", { name: /^Open .+:/ })).toHaveCount(
    demoDashboard.cards.filter((card) => card.personIds.includes(person.id))
      .length,
  );
  await page.getByLabel("Filter by person").selectOption("all");
  await expect(page.getByRole("button", { name: /^Open .+:/ })).toHaveCount(
    demoDashboard.cards.length,
  );
  await expect(page.locator('[draggable="true"]')).toHaveCount(0);
});

test("palette is accessible and respects reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("firefox"),
    "Axe is covered by Chromium and WebKit",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Search cards, boards, and people" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  const dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate((element) =>
      parseFloat(getComputedStyle(element).animationDuration),
    ),
  ).toBeLessThan(0.01);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
