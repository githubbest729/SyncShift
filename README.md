# SyncShift

**Asynchronous EA Dispatch & Dual-Timezone Command Center** for a UK founder and a Philippines-based EA.

## Architecture
- **Dual timezone:** `Intl.DateTimeFormat` with `Europe/London` (auto BST/GMT) and `Asia/Manila`. Overlap = UK 06:00-11:00, mapped onto a 24h PHT track, so the bar shifts correctly when the UK changes clocks.
- **Nudge engine:** hours since last contact; > 48h and not Closed raises an amber (red > 72h) badge.
- **Dispatch:** Web Speech API (falls back to typing) then a regex parser to category, urgency and PHT due time.
- **Storage:** `localStorage` key `syncshift.v1`, seeded on first load.
- **Offline:** cache-first `sw.js` at root scope.

## Deploy
Push to `main`; enable Pages > Source: GitHub Actions. Replace `YOUR-USER` in `sitemap.xml`/`robots.txt`, and the placeholders in `.well-known/`.

MIT licensed.
