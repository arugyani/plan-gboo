import assert from "node:assert/strict";
import test from "node:test";
import { readDeploySecrets } from "./deploy-config.mjs";

const valid = {
  AUTH_SESSION_SECRET: "session-secret-with-at-least-32-bytes",
  BOT_API_ORIGIN: "https://bot.example.com",
  BOT_API_TOKEN: "service-token-with-at-least-32-bytes",
  BOT_DISCORD_GUILD_ID: "123456789012345678",
  DISCORD_CLIENT_ID: "987654321098765432",
  DISCORD_CLIENT_SECRET: "discord-secret",
  PUBLIC_ORIGIN: "https://board.example.com",
};

test("normalizes a complete deployment configuration", () => {
  const result = readDeploySecrets({
    ...valid,
    PUBLIC_ORIGIN: "  https://board.example.com:443  ",
  });

  assert.equal(result.PUBLIC_ORIGIN, "https://board.example.com");
  assert.equal(result.BOT_API_ORIGIN, "https://bot.example.com");
});

test("requires every deployment value", () => {
  assert.throws(
    () => readDeploySecrets({ ...valid, DISCORD_CLIENT_SECRET: "" }),
    /DISCORD_CLIENT_SECRET is required/u,
  );
});

test("rejects short service secrets", () => {
  assert.throws(
    () => readDeploySecrets({ ...valid, BOT_API_TOKEN: "too-short" }),
    /BOT_API_TOKEN must contain at least 32 bytes/u,
  );
  assert.throws(
    () => readDeploySecrets({ ...valid, AUTH_SESSION_SECRET: "too-short" }),
    /AUTH_SESSION_SECRET must contain at least 32 bytes/u,
  );
});

test("rejects invalid Discord IDs", () => {
  assert.throws(
    () => readDeploySecrets({ ...valid, BOT_DISCORD_GUILD_ID: "not-an-id" }),
    /BOT_DISCORD_GUILD_ID must be a Discord ID/u,
  );
});

test("rejects insecure or non-origin URLs", () => {
  assert.throws(
    () =>
      readDeploySecrets({
        ...valid,
        PUBLIC_ORIGIN: "http://board.example.com",
      }),
    /HTTPS origin/u,
  );
  assert.throws(
    () =>
      readDeploySecrets({
        ...valid,
        BOT_API_ORIGIN: "https://bot.example.com/api",
      }),
    /HTTPS origin with no path/u,
  );
});
