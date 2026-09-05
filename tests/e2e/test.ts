import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ pageHealth: void }>({
  pageHealth: [
    async ({ page }, use) => {
      const failures: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(message.text());
      });
      page.on("pageerror", (error) => failures.push(error.message));

      await use();

      expect(failures, "browser console and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
