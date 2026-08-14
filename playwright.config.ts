import { defineConfig, devices } from "@playwright/test";

const desktop = { viewport: { width: 1440, height: 900 } };
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/health/live",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], ...desktop },
    },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"], ...mobile } },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"], ...desktop },
    },
    {
      name: "firefox-mobile",
      use: { ...devices["Desktop Firefox"], ...mobile },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"], ...desktop },
    },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"], ...mobile } },
  ],
});
