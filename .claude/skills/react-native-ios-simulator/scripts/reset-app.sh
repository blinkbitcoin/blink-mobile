#!/bin/bash
# Reset the app to a true fresh-install state on this session's simulator.
#
# Maestro's `clearState` looks like the tool for this, but it wipes the app's
# data container including the persisted RCT_jsLocation Metro redirect, so the
# next plain launch silently loads the user's 8081 bundler and you record a
# stuck splash. A real uninstall/reinstall is both truer to "the user
# reinstalled the app" and safe here, because this script re-persists the
# redirect afterwards. The bundle is cached in the session dir first, so a
# device that lost the app (or a re-run after uninstall) can always reinstall.
#
# Usage: reset-app.sh [--udid <udid>] [--app-id <bundle-id>]
#   --udid    defaults to $DEMO_UDID (from claim-session.sh)
#   --app-id  defaults to $DEMO_APP_ID_IOS; required either way
#   Re-persists the Metro redirect from $DEMO_PORT when it is set; otherwise
#   warns and skips it (flows passing RCT_jsLocation as a launch arg are fine).

set -euo pipefail

die() { echo "FATAL: $*" >&2; exit 1; }

UDID="${DEMO_UDID:-}"
APP_ID="${DEMO_APP_ID_IOS:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --udid)   UDID="${2:?--udid needs a value}"; shift 2 ;;
    --app-id) APP_ID="${2:?--app-id needs a value}"; shift 2 ;;
    *) die "unknown argument '$1' (usage: reset-app.sh [--udid U] [--app-id ID])" ;;
  esac
done

# A simctl call without an explicit udid targets whichever device is booted,
# which is usually the user's. Refuse rather than guess.
[ -n "$UDID" ] || die "no udid: pass --udid or eval claim-session.sh first (an unscoped reset would hit whichever simulator is booted, usually the user's)"
[ -n "$APP_ID" ] || die "no app id: pass --app-id or set DEMO_APP_ID_IOS (there is no universal default bundle id)"

SESSION_DIR="${DEMO_SESSION_DIR:-}"
[ -n "$SESSION_DIR" ] || die "DEMO_SESSION_DIR unset: eval claim-session.sh first (the bundle cache lives in the session dir so release --delete cleans it up)"

# --- Ownership gate ----------------------------------------------------------
# Same rule as release-session.sh: never touch a device this skill did not name.
PREFIX="${DEMO_SIM_PREFIX:-rn-demo}"
ACTUAL_NAME=$(xcrun simctl list devices -j | python3 -c "
import json,sys
udid=sys.argv[1]
for _, devices in json.load(sys.stdin)['devices'].items():
    for d in devices:
        if d['udid'] == udid:
            print(d['name']); sys.exit(0)
" "$UDID" || true)
case "$ACTUAL_NAME" in
  "$PREFIX"-pr*) : ;;
  *) die "refusing to reset $UDID - named '${ACTUAL_NAME:-<gone>}', not a '${PREFIX}-pr<N>' session device" ;;
esac

# --- Cache the installed bundle, or fall back to a previous cache ------------
CACHE_DIR="$SESSION_DIR/app-cache"
CACHED_APP="$CACHE_DIR/$APP_ID.app"
CONTAINER=$(xcrun simctl get_app_container "$UDID" "$APP_ID" app 2>/dev/null || true)
if [ -n "$CONTAINER" ] && [ -d "$CONTAINER" ]; then
  mkdir -p "$CACHE_DIR"
  rm -rf "$CACHED_APP"
  cp -R "$CONTAINER" "$CACHED_APP"
elif [ ! -d "$CACHED_APP" ]; then
  die "app $APP_ID is not installed on $UDID and no cached bundle exists at $CACHED_APP"
fi

# --- The reset ---------------------------------------------------------------
xcrun simctl terminate "$UDID" "$APP_ID" 2>/dev/null || true
xcrun simctl uninstall "$UDID" "$APP_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$CACHED_APP"

# --- Re-persist the Metro redirect -------------------------------------------
if [ -n "${DEMO_PORT:-}" ]; then
  xcrun simctl spawn "$UDID" defaults write "$APP_ID" RCT_jsLocation "localhost:$DEMO_PORT"
  echo "reset $APP_ID on $UDID (fresh install, Metro redirect -> localhost:$DEMO_PORT)"
else
  echo "WARNING: DEMO_PORT unset - skipped the persisted Metro redirect; a plain launch will use the app's default bundler" >&2
  echo "reset $APP_ID on $UDID (fresh install, no persisted redirect)"
fi
