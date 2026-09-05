import { fileURLToPath, URL } from "node:url";
import { Agent } from "node:https";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function localConfigGuard(
  environment: Record<string, string | undefined>,
): Plugin {
  const missing = ["BOT_API_TOKEN", "BOT_DISCORD_USER_ID"].filter(
    (name) => !environment[name]?.trim(),
  );
  return {
    name: "rgboo-local-config-guard",
    configureServer(server) {
      server.middlewares.use("/api", (_request, response, next) => {
        if (!missing.length) {
          next();
          return;
        }
        response.statusCode = 503;
        response.setHeader("content-type", "application/json");
        response.setHeader("cache-control", "no-store");
        response.end(
          JSON.stringify({
            code: "local_config_missing",
            message: `Local setup needs ${missing.join(" and ")} in .env.local. Restart the site after adding them.`,
          }),
        );
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const botApiIp = env.BOT_API_IP;
  const proxyHeaders: Record<string, string> = {};
  if (env.BOT_API_TOKEN)
    proxyHeaders.authorization = `Bearer ${env.BOT_API_TOKEN}`;
  if (env.BOT_DISCORD_USER_ID)
    proxyHeaders["x-discord-user-id"] = env.BOT_DISCORD_USER_ID;
  if (env.BOT_DISCORD_GUILD_ID)
    proxyHeaders["x-discord-guild-id"] = env.BOT_DISCORD_GUILD_ID;
  const proxyAgent = botApiIp
    ? new Agent({
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [{ address: botApiIp, family: 4 }]);
            return;
          }
          callback(null, botApiIp, 4);
        },
      })
    : undefined;
  return {
    plugins: [react(), tailwindcss(), localConfigGuard(env)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: env.BOT_API_ORIGIN || "https://boof-ban.fly.dev",
          changeOrigin: true,
          headers: proxyHeaders,
          agent: proxyAgent,
        },
      },
    },
  };
});
