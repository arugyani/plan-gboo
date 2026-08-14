import { mkdir, readFile, writeFile } from "node:fs/promises";

const environment = process.argv[2];
if (environment !== "staging" && environment !== "production") {
  throw new Error("Choose staging or production.");
}
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!databaseId) throw new Error("CLOUDFLARE_D1_DATABASE_ID is required.");

const source = JSON.parse(
  await readFile(new URL("../jobs/wrangler.json", import.meta.url), "utf8"),
);
const selected = source.env[environment];
const output = {
  $schema: "../../node_modules/wrangler/config-schema.json",
  name: selected.name,
  main: "../../jobs/index.ts",
  compatibility_date: source.compatibility_date,
  compatibility_flags: source.compatibility_flags,
  secrets: source.secrets,
  vars: {
    ...selected.vars,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID ?? "",
  },
  d1_databases: selected.d1_databases.map((database) => ({
    ...database,
    database_id: databaseId,
    migrations_dir: "../../drizzle",
  })),
  triggers: source.triggers,
  observability: source.observability,
};

const destination = new URL(
  "../.wrangler/generated/jobs-wrangler.json",
  import.meta.url,
);
await mkdir(new URL("../.wrangler/generated/", import.meta.url), {
  recursive: true,
});
await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, {
  mode: 0o600,
});
