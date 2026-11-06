# JalanGo

Smart, Malaysia-first navigation: live map, GPS, destination search, traffic-aware routing with turn-by-turn guidance, and opt-in anonymous traffic data collection. Also includes community road reports with live updates, and email accounts.

```
.
├── web/        React 19 + TypeScript + Vite + Tailwind 4 + Mapbox GL JS
├── server/     Node.js + Express 5 API (holds Mapbox credentials, validation, rate limits)
└── supabase/   SQL migrations (Postgres schema, RLS, anti-spam triggers, Realtime)
```

## Quick start

```bash
npm install
cp web/.env.example web/.env          # optional – leave empty for demo mode
cp server/.env.example server/.env    # optional – leave empty for demo mode
npm run dev                           # API on :8787, web on :5173
```

Open http://localhost:5173. Browsers only share GPS on `https://` or `localhost`.

### Demo mode vs live data

The app works with **no credentials at all**. Everything that isn't live is labelled in the UI:

| Feature | With credentials | Without (demo) |
|---|---|---|
| Basemap | Mapbox Navigation day/night styles, including Mapbox's live traffic layer (`VITE_MAPBOX_PUBLIC_TOKEN`) | OpenStreetMap data rendered by CARTO, with **no traffic layer** |
| Place search | Mapbox Search Box + Geocoding via the API server (`MAPBOX_ACCESS_TOKEN`) | ~30 bundled Malaysian cities and landmarks, tagged **Sample** |
| Routing | Mapbox Directions `driving-traffic`: alternatives, live congestion colouring, toll and highway flags, avoid tolls | A straight line labelled **Demo**, with a rough 50 km/h time estimate. No made-up road route or turns |
| Nearby petrol / R&R / EV / parking / hospital | Mapbox category search | Not shown. JalanGo doesn't invent locations |
| Community reports and accounts | Supabase: email sign-in, reports, votes, Realtime updates | "Not connected" state. No fake incidents |

The Profile tab shows which sources are live.

### Environment variables

