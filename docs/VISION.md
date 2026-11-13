# JalanGo: Vision and Roadmap (2026–2030+)

A condensed version of the owner's *Master Vision & Technology Roadmap*. Engineering review added three things it was missing: data licensing, the agreed failure policy, and PDPA. If this file and a chat prompt disagree, this file wins until the owner changes it.

## Product vision

JalanGo is a Malaysia-first navigation app that works for **all** road users: daily commuters, *balik kampung* drivers, motorcyclists, e-hailing and delivery drivers, convoys and, later on, fleets. It wins on **local knowledge**. That means Malay-first UI and voice, AWAS/speed cameras, fuel prices, R&R and food along the route, and routes the community recommends. Global apps do not cover these well.

## Principles

1. **Don't build our own routing engine too early.** Use Mapbox for routing, traffic and search, and OSM/Photon as the fallback. Build our own engine only when our data and scale justify it.
2. **Modular monolith first.** One Express API (a Netlify Function) and one Supabase project. Split into services only when one part needs a different scale or a different team.
3. **Our own API layer in front of every provider.** The app calls `/api/*`, never a provider directly. A provider sits behind an adapter so it can be swapped.
4. **GitHub is the single source of truth.** Code, migrations, this vision and the engineering handbook (`AGENTS.md`) live in the repository. Every AI agent and human works from them.
5. **Cost control is a feature.** Every paid call is counted and capped (see the failure policy below).
6. **Privacy by default.** Collect the minimum. GPS traces stay on the device unless the user chooses to share. Anonymous traffic data is opt-in.

## Priority

JalanGo's core is a **Waze replacement**: navigation, live traffic and community road data. Everything else (marketplace, rentals, homestays) is an add-on and must never slow down, clutter or distract navigation. The biggest gap to Waze is the platform: as a PWA, JalanGo can't run on Android Auto/CarPlay and loses GPS in the background on iPhone, so a native app (Capacitor, Android first) is the next major step for the core.

**Not doing:** direct booking of e-hailing drivers (needs APAD intermediation licensing).

## Roadmap phases

| Phase | Focus | Status (Nov 2026) |
|---|---|---|
| 1. Foundation | Map, search, routing, turn-by-turn in BM, reports, accounts, PWA | ✅ Live |
| A. Backend hardening | Distributed rate limits, exact usage counting, CI, tests | ✅ Live |
| 2. Community | Reports with voting/moderation, shortcuts, **Community Routes** (long-distance alternatives), accident records & black-spot alerts, Konvoi, Driver mode, live sharing, saved routes | ✅ Live |
| 3. Own data | Anonymous probe data → historical speeds, typical-jam patterns, better ETAs; PostGIS | 🟡 Probe collection running; analysis not built |
| 4. Intelligence | Predictive "leave at" advice, festive-season (*balik kampung*) planning, smarter rerouting from community data | ⏳ |
| 5. Business | Fleet & logistics (builds on Driver mode / Konvoi), aggregated data products, partnerships | ⏳ |
| M. Marketplace (add-on) | Verified homestay and insured car rental listings with WhatsApp contact (APAD licence optional for now by the owner's decision; licensed operators get a badge, unlicensed ones accept a disclaimer and customers are told), later delivery riders. Plan: [`MARKETPLACE.md`](MARKETPLACE.md) | 📝 Planned |

## Corrections added in engineering review

### 1. Data licensing limits what "our own data" can mean
- **Mapbox** results (search, geocoding, directions) **may not be stored** to build our own places or road database. Cache them only as the Mapbox terms allow.
- **OpenStreetMap** is ODbL. If we publish or share a database derived from OSM, it must be shared under ODbL as well (share-alike). Data products for Phase 5 must account for this.
- Data that is **truly ours**: community reports and votes, shortcuts, community routes, places users recommend, and anonymous probe data. Build the data strategy on these.

### 2. Failure policy: the middle path, not fully fail-closed
If the usage counter or rate-limit store is unavailable:
- **Optional** paid features (along-route search, extra lookups) **fail closed**: they stop.
- **Critical** navigation (directions and reroute) **keeps working**, under a small in-memory emergency cap.

This is deliberate and is what the owner agreed. Do not "fix" it to fail-closed everywhere. A driver mid-journey must not lose rerouting because a counter is down.

### 3. PDPA (Personal Data Protection Act 2010)
- Write down a purpose and a retention period for every personal-data table before shipping it.
- Location data shared with others has to be opted into, must be removable, and must hide trip ends (homes): shortcuts trim 300 m, community routes trim 1 km, probe data drops 300 m around the start and end.
- **Never sell or share individual-level location data.** Data products are aggregates only, with minimum group sizes.
- Update the Privacy Policy (`web/src/pages/legal/PrivacyPage.tsx`) in the same PR as any change to what is collected or shown.

### 4. One handbook for all AI agents
Claude, Codex, Gemini and humans all follow [`AGENTS.md`](../AGENTS.md).
