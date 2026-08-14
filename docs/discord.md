# Discord setup

Use a separate Discord application for staging and production so callbacks,
commands, and mistakes cannot cross environments.

## Application configuration

For each application:

1. Create a bot and copy the application ID, public key, client ID, client
   secret, and bot token into the matching GitHub environment.
2. Enable the Server Members privileged intent. The Board reads a specific guild
   member to enforce access and periodically reconcile departures.
3. Install the application in exactly one server with the `bot` and
   `applications.commands` scopes. Grant only the channel permissions needed for
   configured recaps or reminders.
4. Add the exact Better Auth redirect URL:
   `https://<worker-url>/api/auth/callback/discord`.
5. Set the interactions URL to:
   `https://<worker-url>/api/discord/interactions`.
6. Set `DISCORD_GUILD_ID` to that server’s ID and run `npm run discord:sync`
   after the main Worker is live.

The website OAuth connection is for identity. Bot authorization is separate and
uses the bot token only on the server.

## Commands

- `/my-list`
- `/card add`, `open`, `update`, `move`, `people`, `note`, `checklist`, and
  `link`
- `/board recap`
- Message action **Add to The Board**

Card responses offer **Join this**, **Move**, **Waiting**, **Add note**,
**Mark done**, and **Open The Board**. Normal interactions are private. Board
recaps are the deliberate public exception.

## First administrator

Set `INITIAL_ADMIN_DISCORD_ID` to the first administrator’s Discord snowflake,
deploy, and have that person sign in once. Confirm their role on **People**, then
remove the bootstrap value from the GitHub environment and deploy again. All
future role changes happen through authenticated administrator controls.

## Troubleshooting

- `401 invalid_signature`: the interactions URL is using the wrong application
  public key, or a proxy changed the raw request body.
- `403 wrong_guild`: the command came from a server other than the configured
  installation.
- “Open The Board once”: the Discord user has not completed website OAuth, so no
  stable site account exists yet.
- Commands are stale: confirm `APP_URL`, application ID, guild ID, and bot token
  belong to the same environment, then rerun `npm run discord:sync`.
- Guild checks fail: verify the bot remains in the guild and Server Members
  intent is enabled.
