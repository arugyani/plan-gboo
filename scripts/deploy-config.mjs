const requiredNames = [
  "AUTH_SESSION_SECRET",
  "BOT_API_ORIGIN",
  "BOT_API_TOKEN",
  "BOT_DISCORD_GUILD_ID",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "PUBLIC_ORIGIN",
];

export function httpsOrigin(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  )
    throw new Error(`${name} must be an HTTPS origin with no path.`);
  return parsed.origin;
}

export function readDeploySecrets(environment) {
  const secrets = Object.fromEntries(
    requiredNames.map((name) => {
      const value = environment[name]?.trim();
      if (!value) throw new Error(`${name} is required for deployment.`);
      return [name, value];
    }),
  );

  if (Buffer.byteLength(secrets.AUTH_SESSION_SECRET) < 32)
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 bytes.");
  if (Buffer.byteLength(secrets.BOT_API_TOKEN) < 32)
    throw new Error("BOT_API_TOKEN must contain at least 32 bytes.");
  if (!/^\d{5,24}$/u.test(secrets.BOT_DISCORD_GUILD_ID))
    throw new Error("BOT_DISCORD_GUILD_ID must be a Discord ID.");
  if (!/^\d{5,24}$/u.test(secrets.DISCORD_CLIENT_ID))
    throw new Error("DISCORD_CLIENT_ID must be a Discord ID.");

  secrets.PUBLIC_ORIGIN = httpsOrigin(secrets.PUBLIC_ORIGIN, "PUBLIC_ORIGIN");
  secrets.BOT_API_ORIGIN = httpsOrigin(
    secrets.BOT_API_ORIGIN,
    "BOT_API_ORIGIN",
  );
  return secrets;
}
