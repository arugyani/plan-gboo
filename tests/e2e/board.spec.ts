import type { Page, Route } from "@playwright/test";
import { expect, test } from "./test";
import { demoDashboard } from "../../src/test/dashboard-fixture";
import type {
  Card,
  CardPatch,
  CreateCardInput,
  DashboardData,
} from "../../src/types";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockDashboard(page: Page, data: DashboardData = demoDashboard) {
  await page.route("**/api/dashboard", async (route) => {
    await fulfillJson(route, data);
  });
}

test("shows the real board navigation without a redundant refresh control", async ({
  page,
}) => {
  await mockDashboard(page);
  await page.goto("/");

  await expect(page.getByText("RGBOO", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh board" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Opening Night" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "What’s Happening" }).click();
  await expect(
    page.getByRole("heading", { name: "What’s Happening" }),
  ).toBeVisible();
  await expect(page.locator("ol li")).toHaveCount(
    demoDashboard.activity.length,
  );
});

test("adds a card through the same API used by the Discord bot", async ({
  page,
}) => {
  const dashboard = structuredClone(demoDashboard);
  await mockDashboard(page, dashboard);
  await page.route("**/api/cards", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const input = route.request().postDataJSON() as CreateCardInput;
    const now = new Date().toISOString();
    const card: Card = {
      id: "507f1f77bcf86cd799439099",
      key: "SHOW-439099",
      boardId: input.boardId,
      columnId: input.columnId,
      title: input.title,
      notes: input.notes ?? "",
      importance: input.importance ?? "none",
      when: input.when ?? null,
      blocked: false,
      blockedReason: null,
      rank: 9999,
      version: 1,
      personIds: input.personIds ?? [],
      tagIds: [],
      checklist: [],
      comments: [],
      links: [],
      changes: [],
      createdAt: now,
      updatedAt: now,
    };
    dashboard.cards.push(card);
    await fulfillJson(route, { card }, 201);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Add a card" }).click();
  await page
    .getByPlaceholder("A clear, short title")
    .fill("Check the lantern batteries");
  await page.getByRole("button", { name: "Add card", exact: true }).click();

  await expect(page.getByLabel("Card title")).toHaveValue(
    "Check the lantern batteries",
  );
});

test("creates the first tag while saving a card", async ({ page }) => {
  const dashboard = structuredClone(demoDashboard);
  await mockDashboard(page, dashboard);
  let savedTagNames: string[] | undefined;
  await page.route("**/api/cards/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const input = route.request().postDataJSON() as CardPatch;
    savedTagNames = input.tagNames;
    const cardId = route.request().url().split("/").at(-1);
    const card = dashboard.cards.find((item) => item.id === cardId)!;
    card.version = input.expectedVersion + 1;
    await fulfillJson(route, { card });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /open show-12/i }).click();
  await page.getByLabel("New tag").fill("lighting");
  await page.getByRole("button", { name: "Add tag" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect.poll(() => savedTagNames).toContain("lighting");
});

test("moves a card by dragging it to another column", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Touch layouts use the card's explicit column control.",
  );
  const dashboard = structuredClone(demoDashboard);
  await mockDashboard(page, dashboard);
  await page.route("**/api/cards/*/move", async (route) => {
    const cardId = route.request().url().split("/").at(-2);
    const input = route.request().postDataJSON() as {
      columnId: string;
      expectedVersion: number;
    };
    const card = dashboard.cards.find((item) => item.id === cardId);
    if (!card) return fulfillJson(route, { message: "Not found" }, 404);
    card.columnId = input.columnId;
    card.version = input.expectedVersion + 1;
    card.updatedAt = new Date().toISOString();
    await fulfillJson(route, { card });
  });

  await page.goto("/");
  await page
    .locator('[data-card-id="card-1"]')
    .dragTo(page.locator('[data-column-id="opening-3"]'));

  await expect(
    page
      .locator('[data-column-id="opening-3"]')
      .getByText("Map the full run-through"),
  ).toBeVisible();
});

test("moves a card without dragging", async ({ page }) => {
  const dashboard = structuredClone(demoDashboard);
  await mockDashboard(page, dashboard);
  await page.route("**/api/cards/*/move", async (route) => {
    const cardId = route.request().url().split("/").at(-2);
    const input = route.request().postDataJSON() as {
      columnId: string;
      expectedVersion: number;
    };
    const card = dashboard.cards.find((item) => item.id === cardId)!;
    card.columnId = input.columnId;
    card.version = input.expectedVersion + 1;
    await fulfillJson(route, { card });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /open show-12/i }).click();
  const columnPicker = page.getByRole("combobox", {
    name: "Column",
    exact: true,
  });
  await columnPicker.selectOption("opening-3");

  await expect(columnPicker).toHaveValue("opening-3");
});

