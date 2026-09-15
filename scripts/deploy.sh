#!/usr/bin/env bash
# deploy.sh [--preview]
# Build the static site and push build/ to Netlify.
#
#   bun run deploy              production deploy → https://wam-2026.netlify.app
#   bun run deploy -- --preview draft deploy on a unique URL; production untouched
#
# The build runs HERE, not on Netlify: the CLI uploads the finished
# build/ folder, so what ships is exactly what was just built and
# checked locally. netlify.toml's [build] block only matters if the
# site is ever connected to the git repo for remote builds.
#
# Auth is the Netlify CLI's own: a prior `npx netlify-cli login`, or
# NETLIFY_AUTH_TOKEN in the environment. Nothing secret lives in this
# file — the site ID below is an identifier, not a credential.
#
# The project lives in Key's WORK Netlify account (jclark@folklore.digital,
# team jclark-xj5zt-m). Deploying under any other login fails with
# "Project not found" before uploading anything — check with
# `npx netlify-cli status`, switch with `npx netlify-cli switch`.
#
# Never run this without Key's explicit instruction: free tier.
set -euo pipefail
cd "$(dirname "$0")/.."

# Netlify project "wam-2026" (work team jclark-xj5zt-m). Override to deploy elsewhere.
SITE_ID="${NETLIFY_SITE_ID:-fab2bf88-3555-4b62-9661-c041a71cc943}"

MODE=prod
for a in "$@"; do
  case "$a" in
    --preview) MODE=preview ;;
    *) echo "unknown arg: $a (usage: deploy.sh [--preview])" >&2; exit 1 ;;
  esac
done

# A deploy is a snapshot of the working tree, not of a commit. Say so
# when they differ, rather than letting a URL quietly carry
# uncommitted work nobody can find in git afterwards.
REV="$(git rev-parse --short HEAD)"
DIRTY="$(git status --porcelain | wc -l | tr -d ' ')"
if [ "$DIRTY" != "0" ]; then
  echo "warning: $DIRTY uncommitted change(s) will ship in this deploy (HEAD $REV)" >&2
  REV="$REV+dirty"
fi

bun run build

FLAGS=(deploy --dir build --site "$SITE_ID" --message "$REV")
[ "$MODE" = prod ] && FLAGS+=(--prod)

npx --yes netlify-cli "${FLAGS[@]}"
