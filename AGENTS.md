# JalanGo Engineering Handbook

For every contributor, human or AI agent (Claude, Codex, Gemini…). Read [`docs/VISION.md`](docs/VISION.md) for the why; this file is the how.

## Repository

```
web/       React 19 + TypeScript + Vite + Tailwind 4 + Mapbox GL (PWA)
server/    Express 5 API, deployed as a Netlify Function (netlify/)
supabase/  SQL migrations: schema, RLS, triggers, RPCs
scripts/   data jobs (e.g. speed-camera export from Geofabrik)
docs/      vision and design notes
```

- The web app talks to providers **only through `/api/*`** (server) or Supabase (with RLS). Never put a secret key in `web/`.
- Web layout: `contexts/` (state), `services/` (I/O), `utils/` (pure logic, unit tested), `components/`, `pages/`.

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

`npm ci` installs, `npm run typecheck` checks types, `npm test` runs Vitest (server and web), `npm run build` builds, and `npm run dev` starts the API on :8787 and the web app on :5173.

CI (`.github/workflows/ci.yml`) runs `npm ci`, typecheck, test and build on every PR, and all four must pass.

## Workflow

- Work on a feature branch and open a PR to `main`. Netlify deploys `main` automatically and builds a preview for each PR.
- **Merge only when the owner says so.** No force-push, and never rewrite `main`.
- Do not deploy or apply production migrations before review, unless the owner asks.
- Keep changes focused. Put tests and the Privacy Policy update in the same PR as the feature.
- Describe every new or changed user-facing feature in [`docs/FEATURES.md`](docs/FEATURES.md) (Malay) in the same PR.

## Supabase migrations

- File name: `supabase/migrations/YYYYMMDDHHMMSS_name.sql`. Never edit a migration that has already been applied; add a new one.
- **Avoid `DROP` and `DELETE` in migrations.** They need interactive confirmation on the hosted project. Prefer additive changes: a new `fn_v2` instead of dropping a function, self-resetting rows instead of cleanup deletes.
- Every table has **RLS enabled**, with explicit policies per role (`anon`, `authenticated`).
- `SECURITY DEFINER` functions use `set search_path = ''` and fully qualified names. Revoke `execute` from `public`, `anon` and `authenticated` on trigger functions.
- For user content, use a BEFORE INSERT trigger to force server-owned fields (status, counts, timestamps), check ownership against `auth.uid()`, rate-limit (raise with `hint = 'rate_limited'`), and add a restrictive "no posting while banned" policy (`public.is_banned()`).
- For votes: one row per (item, user); block voting on your own item; let an AFTER trigger recount and auto-hide when downvotes ≥ 5 and > 2× upvotes.
- Test migrations locally (e.g. PGlite with stubbed `auth.uid()`) before applying them.
- Admin powers go through `public.is_admin()`, which requires a two-factor session (`aal2` in the JWT). Never add an admin check that bypasses it.

## Server rules

- Call `guardUsage(...)` **right before** each paid upstream call, so every call counts, including retries and fallbacks.
- Mark each route `withUsagePolicy('critical' | 'optional')`. Navigation is critical; extras are optional (see the failure policy in VISION.md).
- Rate limiting has two layers: in memory, then Supabase `hit_rate_limit`. Clients are identified by an HMAC of the IP from `x-nf-client-connection-ip`.
- Validate every query with zod. Never log raw coordinates or IPs.

## Web rules

- **Language:** Malay first. Write strings as `t('Malay', 'English')` using `useT()` from `lib/i18n`.
- Label demo or sample data in the UI. Never present a guess as live data.
- Keep pure logic in `utils/` and give it Vitest tests. Check UI flows with Playwright, mocking `/api/*` and Supabase.
- Mobile first: test at phone width, and with the map pane and bottom panels open.
- **Experimental safety features** (e.g. the oncoming-vehicle "Jangan potong" alert) stay opt-in, labelled experimental, and require acknowledgement.

## Privacy & data (PDPA)

- GPS traces stay on the device unless the user shares a shortcut or community route. When they do, trim the ends: 300 m for shortcuts, 1 km for community routes.
- Anonymous traffic (probe) data is opt-in, carries no account, and drops points near the start and end of the trip.
- Do not store Mapbox results to build our own database. OSM-derived data is ODbL share-alike.
- No individual-level data is ever sold or shared.
- Any change to what is collected or shown updates `PrivacyPage.tsx` (BM and EN) and `LEGAL.lastUpdated`.

## Secrets

- Never commit `.env` files or keys. The Supabase service-role key and Mapbox secret token live only in Netlify / server environment variables.
- `VITE_*` variables are public by design. Only publishable keys go there.
- Do not touch Supabase projects other than JalanGo's.