test("reorders cards within a column", async ({ page }) => {
  const dashboard = structuredClone(demoDashboard);
  dashboard.cards.push({
    ...dashboard.cards[0],
    id: "card-5",
    key: "SHOW-18",
    title: "Invite the final helpers",
    rank: 2048,
    version: 1,
  });
  await mockDashboard(page, dashboard);
  let placement: { targetCardId?: string; edge?: string } = {};
  await page.route("**/api/cards/*/move", async (route) => {
    const input = route.request().postDataJSON() as {
      columnId: string;
      expectedVersion: number;
      targetCardId?: string;
      edge?: string;
    };
    placement = input;
    const cardId = route.request().url().split("/").at(-2);
    const card = dashboard.cards.find((item) => item.id === cardId)!;
    card.columnId = input.columnId;
    card.rank = 512;
    card.version = input.expectedVersion + 1;
    await fulfillJson(route, { card });
  });

  await page.goto("/");
  await page
    .locator('[data-card-id="card-5"]')
    .dragTo(page.locator('[data-card-id="card-1"]'), {
      targetPosition: { x: 20, y: 2 },
    });

  await expect
    .poll(() => placement)
    .toMatchObject({
      targetCardId: "card-1",
      edge: "before",
    });
  await expect(
    page.locator('[data-column-id="opening-2"] [data-card-id]').first(),
  ).toContainText("Invite the final helpers");
});

test("lets an organizer add a private group", async ({ page }) => {
  const dashboard = structuredClone(demoDashboard);
  await mockDashboard(page, dashboard);
  await page.route("**/api/groups", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const input = route.request().postDataJSON() as {
      name: string;
      icon: "ghost" | "pumpkin" | "bat";
      accent: "pumpkin" | "purple" | "green" | "berry";
    };
    const group = {
      id: "sound-crew",
      name: input.name,
      slug: "sound-crew",
      icon: input.icon,
      accent: input.accent,
      isPrivate: true,
      discordChannelId: null,
      recapEnabled: false,
      recapHourUtc: 16,
    } as const;
    dashboard.groups.push(group);
    dashboard.viewer.groupRoles[group.id] = "organizer";
    await fulfillJson(route, { group }, 201);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Sound Crew");
  await page.getByRole("button", { name: "Add group", exact: true }).click();

  await expect(
    page.getByRole("button", { name: "Sound Crew", exact: true }),
  ).toBeVisible();
});

test("combines selected boards in All Together without drag", async ({
  page,
}, testInfo) => {
  await mockDashboard(page);
  await page.goto("/");
  if (testInfo.project.name.includes("mobile"))
    await page.getByLabel("Choose board view").selectOption("all-together");
  else
    await page
      .getByRole("complementary")
      .getByRole("button", { name: "All Together" })
      .click();

  await expect(
    page.getByRole("heading", { name: "All Together" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Opening Night" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Website Refresh" }),
  ).toBeVisible();
  await expect(page.locator('[data-card-id="card-1"]')).not.toHaveAttribute(
    "draggable",
    "true",
  );
  await page.getByRole("button", { name: /open show-12/i }).click();
  await expect(page.getByLabel("Card title")).toBeVisible();
});

test("keeps a 100-card board responsive", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The performance budget runs once in Chromium.",
  );
  const dashboard = structuredClone(demoDashboard);
  const template = dashboard.cards[0];
  dashboard.cards = Array.from({ length: 2_000 }, (_, index) => ({
    ...template,
    id: `card-${index}`,
    key: `SHOW-${index}`,
    title: `Performance card ${index}`,
    boardId: index < 100 ? dashboard.boards[0].id : dashboard.boards[1].id,
    columnId:
      index < 100
        ? dashboard.columns.find(
            (column) => column.boardId === dashboard.boards[0].id,
          )!.id
        : dashboard.columns.find(
            (column) => column.boardId === dashboard.boards[1].id,
          )!.id,
  }));
  await mockDashboard(page, dashboard);

  const startedAt = Date.now();
  await page.goto("/");
  await expect(
    page.getByText("Performance card 99", { exact: true }),
  ).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(5_000);
  await expect(page.getByRole("button", { name: /^open show-/i })).toHaveCount(
    100,
  );
});
