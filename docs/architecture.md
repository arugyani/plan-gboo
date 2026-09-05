# Architecture

## Components

1. The React single-page app renders boards and sends JSON to same-origin
   `/api/*` routes. TanStack Query refreshes every 30 seconds and on focus.
2. The Cloudflare Worker serves the built assets, completes Discord OAuth,
   validates signed session cookies, and acts as a backend-for-frontend proxy.
3. The .NET Discord bot hosts the private board API and Discord commands.
4. MongoDB is the sole persistent store for groups, boards, cards, assignments,
   checklists, comments, GitHub issue links, Discord source links, and change
   history.

The web and bot repositories deploy independently. API/model changes therefore
remain additive and backward compatible.

## Authentication and authorization

The website starts the Discord authorization-code flow with the `identify`
scope. A cryptographically random state value ties the callback to the browser.
After exchanging the one-time code, the Worker stores only the Discord user ID
inside an HMAC-signed, seven-day HttpOnly cookie; Discord access tokens are not
persisted.

For API calls, the Worker removes caller-controlled credentials and identity
headers, then adds its bot service token, the session's Discord user ID, and the
configured guild ID. The bot checks the service token in constant time, fetches
the member from Discord, and applies these roles:

- `admin`: guild owner or configured bootstrap administrator.
- `organizer`: manages a group's people, boards, and theme.
- `member`: reads and changes cards in the group.
- `view_only`: reads the group but cannot mutate it.

A missing Discord member is rejected even if a stale session or Mongo record
still exists.

## Shared product model

Every board exposes five columns. The visible names, colors, and order can be
changed by an organizer, while the stored status values remain stable for old
Discord cards. A floating-point rank orders cards within a column and allows an
insert between neighbors without rewriting every card.

**All Together** combines selected boards for searching, filtering, and opening
cards. It deliberately has no drag-and-drop because two boards may give the
same position different meanings. The card sheet always offers explicit column,
Move up, and Move down controls for touch and keyboard use.

Every saved card change stores who acted, what changed, and when. The card keeps
the latest 100 entries and the dashboard exposes the newest 50 as **What’s
Happening**. Discord slash commands, component buttons, the message action, and
website writes all append to this same history.

The Discord message action stores the selected message ID and jump URL. A
partial unique MongoDB index plus a guarded insert makes Discord retries
idempotent.

## Consistency

Each card has a monotonically increasing version. Mutation requests include the
version the editor saw. A mismatch returns `409 version_conflict`; the UI
refreshes and reports that the card changed instead of silently overwriting the
other edit.

Moves are optimistic in the browser. The previous dashboard snapshot is kept,
and a rejected move restores it before refreshing authoritative data.

Discord commands also use compare-and-swap updates. If the website changes a
card between a command read and write, the command asks the person to try again
instead of replacing the newer version.

## Runtime boundaries

Static hashed assets bypass Worker execution. HTML, auth, health, and API paths
run through the Worker so security headers and authentication remain consistent.
The Worker performs no server-side rendering and holds no mutable global data.

The bot reuses one `MongoClient` for the process so the official driver can
pool connections. Startup creates query indexes for board/card order and unique
partial indexes for board names, group names, and Discord source messages.

`/api/health/live` proves the Worker is executing. `/api/health/ready` also
checks the bot's `/health` endpoint. Neither endpoint exposes card data or
credentials.
