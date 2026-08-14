import { expect, test } from "@playwright/test";

test("opens a board and card without losing context", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Community Notes" }),
  ).toBeVisible();
  await page.getByLabel("Choose a board").selectOption("board-web");
  await expect(
    page.getByRole("heading", { name: "Website Refresh" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "WEB-21 Review welcome screen copy" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Review welcome screen copy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "octocat/Hello-World#1" }),
  ).toHaveAttribute("href", "https://github.com/octocat/Hello-World/issues/1");
  await expect(page.getByText("What Changed")).toBeVisible();
  await expect(
    page.locator("h1", { hasText: "Website Refresh" }),
  ).toBeAttached();
});

test("rolls an accessible card move back when saving fails", async ({
  page,
}) => {
  await page.route("**/api/cards/card-4/move", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { message: "Save failed for this check." } },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Choose a board").selectOption("board-web");
  await page
    .getByLabel("Move Review welcome screen copy to column")
    .selectOption("web-4");
  await expect(page.getByText("Save failed for this check.")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Doing" })
      .getByRole("button", { name: "WEB-21 Review welcome screen copy" }),
  ).toBeVisible();
});

test("combined views edit cards but do not expose drag controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Choose a board").selectOption("all");
  await expect(
    page.getByRole("heading", { name: "All Together" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Drag / })).toHaveCount(0);
  await page
    .getByRole("button", { name: "WEB-21 Review welcome screen copy" })
    .click();
  await expect(page.getByLabel("Card title")).toBeEditable();
});

test("rejects a stale card version instead of overwriting", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const dashboard = (await fetch("/api/dashboard").then((response) =>
      response.json(),
    )) as {
      cards: Array<{ id: string; title: string; version: number }>;
    };
    const card = dashboard.cards.find((item) => item.id === "card-4");
    if (!card) throw new Error("Demo card is missing.");
    const response = await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: card.title,
        expectedVersion: card.version + 100,
      }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(result.status).toBe(409);
  expect(result.body).toMatchObject({
    error: {
      code: "card_changed",
      message: expect.stringContaining("changed while you were looking"),
    },
  });
});

test("mobile navigation reaches My List", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("mobile"),
    "mobile-only interaction",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "My List" }).click();
  await expect(page.getByRole("heading", { name: "My List" })).toBeVisible();
});
