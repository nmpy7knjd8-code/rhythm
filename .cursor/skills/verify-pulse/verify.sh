#!/usr/bin/env bash
# Pulse verification helper. Run from anywhere; it works in the repo root.
#   verify.sh launch            build, then serve dist on :4173 (pid in .verify/preview.pid)
#   verify.sh doctor            is the instance on :4173 ours, healthy, and serving the current build?
#   verify.sh unit              eslint, then lesson tests over every section of every song (no browser)
#   verify.sh e2e               Playwright: Learn it / Now playing journeys + axe scan (fails on serious/critical)
#   verify.sh learn-sync        Learn it amber highlight vs heard audio (median within 15 ms, no drift)
#   verify.sh nowplaying-sync   Now playing step grid + bar ring vs heard audio (median within 10 ms, no drift)
#   verify.sh playthrough [ids] every song (or a comma list) plays end to end at 8x: all bars, all hits, no duplicates
#   verify.sh all               launch, doctor, unit, e2e, both syncs, playthrough, stop
#   verify.sh stop              stop the preview this script started (never anything else)
# Evidence: .verify/<run>/ (logs per check; Playwright report in playwright-report/). Cleanup keeps it.
set -uo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
PORT=4173 URL="http://localhost:4173/rhythm/" STATE=.verify
export RUN=${RUN:-$(date +%Y%m%d-%H%M%S)}; OUT=$STATE/$RUN
mkdir -p "$OUT"
log() { echo "[verify] $*"; }
step() { local name=$1; shift; log "$name: $*"; "$@" 2>&1 | tee "$OUT/$name.log"; local rc=${PIPESTATUS[0]}; log "$name exit $rc (log $OUT/$name.log)"; return "$rc"; }
ours() { [[ -f $STATE/preview.pid ]] && kill -0 "$(cat $STATE/preview.pid)" 2>/dev/null; }

deps() { [[ -d node_modules/@playwright/test ]] || npm ci; npx playwright install chromium >/dev/null; }

launch() {
  deps
  if ours; then log "preview already running (pid $(cat $STATE/preview.pid))"; else
    if curl -sf -o /dev/null "$URL"; then log "port $PORT is busy with a server this script did not start; stop it or free the port"; return 1; fi
  fi
  step build npm run build || return 1
  if ! ours; then
    nohup node node_modules/vite/bin/vite.js preview --port $PORT --strictPort > "$STATE/preview.log" 2>&1 &  # node itself, so the pid is the server
    echo $! > $STATE/preview.pid
  fi
  for _ in $(seq 50); do curl -sf -o /dev/null "$URL" && break; sleep 0.2; done
  doctor
}

doctor() {
  local bad=0
  ours && log "ok   preview pid $(cat $STATE/preview.pid) is ours" || { log "FAIL no preview started by verify.sh (run: verify.sh launch)"; bad=1; }
  local html; html=$(curl -sf "$URL") && log "ok   $URL answers" || { log "FAIL $URL does not answer"; return 1; }
  [[ "$html" == "$(cat dist/index.html)" ]] && log "ok   serving the current dist/ build" || { log "FAIL served page differs from dist/index.html"; bad=1; }
  local js; js=$(grep -o 'assets/index-[^"]*\.js' <<<"$html" | head -1)
  curl -sf -o /dev/null "${URL}$js" && log "ok   bundle $js loads" || { log "FAIL bundle $js missing"; bad=1; }
  curl -sf "${URL}songs/killing.json" -o "$STATE/doctor-song.json" && grep -q '"sections"' "$STATE/doctor-song.json" && log "ok   song data loads" || { log "FAIL song data missing"; bad=1; }
  local newest; newest=$(find src public index.html -newer dist/index.html -type f | head -3)
  [[ -z $newest ]] && log "ok   build is newer than every source file" || { log "FAIL stale build, changed since: $newest (run: verify.sh launch)"; bad=1; }
  return $bad
}

stop() {
  if ours; then kill "$(cat $STATE/preview.pid)" && log "stopped preview pid $(cat $STATE/preview.pid)"; else log "no preview of ours running"; fi
  rm -f $STATE/preview.pid
  log "evidence kept in $STATE/"
}

case "${1:-}" in
  launch) launch ;;
  doctor) doctor ;;
  stop) stop ;;
  unit) step lint npm run -s lint && step unit npm run -s test:learn ;;
  e2e) deps; step e2e npx playwright test ;;
  learn-sync) step learn-sync node tests/learn-sync.mjs "$URL" ;;
  nowplaying-sync) step nowplaying-sync node tests/nowplaying-sync.mjs "$URL" ;;
  playthrough) step playthrough node tests/playthrough.mjs "$URL" 8 6 ${2:-} ;;
  all)
    fail=()
    launch || { stop; exit 1; }
    for c in unit e2e learn-sync nowplaying-sync playthrough; do "$0" "$c" || fail+=("$c"); done
    stop
    [[ ${#fail[@]} -eq 0 ]] && log "ALL CHECKS PASSED ($OUT)" || { log "FAILED: ${fail[*]} ($OUT)"; exit 1; } ;;
  *) sed -n 2,13p "$0"; exit 2 ;;
esac
