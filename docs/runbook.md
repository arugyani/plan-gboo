# Operations runbook

## Normal checks

Monitor `/api/health/live` and `/api/health/ready` from outside Cloudflare every
five minutes. Liveness isolates the Worker; readiness includes the bot and
MongoDB/Discord health. Alert only on repeated failure to avoid noise during a
single deploy.

Review weekly:

- Worker dynamic request count and CPU-limit errors.
- bot restarts, health failures, and Discord reconnects.
- MongoDB storage, connections, and backup status.
- dependency alerts and failed scheduled workflows.
- Worker Free-plan usage: dynamic requests, CPU-limit errors, and current asset
  totals. This architecture does not use D1.

Targets are 99.9% monthly availability, API p95 under 500 ms, and recovery within
30 minutes. These are internal targets, not a free-plan service guarantee.

Investigate repeated usage above 60% of a free quota. Upgrade before 80%, when
normal requests hit the Worker CPU limit, or when the single always-on Fly
machine no longer meets the availability target. Do not wait for an outage to
make the decision.

## Website outage

1. Check `/api/health/live`. If it fails, inspect the latest Worker deployment
   and Cloudflare logs using the response correlation ID.
2. Check `/api/health/ready`. If only readiness fails, investigate the bot before
   changing the website.
3. A failed production smoke check normally triggers an automatic rollback.
   Confirm it completed; if it did not, identify the prior stable version in the
   workflow log and use Wrangler's version rollback flow.
4. Run both health checks and one signed-in dashboard read after rollback.

## Bot/backend outage

1. Check `https://boof-ban.fly.dev/health` and Fly machine status/logs.
2. Confirm Discord and MongoDB provider status before restarting healthy code.
3. If the new release is unhealthy, redeploy the previous Git revision through
   the protected bot workflow.
4. Verify one Discord read command, dashboard readiness, and a harmless card
   edit after recovery.

If the bot starts but the API reports `api_not_configured`, confirm the Fly
`Web__ApiKey` secret is at least 32 bytes and matches the Worker's
`BOT_API_TOKEN`. Rotate both sides together; do not print either value.

## Data recovery

Do not automatically restore MongoDB. A restore can discard valid writes made
after the incident. Stop mutation traffic, identify the exact affected records
and recovery point, take a fresh snapshot, obtain organizer approval, restore,
then compare card counts and representative records before reopening writes.

## Credential incident

Rotate in this order: exposed service/deploy credential, dependent environment
bindings, then affected sessions. Redeploy after rotation and search logs only
for safe identifiers—never paste tokens into issues or chat.
