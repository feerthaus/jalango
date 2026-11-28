#!/usr/bin/env bash
# Netlify build "ignore" command: exit 0 = skip this build, exit 1 = build.
# Skips only when nothing deployable changed since the last build Netlify made
# (CACHED_COMMIT_REF). Any doubt builds.
set -u
if [ "$(bash "$(dirname "$0")/needs-deploy.sh" "${CACHED_COMMIT_REF:-}" "${COMMIT_REF:-HEAD}")" = skip ]; then
  echo "No app changes since ${CACHED_COMMIT_REF:-?}: skipping this build (docs, migrations, workflows or tests only)."
  exit 0
fi
exit 1
