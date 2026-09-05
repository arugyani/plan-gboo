import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./worker/index.ts",
      miniflare: {
        compatibilityDate: "2026-09-03",
      },
    }),
  ],
  test: {
    include: ["worker/**/*.test.ts"],
  },
});
