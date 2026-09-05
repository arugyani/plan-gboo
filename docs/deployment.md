# Deployment

This is the one-time setup for staging and production. Repeat values per GitHub
Environment so the two installations do not share sessions or Discord OAuth
credentials.

## 1. Backend

Deploy the `kanban` repository first. Its Fly application needs:

- `Discord__Token`
- `Database__ConnectionString`
- `Database__Name` (defaults to `KanbanCord`)
- `Web__ApiKey` (at least 32 random bytes)
- `Web__AdministratorDiscordUserIds__0` (first administrator's Discord ID)

Enable the Discord application's **Server Members Intent** so the website can
list guild members for group assignment without repeatedly calling Discord.

The bot repository's green `main` branch deploys through its protected
`production` GitHub Environment. Add a narrowly scoped `FLY_API_TOKEN` there.
Its locked NuGet restore, zero-warning Release build, complete Mongo-backed
suite, and non-root container build must pass first. Startup creates the
backward-compatible MongoDB indexes; no manual schema migration is required.

## 2. Cloudflare and Discord OAuth

Deploy once to learn the account's Workers subdomain, or read it in the
Cloudflare dashboard. Create a different Discord OAuth application for each
environment and add its exact callback:

```text
https://rgboo-organizer-staging.<account>.workers.dev/api/auth/callback
https://rgboo-organizer.<account>.workers.dev/api/auth/callback
```

The OAuth flow needs only `identify`; guild membership is checked by the bot.

The bot application also registers the **Add to The Board** message action.
Discord global command propagation is not instantaneous, so allow time for it
to appear after the first healthy deployment.

Create a Cloudflare API token scoped to **Workers Scripts: Edit** for the target
account. Do not use the Global API Key.

## 3. GitHub Environments

Create `staging` and `production` Environments in the `pgboo` repository. Add a
required reviewer to production.

At repository level, create the Actions variable `ENABLE_DEPLOYMENTS` with the
value `true` only after the credentials below are present. Until then, CI still
runs but deploy jobs safely remain skipped instead of producing a misleading
failed release.

Environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `AUTH_SESSION_SECRET` (at least 32 random bytes; unique per environment)
- `BOT_API_TOKEN` (same value as that backend's `Web__ApiKey`)
- `DISCORD_CLIENT_SECRET`

Environment variables:

- `BOT_API_ORIGIN` (HTTPS origin of that environment's bot API)
- `BOT_DISCORD_GUILD_ID`
- `DISCORD_CLIENT_ID`
- `PUBLIC_ORIGIN` (exact Worker HTTPS origin, no trailing path)

`BOT_API_ORIGIN` and `PUBLIC_ORIGIN` must be HTTPS origins without paths. The
deployment script rejects short session/service secrets and malformed origins
before it calls Wrangler.

Staging should point to a separate bot/database when it is used for destructive
or migration testing. If it temporarily points to production, treat staging as
production data and do not use mutation tests there.

## 4. Delivery flow

Every pull request runs clean install, formatting, linting, typed checks,
coverage, build, generated Worker type drift, Wrangler dry-run, dependency
audit, five browser/device projects, accessibility, and performance checks.

A green commit on `main` deploys staging and checks liveness/readiness.
Production is manual and waits for the Environment reviewer. The workflow prints
the current Worker version list when one exists. If the post-deploy smoke check
fails, Wrangler automatically restores the previous stable version and the
workflow remains failed for investigation. A first-ever deployment has no prior
version to restore, so its failed smoke check remains a manual incident.

The first release stays on Cloudflare Workers Free. Review the usage dashboard
weekly. Repeatedly crossing 60% of a daily Worker or storage quota starts the
paid-plan discussion; 80% or normal-flow CPU-limit errors make the upgrade a
release requirement. No custom domain is configured in v1.

## 5. Manual deployment

With all values exported in the shell:

```bash
npm ci
npx wrangler login
npm run deploy:staging
PUBLIC_ORIGIN=https://rgboo-organizer-staging.<account>.workers.dev npm run smoke
```

The same commands with `production` publish production. Never put the values in
`wrangler.jsonc` or commit a generated secrets file.
