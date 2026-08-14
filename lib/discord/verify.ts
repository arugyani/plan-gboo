import { verifyKey } from "discord-interactions";

export const MAX_DISCORD_INTERACTION_AGE_MS = 5 * 60 * 1000;

export function isFreshDiscordTimestamp(timestamp: string, now = Date.now()) {
  const timestampMs = Number(timestamp) * 1000;
  return (
    Number.isFinite(timestampMs) &&
    Math.abs(now - timestampMs) <= MAX_DISCORD_INTERACTION_AGE_MS
  );
}

export async function verifyDiscordRequest(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string,
  now = Date.now(),
) {
  if (
    !body ||
    !signature ||
    !timestamp ||
    !publicKey ||
    !isFreshDiscordTimestamp(timestamp, now)
  ) {
    return false;
  }
  try {
    return await verifyKey(body, signature, timestamp, publicKey);
  } catch {
    return false;
  }
}
