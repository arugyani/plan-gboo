# Security policy

Report suspected security issues privately to the repository owners. Do not put
credentials, private card contents, Discord IDs, OAuth codes, or exploit details
in a public issue.

## Trust boundaries

- The browser never receives the bot service credential or Discord client
  secret.
- The Cloudflare Worker is the browser-facing boundary. It authenticates with
  Discord and replaces all caller-provided authorization and identity headers.
- The bot API independently verifies its service credential and revalidates the
  claimed person against the configured Discord guild on every request.
- Private group access and write roles are enforced by the bot API, not hidden
  UI controls.

## Secrets

Use separate staging and production credentials. Store them only in Cloudflare
secret bindings, GitHub Environment secrets, Fly secrets, or ignored local env
files. Scope Cloudflare and Fly deployment tokens to the single application.
Rotate a suspected credential before continuing an investigation.

`AUTH_SESSION_SECRET` and the bot `Web__ApiKey`/Worker `BOT_API_TOKEN` must each
be at least 32 random bytes. Session and OAuth state cookies are Secure,
HttpOnly, SameSite=Lax, short-lived where appropriate, and bound to the exact
configured public origin.

## Dependencies

CI runs `npm audit --audit-level=high`, a clean lockfile install, a Worker dry
run, and the bot build/test/container build. Dependabot checks npm, GitHub
Actions, NuGet, and Docker dependencies on a schedule. A high or critical
runtime advisory blocks release unless maintainers document a narrowly scoped,
time-limited exception.
