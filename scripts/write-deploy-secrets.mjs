import { mkdir, writeFile } from "node:fs/promises";

const target = process.argv[2] ?? "main";
if (target !== "main" && target !== "jobs") {
  throw new Error("Choose main or jobs.");
}

const names =
  target === "main"
    ? [
        "BETTER_AUTH_SECRET",
        "DISCORD_CLIENT_ID",
        "DISCORD_CLIENT_SECRET",
        "DISCORD_PUBLIC_KEY",
        "DISCORD_BOT_TOKEN",
      ]
    : ["DISCORD_BOT_TOKEN"];
const missing = names.filter((name) => !process.env[name]);
if (missing.length)
  throw new Error(`Missing deployment secrets: ${missing.join(", ")}`);

const values = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
);
if (target === "jobs" && process.env.MONITOR_HEARTBEAT_URL) {
  values.MONITOR_HEARTBEAT_URL = process.env.MONITOR_HEARTBEAT_URL;
}
await mkdir(new URL("../.wrangler/generated/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL(`../.wrangler/generated/${target}-secrets.json`, import.meta.url),
  JSON.stringify(values),
  { mode: 0o600 },
);
