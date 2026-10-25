#!/bin/sh
# Local Cloudflare mode (file uploads work): points the Hyperdrive binding at
# DATABASE_URL from .env.local, then builds and runs `wrangler dev`.
cd "$(dirname "$0")/.." || exit 1
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
exec npm run dev:worker
