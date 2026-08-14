import { expect, test } from "@playwright/test";
import { demoDashboard } from "@/lib/demo-data";

test("keeps a 2,000-card data set responsive with 100 visible cards", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "One stable browser budget is sufficient; behavior is covered cross-browser.",
  );

  const template = demoDashboard.cards[0];
  const visibleColumn = demoDashboard.columns.find(
    (column) => column.boardId === template.boardId,
  );
  if (!visibleColumn) throw new Error("Demo board has no column.");

  const cards = Array.from({ length: 2_000 }, (_, index) => ({
    ...template,
    id: `load-card-${index}`,
    key: `LOAD-${index + 1}`,
    title: `Load test card ${index + 1}`,
    boardId: index < 100 ? template.boardId : "board-web",
    columnId: index < 100 ? visibleColumn.id : "web-4",
    rank: index * 1024,
    personIds: [],
    checklist: [],
    comments: [],
    history: [],
    links: [],
  }));

  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ json: { ...demoDashboard, cards } }),
  );
  const startedAt = Date.now();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Opening Night" }),
  ).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(5_000);
  await expect(page.locator("[data-card-id]")).toHaveCount(100);
});
