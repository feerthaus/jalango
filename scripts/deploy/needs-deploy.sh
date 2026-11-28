#!/usr/bin/env bash
# Does going from commit FROM to commit TO change anything the live site is built
# from? Prints "deploy" or "skip". Used by Netlify's build "ignore" (skip the
# build when nothing deployable changed) and by the "Live check" workflow (no
# deploy is expected then). When unsure (unknown commit, git error) it says "deploy".
# The same commit again (a manual "Trigger deploy", e.g. after changing a Netlify
# environment variable) is always "deploy".
#
# Not deployable: docs, database migrations (applied separately, on the owner's
# "migrate"), the POI import scripts, GitHub workflows, Markdown and test files.
set -u
from="${1:-}"
to="${2:-HEAD}"
if [ -z "$from" ] || ! git cat-file -e "${from}^{commit}" 2>/dev/null || ! git cat-file -e "${to}^{commit}" 2>/dev/null; then
  echo deploy
  exit 0
fi
if [ "$(git rev-parse "${from}^{commit}")" = "$(git rev-parse "${to}^{commit}")" ]; then
  echo deploy
  exit 0
fi
changed=$(git diff --name-only "$from" "$to" -- . \
  ':(exclude)docs/**' ':(exclude)supabase/**' ':(exclude)scripts/poi/**' ':(exclude).github/**' \
  ':(exclude)*.md' ':(exclude)**/*.test.ts' ':(exclude)**/*.test.tsx' 2>/dev/null) || { echo deploy; exit 0; }
if [ -n "$changed" ]; then echo deploy; else echo skip; fi
