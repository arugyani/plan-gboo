# Security policy

Report suspected security issues privately to the repository owners. Do not open
a public issue containing credentials, Discord IDs, private card contents, or an
exploit reproduction against the live installation.

## Dependency policy

CI fails on high or critical advisories in shipped npm dependencies. Dependabot
checks npm packages weekly and GitHub Actions monthly.

The full development-tree audit currently reports `image-size` advisories through
Vinext. The package is used only while building trusted, repository-owned image
metadata; The Board accepts no uploads and does not parse user-supplied ICNS, JXL,
or HEIF files. Production dependency audit has no high or critical findings. Keep
this exception under review and remove it when Vinext publishes a fixed parser;
do not add image uploads while it exists.

## Secrets

Secrets belong in GitHub environments or Cloudflare secret bindings. Never put
them in `.env.example`, Wrangler configuration, workflow logs, cards, or Discord
messages. Use separate credentials for staging and production, scope Cloudflare
tokens narrowly, and rotate suspected exposures before continuing an incident
investigation.
