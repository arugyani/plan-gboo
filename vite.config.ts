import vinext from "vinext";
import { defineConfig } from "vite";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const d1 = "DB";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const cloudflareEnvironment =
  process.env.CLOUDFLARE_ENV === "staging" ||
  process.env.CLOUDFLARE_ENV === "production"
    ? process.env.CLOUDFLARE_ENV
    : "local";
const deployed = cloudflareEnvironment !== "local";
const databaseName =
  cloudflareEnvironment === "production"
    ? "rgboo-organizer-production"
    : cloudflareEnvironment === "staging"
      ? "rgboo-organizer-staging"
      : "rgboo-organizer-local";

const localBindingConfig = {
  name:
    cloudflareEnvironment === "staging"
      ? "rgboo-organizer-staging"
      : "rgboo-organizer",
  main: "../worker/index.ts",
  compatibility_date: "2026-08-13",
  compatibility_flags: ["nodejs_compat"],
  assets: {
    binding: "ASSETS",
    directory: "../public",
  },
  vars: {
    APP_ENV: cloudflareEnvironment,
    DEMO_MODE: deployed ? "false" : "true",
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID ?? "",
    DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID ?? "",
    INITIAL_ADMIN_DISCORD_ID: process.env.INITIAL_ADMIN_DISCORD_ID ?? "",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "",
  },
  ...(deployed
    ? {
        secrets: {
          required: [
            "BETTER_AUTH_SECRET",
            "DISCORD_CLIENT_ID",
            "DISCORD_CLIENT_SECRET",
            "DISCORD_PUBLIC_KEY",
            "DISCORD_BOT_TOKEN",
          ],
        },
      }
    : {}),
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: databaseName,
          database_id:
            process.env.CLOUDFLARE_D1_DATABASE_ID ??
            SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          migrations_dir: "../drizzle",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      cloudflare({
        configPath: "./.openai/wrangler.local.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
