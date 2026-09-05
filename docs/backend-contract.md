# Backend contract

The Cloudflare Worker forwards these authenticated routes to the Discord bot.
It replaces incoming credentials with `Authorization: Bearer <service key>`,
`X-Discord-Guild-Id`, and `X-Discord-User-Id`. The bot revalidates that member
against Discord before applying group access.

All errors are JSON with a stable `code`, a friendly `message`, and
`correlationId`. Validation uses `400`, missing records use `404`, stale edits
or destructive guards use `409`, and authentication/authorization use
`401`/`403`.

## Dashboard

- `GET /api/dashboard` — viewer, visible people/groups/boards/columns/cards,
  tags, and the newest 50 shared-history entries.

Cards include `version`, floating-point `rank`, people, tags, comments,
checklist items, GitHub links, `discordMessageUrl`, and the latest 100 `changes`.
Old MongoDB cards without history receive one honest fallback entry until their
next save.

## Cards

- `POST /api/cards`
- `PATCH /api/cards/:id`
- `POST /api/cards/:id/move`
- `POST /api/cards/:id/comments`
- `POST /api/cards/:id/checklist`
- `PATCH /api/cards/:id/checklist/:itemId`
- `POST /api/cards/:id/links`
- `DELETE /api/cards/:id/links/:linkId`

Card saves and moves carry `expectedVersion`. A move may also carry
`targetCardId` and `edge: "before" | "after"`; without them it appends to the
destination column. A stale version returns `409 version_conflict`.

Card patches may send existing `tagIds` or a complete `tagNames` list. The
latter creates the first tag in a group as well as applying existing names;
cards accept at most 10 unique tags of 30 characters each.

GitHub links accept only canonical HTTPS issue URLs in the form
`github.com/owner/repository/issues/123`. The backend parses them but does not
fetch arbitrary user-supplied URLs.

## Organizer controls

- `POST /api/groups`
- `PATCH /api/groups/:id`
- `DELETE /api/groups/:id`
- `PUT /api/groups/:id/members/:personId`
- `DELETE /api/groups/:id/members/:personId`
- `POST /api/boards`
- `PATCH /api/boards/:id`
- `DELETE /api/boards/:id`

Only organizers/admins can mutate group structure. Default boards cannot be
deleted; non-empty boards and referenced groups return a conflict instead of
destroying data.

`PATCH /api/boards/:id` can atomically rename/reassign a board or replace its
five validated columns. Column IDs encode the board and stable status; clients
must return the same five IDs with a unique name, supported color, and rank for
each.

## Worker-only routes

- `POST /api/auth/sign-in`
- `GET /api/auth/callback`
- `GET /api/auth/session`
- `POST /api/auth/sign-out`
- `GET /api/health/live`
- `GET /api/health/ready`

The Worker sets API responses to `Cache-Control: no-store`. The liveness route
does not call the backend; readiness calls the bot's unauthenticated `/health`
endpoint without exposing board data.
