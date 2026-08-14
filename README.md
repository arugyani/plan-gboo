# The Board

A small, friendly group organizer for 10–20 people. The Board combines a clean
Halloween-themed dashboard, Discord sign-in and commands, Cloudflare D1 storage,
and GitOps delivery without turning collaboration into corporate project
management.

## What is included

- **My List**, **Boards**, **Groups**, **People**, and **What’s Happening** views.
- Multiple groups per person, group-level organizer/member/view-only roles, and
  a global recovery admin.
- Multiple boards with renameable and reorderable columns.
- Cards with Markdown notes, people, importance, date, tags, waiting reasons,
  checklists, comments, change history, and stable keys such as `WEB-21`.
- One or more validated GitHub issue links on each card. V1 stores the canonical
  issue URL and repository coordinates; it does not require a GitHub token or
  silently modify GitHub.
- Accessible drag and drop plus Move up, Move down, and Move to column controls.
- Optimistic moves with rollback and version-checked edits.
- Saved **All Together** views. Combined boards are editable but intentionally
  not draggable because their columns may mean different things.
- Discord OAuth plus slash commands, modals, buttons, message-to-card creation,
  signature checks, timestamp checks, guild checks, and retry deduplication.
- A separate five-minute jobs Worker for notifications, retries, recaps, guild
  reconciliation, and monitoring heartbeat.

## Stack

The local and CI toolchain is Node.js 24 LTS with npm. The deployed code runs in
Cloudflare `workerd`, so Bun would not make the live app faster.

- React 19, TypeScript, Vite/Vinext, Tailwind CSS 4, shadcn `base-nova`
- TanStack Query, React Hook Form, Zod, Pragmatic Drag and Drop
- Better Auth with Discord, Drizzle ORM, Cloudflare D1
- Cloudflare Workers Static Assets, API Workers, and Cron Triggers
- Vitest, Testing Library, Playwright, and Axe

The React and Vite patch versions are newer than the originally proposed pins
because the old versions gained high-severity advisories before this build was
completed.

## Run locally

Requirements: Node.js 24 and npm.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate:local
npm run dev
```

Open `http://localhost:3000`. `DEMO_MODE=true` provides realistic, mutable demo
data without Discord credentials. Local demo mutations are intentionally reset
when the Worker restarts.

For real local Discord auth, set `DEMO_MODE=false`, fill the Discord and Better
Auth values in `.env.local`, and register this redirect URL:

```text
http://localhost:3000/api/auth/callback/discord
```

## Useful checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
npm run verify
```

The browser matrix covers desktop and mobile widths in Chromium, Firefox, and
WebKit. It includes accessibility, focus restoration, combined-view behavior,
GitHub links, and a 2,000-card/100-visible-card responsiveness budget.

## Cloudflare setup

Production and staging are separate installations. Create two D1 databases and
two Discord applications:

```bash
npx wrangler login
npx wrangler d1 create rgboo-organizer-staging
npx wrangler d1 create rgboo-organizer-production
```

The first live deployments will be:

- `rgboo-organizer-staging.<your-subdomain>.workers.dev`
- `rgboo-organizer.<your-subdomain>.workers.dev`

Use each exact URL for its Better Auth origin and Discord configuration:

```text
OAuth redirect: https://<worker-url>/api/auth/callback/discord
Interactions:   https://<worker-url>/api/discord/interactions
```

Do not put real database IDs or credentials in `wrangler.jsonc`. The deployment
workflows build a flattened Wrangler configuration from GitHub environment
values. See [Discord setup](docs/discord.md) and the
[deployment runbook](docs/runbook.md) for the complete checklist.

For a manual staging deployment, export the values shown in `.env.example`, then
run:

```bash
npm run deploy:staging
npm run deploy:jobs:staging
npm run discord:sync
```

## GitOps

The repository is ready before the GitHub organization exists:

- Pull requests run format, lint, types, unit tests, a fresh D1 migration,
  builds, Worker dry-runs, dependency audit, Playwright, and Axe.
- A successful `main` build deploys staging and smoke-tests it.
- Production is a manual workflow using a tested commit SHA and a protected
  GitHub `production` environment with one required approver.
- Production records the current deployment and D1 Time Travel bookmark, applies
  backward-compatible migrations, tests a preview version, and atomically
  promotes it. A failed live smoke test rolls back the main Worker.
- D1 restore is deliberately manual because restoring automatically can discard
  legitimate writes made after a release.

Configure protected `main` with one review, required `CI / Verify`, and no direct
pushes. Forked pull requests receive no deployment secrets.

## Operations

Monitor `/api/health/live` and `/api/health/ready` externally. Configure the jobs
heartbeat URL for cron monitoring. The free plan is the intended starting point;
the measured upgrade thresholds and recovery commands are in
[the runbook](docs/runbook.md).

OpenMoji artwork is used under CC BY-SA 4.0; attribution is recorded in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
