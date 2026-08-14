import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isFreshDiscordTimestamp,
  verifyDiscordRequest,
} from "@/lib/discord/verify";

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

describe("Discord request verification", () => {
  it("accepts a fresh Ed25519 signature and rejects tampering", async () => {
    const now = Date.now();
    const timestamp = Math.floor(now / 1000).toString();
    const body = JSON.stringify({ id: "interaction", type: 1 });
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const publicDer = publicKey.export({ format: "der", type: "spki" });
    const publicHex = toHex(new Uint8Array(publicDer).slice(-32));
    const signature = toHex(
      sign(null, Buffer.from(`${timestamp}${body}`), privateKey),
    );

    await expect(
      verifyDiscordRequest(body, signature, timestamp, publicHex, now),
    ).resolves.toBe(true);
    await expect(
      verifyDiscordRequest(`${body} `, signature, timestamp, publicHex, now),
    ).resolves.toBe(false);
  });

  it("rejects stale interaction timestamps before signature work", () => {
    const now = Date.now();
    expect(
      isFreshDiscordTimestamp(
        Math.floor((now - 6 * 60 * 1000) / 1000).toString(),
        now,
      ),
    ).toBe(false);
  });
});
