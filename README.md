# JalanGo

Smart, Malaysia-first navigation: live map, GPS, destination search, and (in upcoming phases) routing, community traffic reports and accounts.

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
| Nearby petrol / R&R / EV / parking / hospital | Mapbox category search | Not shown. JalanGo doesn't invent locations |
| Community reports | Supabase (Phase 3) | Empty state. No fake incidents |

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

Inputs are validated with zod. `/api/geo/*` is rate-limited to 120 requests/min per IP. Upstream failures map to clean JSON errors (`503 mapbox_not_configured`, `502 upstream_*`, `429`), and the web client falls back to demo data when the service is unavailable.

## Database (Supabase)

Use a **dedicated Supabase project** for JalanGo, then apply `supabase/migrations/*.sql` with `supabase db push` or the SQL editor.

The migration creates:

- `users`: a profile row created by a trigger on `auth.users`. Users can read their own profile and edit only `name`.
- `traffic_reports`: 7 report types, a Malaysia bounding-box check, and a 280-character limit on descriptions. Status, counters and expiry are set by the server. Anti-spam rules: at most 5 reports per 10 minutes and 30 per day per user, and no repeat report of the same type within about 150 m within 30 minutes. Anyone, including guests, can read reports. Signed-in users can insert reports as themselves. Clients can't update reports directly.
- `report_confirmations`: one vote per user per report (`confirm` / `resolved`). You can't confirm your own report. Triggers keep the counters in sync, mark a report resolved when its owner resolves it or when there are at least 3 resolve votes that outnumber the confirms, and extend the expiry of confirmed reports.
- `saved_locations`, `recent_destinations`: rows are visible only to their owner. Saved locations are de-duplicated per point, and recent destinations are trimmed to the latest 20.
- Realtime publication for `traffic_reports` and `report_confirmations`, plus `expire_stale_reports()` (schedule it with pg_cron; see the comment in the migration).

## Architecture (web)

```
src/
├── components/   map/ search/ places/ reports/ layout/ ui/   (presentational + feature components)
├── contexts/     Theme, ServiceStatus (live vs demo), Location (single GPS watcher), SavedPlaces, Map
├── hooks/        useGeolocation, usePlaceSearch (debounced, abortable), useShowOnMap, …
├── services/     apiClient, geocodingService (+ demo fallback), healthService, placeStore
├── lib/          config (env), mapStyles, supabase client, reportTypes
├── layouts/      AppLayout: persistent map + routed overlay + nav
├── pages/        Map, Explore, Reports, Saved, Profile
├── data/         clearly-labelled offline sample places
├── types/        shared domain types (incl. Route and TrafficReport contracts for later phases)
└── utils/        geo maths, formatting
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
- [ ] **Phase 2**: Mapbox Directions via the API, route polyline and alternatives, ETA, turn-by-turn panel, start/end navigation, toll information
- [ ] **Phase 3**: report submission, map markers, confirm/resolve, Supabase Realtime
- [ ] **Phase 4**: Supabase Auth (email), profiles, synced favourites/recents, report history
- [ ] **Phase 5**: E2E tests, offline handling, performance passes
