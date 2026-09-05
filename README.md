# RGBOO Board

A small shared organizer for the RGBOO Discord group. It is a React 19 + Vite +
Tailwind interface served by a Cloudflare Worker, with Discord sign-in and a
light Halloween theme. The running Discord bot and the website read and update
the same MongoDB cards.

## What works

- My List, per-board views, All Together, search, filters, recaps, and shared
  change history.
- Five calm default columns—Ideas, Up Next, Doing, Waiting, and Done—that an
  organizer can rename, recolor, and reorder.
- Card creation and editing, Markdown notes, multiple people, importance, date,
  waiting state, comments, checklists, GitHub issue links, and links back to
  source Discord messages.
- Groups, group themes, people roles, and board management for organizers.
- Discord OAuth with signed sessions and guild-membership revalidation.
- Version-checked saves, optimistic move rollback, and a 30-second refresh.
- Discord slash commands, buttons, and **Add to The Board** all use the same
  card records as the website.
- Cloudflare staging/production configuration, GitHub CI/CD, health endpoints,
  browser coverage, Axe checks, and deployment smoke tests.

## One source of truth

```text
Browser
  │ same-origin /api + signed Discord session
  ▼
Cloudflare Worker
  │ service credential + trusted Discord identity
  ▼
Discord bot API ──► shared repositories ──► MongoDB
       ▲
       └──────── Discord commands use the same repositories
```

There is no frontend database, runtime fixture data, or synchronization job. A
save from Discord or the site updates the same card. Test fixtures live only
under `src/test`. See [Architecture](docs/architecture.md) and the [backend
contract](docs/backend-contract.md).

## Local setup

Requirements: Node.js 24, npm 11, and access to a configured bot API.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Set these values in `.env.local`:

```dotenv
BOT_API_ORIGIN=https://boof-ban.fly.dev
BOT_API_TOKEN=at-least-32-random-bytes-shared-with-the-bot
BOT_DISCORD_GUILD_ID=your-server-id
BOT_DISCORD_USER_ID=your-user-id
```

The last two values make local authorization explicit. No secret is bundled in
the browser; Vite holds them in its development proxy. Open
`http://localhost:3000`.

## Checks

```bash
npm run verify
npm run test:coverage
npm run test:e2e
npm run cf:types
npm run cf:dry-run
```

`verify` covers formatting, linting, TypeScript, unit tests, real `workerd`
tests, and the production build. Playwright separately covers Chromium,
Firefox, WebKit, desktop/mobile layouts, Axe audits in Chromium and WebKit, and
a 100-visible/2,000-stored-card performance budget.

## Deployment

The configured Workers are:

- `rgboo-organizer.<account>.workers.dev`
- `rgboo-organizer-staging.<account>.workers.dev`

Follow [Deployment](docs/deployment.md) for the Cloudflare, Discord, bot, and
GitHub Environment values. Once those are set, `main` deploys staging after CI;
production uses the manually approved **Deploy production** workflow.

Deploy the `kanban` backend before this repository when the API contract
changes. Older backend releases remain readable, but the new five-column model,
shared history, and Discord-source links appear only after the backend release.

For a local authenticated deployment:

```bash
npx wrangler login
npm run deploy:staging
npm run smoke
```

The deploy script validates every required value, writes credentials only to a
permission-restricted temporary file, and removes it even when deployment fails.

## Repositories

- Web/Worker: `https://github.com/arugyani/pgboo`
- Discord bot/backend: `https://github.com/arugyani/kanban`

The bot may be checked out as `kanban/` beside this README for local end-to-end
work, but it remains its own Git repository and deployment.