| Where | Variable | Notes |
|---|---|---|
| `web/.env` | `VITE_MAPBOX_PUBLIC_TOKEN` | **Public** `pk.*` token only. Restrict it to your domains in Mapbox. A `sk.*` token is refused at runtime. |
| `web/.env` | `VITE_API_BASE_URL` | Empty = same origin `/api` (Vite proxies to :8787 in dev) |
| `web/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Anon key is public by design; data is protected by RLS |
| `server/.env` | `MAPBOX_ACCESS_TOKEN` | Used for Geocoding/Search/Directions. Never sent to the browser |
| `server/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-only (Phase 3 moderation/validation) |
| `server/.env` | `PORT`, `CORS_ORIGINS` | Defaults: `8787`, `http://localhost:5173` |

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ ok, integrations: { mapbox, supabase } }` |
| GET | `/api/geo/search?q=&lng=&lat=&limit=` | Place name / address / 5-digit postcode / town search, scoped to Malaysia |
| GET | `/api/geo/reverse?lng=&lat=` | Reverse geocode |
| GET | `/api/geo/category?category=petrol\|rnr\|ev\|parking\|hospital\|food&lng=&lat=` | Nearby places |
| GET | `/api/directions?from=lng,lat&to=lng,lat&avoidTolls=1` | Traffic-aware routes (up to 3): geometry, steps, congestion per segment, tolls/highway flags |
| POST | `/api/probes` | Opt-in anonymous GPS samples (see below). Returns `202 { stored }` |

Inputs are validated with zod. Rate limits per IP: `/api/geo/*` 120 requests/min, `/api/directions` 60/min, `/api/probes` 12/min. Upstream failures map to clean JSON errors (`503 mapbox_not_configured`, `502 upstream_*`, `429`), and the web client falls back to demo data when the service is unavailable.

## Deploy (Netlify: web + API on one domain)

`netlify.toml` builds the web app into `web/dist` and deploys the Express API as a Netlify Function (`netlify/functions/api.ts`). Requests to `/api/*` are routed to the function, so the app works on one domain without CORS setup.

1. On Netlify: **Add new site → Import an existing project → GitHub →** `feerthaus/jalango`. Keep the detected settings.
2. Under **Site configuration → Environment variables**, add:

   | Variable | Value | Used by |
   |---|---|---|
   | `VITE_MAPBOX_PUBLIC_TOKEN` | Mapbox `pk.…` (URL-restricted) | web (build time) |
   | `VITE_SUPABASE_URL` | Supabase project URL | web (build time) |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key | web (build time) |
   | `MAPBOX_ACCESS_TOKEN` | Mapbox token **without** URL restriction | API function |
   | `SUPABASE_URL` | Supabase project URL | API function |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role/secret key (mark as secret) | API function |

3. Deploy (or **Trigger deploy** after adding variables, because `VITE_*` values are baked in at build time).
4. Supabase → **Authentication → URL Configuration**: set **Site URL** to your Netlify URL and add it under **Redirect URLs**.
5. Mapbox: add the Netlify domain to the web token's allowed URLs (if restricted).

Every push to `main` redeploys automatically.

## Try it on your phone (quick tunnel)

Browsers only give GPS to `https://` pages or `localhost`. For quick tests on a real phone, expose the dev server through a free Cloudflare quick tunnel. Vite already proxies `/api` to the server, so one tunnel is enough.

```bash
# one-time install (Debian/Ubuntu/Pop!_OS)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# with `npm run dev` running in another terminal:
cloudflared tunnel --url http://localhost:5173
```

Open the printed `https://….trycloudflare.com` address on your phone. The address changes every time the tunnel starts, and it only works while your laptop is running. For a permanent link, deploy the app.

## Install on your phone (PWA)

JalanGo is an installable web app with a manifest, a service worker and home-screen icons.

- **Android (Chrome/Edge):** an **Install JalanGo** card appears on the map, and Profile has an Install button. You can also use ⋮ → *Install app*.
- **iPhone (Safari):** tap **Share → Add to Home Screen**. The in-app card shows these steps.
- Installed, it opens full screen like a native app. The home-screen icon also has *Report* and *Saved* shortcuts.
- The service worker only caches the app shell for offline start. Maps, routes, search, auth and reports always come live from the network.
- Installing requires `https://`. Use the quick tunnel above or a deployed URL.

Brand assets are in `web/public/brand/` (`jalango-mark.svg`, `jalango-wordmark.svg`) and `web/public/icons/`.

## Supabase setup (reports, accounts, traffic data)

1. Create a **new** project at https://supabase.com. Use a separate project from any other app.
2. Open **SQL Editor** and run each file in `supabase/migrations/` in name order. Alternatively, run `supabase link` then `supabase db push`.
3. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173` (your real domain later). Confirmation emails link back to this address.
4. In **Project Settings → API**, copy these values:
   - Project URL → `VITE_SUPABASE_URL` (web) and `SUPABASE_URL` (server)
   - `anon` public key → `VITE_SUPABASE_ANON_KEY` (web)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only**, never in `web/.env`)
5. Restart `npm run dev`. Profile → Data sources should show **Community database: Supabase configured**.

## Database (Supabase)

Use a **dedicated Supabase project** for JalanGo, then apply `supabase/migrations/*.sql` with `supabase db push` or the SQL editor.

The migration creates:

- `users`: a profile row created by a trigger on `auth.users`. Users can read their own profile and edit only `name`.
- `traffic_reports`: 7 report types, a Malaysia bounding-box check, and a 280-character limit on descriptions. Status, counters and expiry are set by the server. Anti-spam rules: at most 5 reports per 10 minutes and 30 per day per user, and no repeat report of the same type within about 150 m within 30 minutes. Anyone, including guests, can read reports. Signed-in users can insert reports as themselves. Clients can't update reports directly.
- `report_confirmations`: one vote per user per report (`confirm` / `resolved`). You can't confirm your own report. Triggers keep the counters in sync, mark a report resolved when its owner resolves it or when there are at least 3 resolve votes that outnumber the confirms, and extend the expiry of confirmed reports.
- `saved_locations`, `recent_destinations`: rows are visible only to their owner. Saved locations are de-duplicated per point, and recent destinations are trimmed to the latest 20.
- Realtime publication for `traffic_reports` and `report_confirmations`, plus `expire_stale_reports()` (schedule it with pg_cron; see the comment in the migration).

## Own traffic data (opt-in)

JalanGo uses Mapbox for now, and also collects its own traffic data from drivers who agree to share it. This data will later be used to build JalanGo's own traffic layer.

- **Consent first.** The data is off until the user agrees, either in the one-time prompt on the route panel or with the switch in Profile. Turning the switch off stops collection immediately, even in the middle of a trip.
- **Anonymous.** Each trip gets a random id. No user id, email or device id is sent.
- **Filtered on the device.** Samples are sent only while navigating. Nothing within 300 m of the trip's start or destination is sent. Fixes less accurate than 50 m are dropped. Samples are thinned to about one per 5 s or 75 m and sent in batches.
- **Validated on the server.** Points must be inside Malaysia, with plausible speeds and increasing timestamps. Probe uploads have their own rate limit.
- **Stored server-side only.** Samples go to the `probe_samples` table (migration `20261105000000`). RLS lets no client read the table. Raw rows are deleted after 30 days by `purge_old_probe_samples()`.

Storing samples requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server. Without them, the API accepts uploads and discards them (`stored: false`).

Under Malaysia's PDPA, location data is personal data. Get legal advice on the privacy notice before a public launch.

## Architecture (web)

```
src/
├── components/   map/ search/ places/ navigation/ reports/ auth/ layout/ ui/   (presentational + feature components)
├── contexts/     Theme, Auth, ServiceStatus (live vs demo), Location (single GPS watcher), SavedPlaces, Map, Routing, Reports (+ Realtime)
├── hooks/        useGeolocation, usePlaceSearch (debounced, abortable), useShowOnMap, …
├── services/     apiClient, geocodingService (+ demo fallback), routingService, reportsService, probeService, healthService, placeStore
├── lib/          config (env), mapStyles, supabase client, reportTypes
├── layouts/      AppLayout: persistent map + routed overlay + nav
├── pages/        Map, Explore, Reports, Saved, Profile
├── data/         clearly-labelled offline sample places
├── types/        shared domain types (incl. Route and TrafficReport contracts for later phases)
└── utils/        geo maths, route progress (snap to route, step tracking, off-route), formatting
```

- The map is mounted **once** in the layout. Tabs render over it: full screen on mobile, a side panel on desktop. Switching tabs never reloads the map.
- Map, GPS, search and persistence are separate modules. Routing (Phase 2) and reporting (Phase 3) add their own `services/` and `contexts/` without touching these.
- Favourites and recents use a `PlaceStore` interface (localStorage today). Phase 4 swaps in a Supabase-backed store.

## Scripts

```bash
npm run dev         # both apps
npm run typecheck   # server + web
npm run test        # vitest (server + web)
npm run build       # production builds
```

## Roadmap

- [x] **Phase 1**: project setup, full-screen map, GPS (permission/error handling, follow mode, speed), destination search (name/address/postcode/city, autocomplete, recents, favourites), dark/light map, Explore and Profile tabs, Supabase schema
- [x] **Phase 2**: traffic-aware routes via the API, alternatives, ETA and arrival time, toll/highway flags, avoid tolls, turn-by-turn banner and list, start/end navigation, rerouting when off-route, arrival detection, driving camera
- [x] **Own data, step 1**: opt-in anonymous GPS probe collection (`probe_samples`)
- [ ] **Own data, step 2**: map-match samples to road segments, aggregate speeds, show a JalanGo traffic layer
- [x] **Phase 3**: report submission at the GPS position (7 types, optional note), map markers, a nearby list with filters, "still there" / "not there" votes, owners can clear or delete their reports, Supabase Realtime updates, anti-spam in the database plus a client cooldown, email sign-in and registration
- [x] **Hazard alerts while navigating**: the nearest report on the route ahead, with vibration and voice at about 800 m (mutable), a "still there?" prompt after passing, and a report count on each route option
- [x] **Driving comfort**: GPS starts automatically on open (unless blocked), the active trip resumes after the app is closed (recalculated from the current position, kept for 8 h), and the screen stays on while navigating (Wake Lock)
- [ ] **Phase 4**: profile editing, favourites and recents synced to Supabase, report history, password reset
- [ ] **Phase 5**: E2E tests, offline handling, performance passes
