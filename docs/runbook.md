# Deployment and recovery runbook

## GitHub environments

Create `staging` and `production` environments. Require one reviewer for
production. Configure these in each environment.

Secrets:

- `CLOUDFLARE_API_TOKEN`: scoped to Workers Scripts, D1, and account read for the
  target account.
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `BETTER_AUTH_SECRET`: independent random value per environment.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`, and
  `DISCORD_BOT_TOKEN`
- `MONITOR_HEARTBEAT_URL` (optional but recommended)

Variables:

- `APP_URL`: exact stable `https://...workers.dev` URL.
- `PREVIEW_URL`: exact candidate alias URL, normally
  `https://candidate-<worker-name>.<workers-subdomain>.workers.dev`.
- `DISCORD_APPLICATION_ID`
- `DISCORD_GUILD_ID`
- `INITIAL_ADMIN_DISCORD_ID` only during bootstrap.

The committed UUIDs are obvious placeholders. The build reads the real D1 ID
from `CLOUDFLARE_D1_DATABASE_ID` and writes it only to ignored generated output.

## Normal release

1. Open a pull request. CI must pass and one person must review it.
2. Merge to protected `main`; staging deploys automatically after that commit’s
   CI run succeeds.
3. Verify sign-in, a card edit/move, a GitHub link, one bot command, and the jobs
   heartbeat in staging.
4. Run **Deploy production**, enter the exact tested commit SHA, and approve the
   protected environment prompt.
5. Confirm `/api/health/live`, `/api/health/ready`, Discord commands, and the
   heartbeat after promotion.

Migrations must remain backward-compatible with the currently deployed Worker.
Use expand/migrate/contract across separate releases for destructive schema
changes.

## Worker rollback

The production workflow automatically runs Wrangler rollback if its final smoke
test fails. For a later application regression:

```bash
npx wrangler deployments list --config dist/server/wrangler.json
npx wrangler rollback --config dist/server/wrangler.json --message "incident rollback" --yes
```

Rollback the main Worker first. Roll back the jobs Worker separately only when
its behavior caused the incident. A Worker rollback does not undo a migration.

## D1 recovery

Each production release stores a D1 Time Travel bookmark as a workflow artifact.
Never automate a restore: it can discard valid writes made after the selected
point.

During a data incident:

1. Stop the source of bad writes by rolling back or disabling the affected
   feature.
2. Record a new current bookmark and preserve logs/correlation IDs.
3. Identify the last good bookmark from the production recovery artifact.
4. Estimate which legitimate later writes would be lost and tell the group.
5. Restore only after a second person confirms the environment and bookmark.
6. Verify row counts, sign-in, representative cards, and change history.

Target recovery time is 30 minutes. Free D1 Time Travel provides seven days of
history, so investigate data incidents promptly.

## Monitoring and targets

Use an external HTTPS monitor for:

- `/api/health/live`: process and routing are alive.
- `/api/health/ready`: D1 can answer a query.
- Jobs heartbeat: alert when no ping arrives within 10 minutes.

Route alerts to Discord and email. Review Cloudflare usage weekly. Internal
targets are 99.9% monthly availability, API p95 under 500 ms, Discord
acknowledgement under 2.5 seconds, and scheduled updates no more than 10 minutes
late. These are engineering targets, not a Free-plan SLA.

Start on Workers Free. Investigate at 60% of any daily limit and upgrade rather
than risk an outage at 80%. Upgrade sooner for normal-flow CPU-limit errors, more
than seven days of recovery history, more than five schedules, or heavier jobs.

## Incident checklist

- Confirm which environment and which surface (assets, API, D1, Discord, jobs).
- Capture UTC time, correlation ID, Worker version, response code, and a minimal
  reproduction without copying private card contents.
- Check Cloudflare status before changing application state.
- Prefer Worker rollback for code regressions; do not restore D1 as a reflex.
- Rotate a credential immediately if logs or output may have exposed it.
- After recovery, record cause, detection gap, lost/delayed work, and one owned
  prevention action.
