#!/usr/bin/env bash
# POI import: download the Geofabrik Malaysia extract with bounded retries and
# record where it came from. Writes region.osm.pbf and out/source.json.
set -uo pipefail
mkdir -p out
BASE=https://download.geofabrik.de
DEFAULT="$BASE/asia/malaysia-singapore-brunei-latest.osm.pbf"

# 1. Find the current Malaysia file: the official JSON index first, then the Asia page.
URL=""
if curl -sSfL --connect-timeout 30 --max-time 120 "$BASE/index-v1-nogeom.json" -o index.json; then
  URL=$(node -e '
    const j = JSON.parse(require("fs").readFileSync("index.json", "utf8"));
    const f = j.features.map((x) => x.properties).filter((p) => /malaysia/.test(p.id) && p.urls?.pbf);
    console.error("Geofabrik index entries with malaysia:", f.map((p) => p.id + " -> " + p.urls.pbf).join(" | ") || "none");
    const pick = f.find((p) => p.id === "malaysia-singapore-brunei") ?? f[0];
    if (pick) console.log(pick.urls.pbf);
  ') || true
else
  echo "Geofabrik JSON index not reachable"
fi
if [ -z "$URL" ] && curl -sSfL --connect-timeout 30 --max-time 120 "$BASE/asia.html" -o asia.html; then
  REL=$(grep -oE '(asia/)?malaysia[a-z-]*-latest\.osm\.pbf' asia.html | sort -u | head -1)
  echo "Asia page link: ${REL:-none}"
  case "$REL" in "") ;; asia/*) URL="$BASE/$REL" ;; *) URL="$BASE/asia/$REL" ;; esac
fi
URL=${URL:-$DEFAULT}
echo "Using: $URL"

# 2. Headers (size and last modified) before downloading
curl -sSIL --connect-timeout 30 --max-time 60 "$URL" | tr -d '\r' | tee headers.txt | grep -iE '^(HTTP|content-length|last-modified)' || true

# 3. Download: at most 4 attempts, each capped at 20 minutes, 90 s apart
ok=0
for i in 1 2 3 4; do
  code=$(curl -sSL --connect-timeout 30 --max-time 1200 -w '%{http_code}' -o region.osm.pbf "$URL" || true)
  echo "attempt $i: HTTP $code, $(stat -c %s region.osm.pbf 2>/dev/null || echo 0) bytes"
  if [ "$code" = "200" ] && [ -s region.osm.pbf ]; then ok=1; break; fi
  [ "$i" -lt 4 ] && sleep 90
done
if [ "$ok" != 1 ]; then echo "Download failed after 4 bounded attempts"; exit 1; fi

# 4. Verify against Geofabrik's MD5 file when it is published
MD5_OK=null
if curl -sSfL --connect-timeout 30 --max-time 60 "$URL.md5" -o region.md5; then
  want=$(cut -d' ' -f1 region.md5); have=$(md5sum region.osm.pbf | cut -d' ' -f1)
  echo "md5 expected $want, got $have"
  [ "$want" = "$have" ] && MD5_OK=true || { echo "MD5 mismatch"; exit 1; }
fi

BYTES=$(stat -c %s region.osm.pbf)
LASTMOD=$(grep -i '^last-modified:' headers.txt | tail -1 | cut -d' ' -f2- || true)
node -e '
  const [url, bytes, lastmod, md5] = process.argv.slice(1);
  require("fs").writeFileSync("out/source.json", JSON.stringify({ url, bytes: Number(bytes), megabytes: Math.round(Number(bytes) / 1048576 * 10) / 10, last_modified: lastmod || null, md5_verified: md5 === "true" ? true : null, downloaded_at: new Date().toISOString(), licence: "ODbL 1.0, © OpenStreetMap contributors" }, null, 2));
' "$URL" "$BYTES" "$LASTMOD" "$MD5_OK"
cat out/source.json
