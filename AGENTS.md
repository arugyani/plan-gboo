# AGENTS.md

This repository is the RGBOO web application and its Cloudflare Worker. Read
this file before changing the project. The Discord bot is a separate repository
checked out locally as `kanban/`; it is intentionally ignored here.

## Architecture invariants

- MongoDB behind the Discord bot is the only source of truth. Do not add browser
  fixtures, local storage, D1, Supabase, or a synchronization database to runtime
  code.
- The browser calls same-origin `/api/*`. The Cloudflare Worker authenticates the
  Discord user, removes untrusted identity headers, adds the server-held service
  credential, and proxies to the bot API.
- The bot and website must call the same repositories and authorization rules.
  A website-only write path is a bug.
- Discord user IDs are identities. Revalidate guild membership in the bot API;
  never trust a user ID supplied directly by browser JavaScript.
- Staging and production use separate Discord OAuth applications, session
  secrets, and preferably separate bot/database installations. The backend URL
  is deployment configuration, not a source change.

## Product contract

- Visible product name: `RGBOO`.
- Use friendly nouns: card, My List, group, people, notes, when, importance,
  organizer, member, view only, and What’s Happening.
- Every board has exactly five organizer-configurable columns. Keep the stored
  status mapping backward compatible even when visible names, colors, or order
  change.
- All Together is a filtered editing view across boards. Do not enable dragging
  there because columns on different boards can have different meanings.
- Use shadcn-style components in `src/components/ui` as the base layer. Keep the
  interface calm, compact, keyboard-operable, and lightly Halloween themed.
- Do not add decorative captions, dense animation, patterned page backgrounds,
  inert controls, or icons without labels/tooltips.
- Drag interactions must always have an equivalent button/select path for touch
  and keyboard users.
- Every request needs loading, empty, error, disabled, success, and recovery
  behavior. Optimistic card moves must visibly roll back on failure.

## Security rules

- Never commit credentials. Only `VITE_*` variables can reach browser bundles;
  this project intentionally has no secret `VITE_*` variables.
- Keep `BOT_API_TOKEN`, Discord client secrets, and session secrets in Cloudflare
  secret bindings or GitHub Environment secrets.
- Keep OAuth state and sessions in Secure, HttpOnly, SameSite cookies. Preserve
  state checking, HMAC validation, session expiry, and the exact-origin check.
- Strip incoming `Authorization`, `Cookie`, `X-Discord-User-Id`, and
  `X-Discord-Guild-Id` before adding trusted proxy headers.
- Avoid logging card contents, OAuth codes, cookies, or credentials. Include a
  correlation ID in safe error logs and API errors.
- Use backward-compatible MongoDB model changes. Existing documents may not
  contain newly added fields.

## Where things live

- `src/App.tsx`: application orchestration and top-level views.
- `src/components/`: feature components; `src/components/ui/` contains the
  shadcn-derived primitives.
- `src/lib/board-api.ts`: typed browser client for the bot API contract.
- `worker/`: Cloudflare OAuth, proxy, health routes, and Worker tests.
- `tests/e2e/`: Playwright behavior, mobile, browser, performance, and Axe tests.
- `scripts/`: secret-safe deploy and post-deploy smoke scripts.
- `docs/`: architecture, deployment, backend contract, and incident runbook.

## Required checks

Use Node.js 24 and the committed npm lockfile. Before handing off a change, run:

```bash
npm ci
npm run verify
npm run test:coverage
npm run test:e2e
npm run cf:types
git diff --exit-code -- worker-configuration.d.ts
npm run cf:dry-run
npm audit --audit-level=high
```

When `kanban/` is changed, also run from that checkout:

```bash
dotnet restore --locked-mode
dotnet format --no-restore --verify-no-changes
dotnet build --no-restore --configuration Release
dotnet test --no-restore --no-build --configuration Release
dotnet list KanbanCord.Bot/KanbanCord.Bot.csproj package --vulnerable --include-transitive --no-restore
dotnet list KanbanCord.Core/KanbanCord.Core.csproj package --vulnerable --include-transitive --no-restore
dotnet list KanbanCord.Tests/KanbanCord.Tests.csproj package --vulnerable --include-transitive --no-restore
docker build .
```

Do not weaken a check to make it pass. Fix the behavior or update a test only
when the product contract intentionally changed.

## Delivery

- Pull requests run all checks without deployment credentials.
- A green `main` deploys staging automatically after the repository-level
  `ENABLE_DEPLOYMENTS` Actions variable is set to `true`.
- Production is a manual workflow protected by the GitHub `production`
  Environment approval.
- Migrations and API changes must be backward compatible because the site and
  bot deploy independently.
- A failed smoke test stops the workflow. Roll back the Worker to the version
  recorded immediately before deployment; database restores are always manual.
