const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const appUrl = process.env.APP_URL;

if (!applicationId || !guildId || !token || !appUrl) {
  throw new Error(
    "DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN, and APP_URL are required.",
  );
}

const manifestResponse = await fetch(new URL("/api/discord/commands", appUrl));
if (!manifestResponse.ok) {
  throw new Error(
    `The deployed command manifest returned ${manifestResponse.status}.`,
  );
}
const commands = await manifestResponse.json();
const response = await fetch(
  `https://discord.com/api/v10/applications/${encodeURIComponent(applicationId)}/guilds/${encodeURIComponent(guildId)}/commands`,
  {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
  },
);
if (!response.ok) {
  throw new Error(`Discord command sync failed with ${response.status}.`);
}
const saved = await response.json();
console.log(
  `Synchronized ${Array.isArray(saved) ? saved.length : 0} Discord commands.`,
);
