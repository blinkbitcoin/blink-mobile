#!/bin/bash
# Log the running Blink app in against Staging, on this session's simulator.
#
# Two Blink facts drive the shape of this script:
# - a fresh install points at the Main (production) instance, so the default
#   run switches to Staging first (triple-tap logo -> developerScreen);
# - staging accepts a shared global OTP for any valid-format phone number.
#   The value is machine state (GALOY_STAGING_GLOBAL_OTP via .env.local,
#   direnv-loaded), NEVER repo state - this script injects it as a Maestro
#   env var so no flow file ever carries it. The repo is public.
#
# Requires a claimed session (react-native-ios-simulator) with the app
# installed and running against your session's Metro.
#
# Usage: staging-login.sh [--phone <digits>] [--skip-instance-switch] [--out-dir D]
#   --phone                national digits for whatever country the picker
#                          shows (device-locale default). Same digits = same
#                          shared staging account - fine for a golden bless,
#                          pick your own for pristine state.
#   --skip-instance-switch the app is already on Staging
#   --out-dir              where the verification screenshot lands (default .)
#
# The script cannot read pixels: it ends with a screenshot, and YOU verify
# the home screen shows the phone number before trusting the login.

set -euo pipefail

# Telemetry is best-effort and optional (same contract as every skill).
TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }

die() { echo "FATAL: $*" >&2; exit 1; }

PHONE="732459186"
SKIP_SWITCH=""
OUTDIR="."

while [ $# -gt 0 ]; do
  case "$1" in
    --phone) PHONE="${2:?--phone needs digits}"; shift 2 ;;
    --skip-instance-switch) SKIP_SWITCH=1; shift ;;
    --out-dir) OUTDIR="${2:?--out-dir needs a path}"; shift 2 ;;
    *) die "unknown argument '$1' (usage: staging-login.sh [--phone <digits>] [--skip-instance-switch] [--out-dir D])" ;;
  esac
done

[ -n "${DEMO_UDID:-}" ] || die "no claimed session: eval claim-session.sh first (this script only ever drives your own simulator)"
[ -n "${DEMO_APP_ID_IOS:-}" ] || die "DEMO_APP_ID_IOS is unset - see AGENTS.md for this repo's bundle id"
[ -n "${GALOY_STAGING_GLOBAL_OTP:-}" ] || die "GALOY_STAGING_GLOBAL_OTP is unset - the staging global OTP is machine state:
       put 'export GALOY_STAGING_GLOBAL_OTP=<the standard PIN>' in .env.local
       (gitignored, direnv-loaded). Every developer has the PIN; ask if you don't."
command -v maestro >/dev/null 2>&1 || die "maestro is not installed"

case "$PHONE" in
  ''|*[!0-9]*) die "--phone must be national digits only, got '$PHONE'" ;;
esac

FLOWS="$(dirname "${BASH_SOURCE[0]}")/../flows"
T_LOGIN=$(tel_now)

if [ -z "$SKIP_SWITCH" ]; then
  echo "switching the app instance to Staging (fresh installs point at Main - production)..."
  maestro --udid "$DEMO_UDID" test -e APP_ID="$DEMO_APP_ID_IOS" \
    "$FLOWS/switch-to-staging.yaml" \
    || die "instance switch flow failed - screenshot the simulator to see where it stopped"
fi

echo "logging in as +<device-locale country> $PHONE with the staging global OTP..."
maestro --udid "$DEMO_UDID" test -e APP_ID="$DEMO_APP_ID_IOS" \
  -e PHONE="$PHONE" -e OTP="$GALOY_STAGING_GLOBAL_OTP" \
  "$FLOWS/staging-login.yaml" \
  || die "login flow failed - screenshot the simulator to see where it stopped"

mkdir -p "$OUTDIR"
SHOT="$OUTDIR/staging-login-verify.png"
xcrun simctl io "$DEMO_UDID" screenshot "$SHOT" >/dev/null 2>&1 || die "verification screenshot failed"

tel_emit blink.staging_login.total "$T_LOGIN" \
  skipped_switch="$([ -n "$SKIP_SWITCH" ] && echo 1 || echo 0)"

echo "flows completed -> $SHOT"
echo "VERIFY IT: a successful login shows the phone number and balances on the"
echo "home screen. A GetStarted or OTP screen in that shot means it failed."
