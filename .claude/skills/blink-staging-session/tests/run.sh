#!/bin/bash
# Integration tests for the Blink staging-login script.
#
# Fake maestro + fake xcrun; no simulator, no network, no real credential -
# a test OTP travels through the same path the real one would.
#
#   ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$TESTS_DIR/../scripts"
FLOWS="$TESTS_DIR/../flows"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/blink-staging-tests.XXXXXX")"

export PATH="$TESTS_DIR/fixtures/bin:$PATH"
export FAKE_ARGS_LOG="$WORK/args.log"
export DEMO_SIM_REGISTRY="$WORK/registry"   # confines telemetry to $WORK
# Trust only what each test sets - a live-session shell exports these.
unset DEMO_UDID DEMO_APP_ID_IOS GALOY_STAGING_GLOBAL_OTP 2>/dev/null || true

PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT

ok()  { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$2', got '$3'"; fi; }
reset(){ : > "$FAKE_ARGS_LOG"; }

echo
echo "credential and session guards"

reset
out=$(DEMO_UDID=SIM-1 DEMO_APP_ID_IOS=io.galoy.bitcoinbeach \
  "$SCRIPTS/staging-login.sh" --out-dir "$WORK" 2>&1); rc=$?
check "refuses without the staging OTP in the environment" "1" "$rc"
check "the refusal teaches .env.local, not just the var name" "yes" \
  "$(echo "$out" | grep -q ".env.local" && echo yes || echo no)"
check "no flow ran without the credential" "0" "$(grep -c "maestro" "$FAKE_ARGS_LOG")"

reset
GALOY_STAGING_GLOBAL_OTP=999111 DEMO_APP_ID_IOS=io.galoy.bitcoinbeach \
  "$SCRIPTS/staging-login.sh" --out-dir "$WORK" >/dev/null 2>&1
check "refuses without a claimed session" "1" "$?"

reset
DEMO_UDID=SIM-1 DEMO_APP_ID_IOS=io.galoy.bitcoinbeach GALOY_STAGING_GLOBAL_OTP=999111 \
  "$SCRIPTS/staging-login.sh" --phone "abc123" --out-dir "$WORK" >/dev/null 2>&1
check "rejects non-numeric phone digits" "1" "$?"

echo
echo "flow orchestration"

reset
DEMO_UDID=SIM-1 DEMO_APP_ID_IOS=io.galoy.bitcoinbeach GALOY_STAGING_GLOBAL_OTP=999111 \
  "$SCRIPTS/staging-login.sh" --out-dir "$WORK" >/dev/null 2>&1
check "happy path exits zero" "0" "$?"
SWITCH_LINE=$(grep -n "switch-to-staging.yaml" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
LOGIN_LINE=$(grep -n "staging-login.yaml" "$FAKE_ARGS_LOG" | head -1 | cut -d: -f1)
check "the instance switch runs before the login (fresh installs point at Main)" "yes" \
  "$([ -n "$SWITCH_LINE" ] && [ -n "$LOGIN_LINE" ] && [ "$SWITCH_LINE" -lt "$LOGIN_LINE" ] && echo yes || echo "no (switch=$SWITCH_LINE login=$LOGIN_LINE)")"
check "every maestro call pins --udid" "0" \
  "$(grep "^maestro" "$FAKE_ARGS_LOG" | grep -cv -- "--udid SIM-1")"
check "the OTP travels as a maestro env var" "yes" \
  "$(grep "staging-login.yaml" "$FAKE_ARGS_LOG" | grep -q -- "-e OTP=999111" && echo yes || echo no)"
check "the default phone digits travel the same way" "yes" \
  "$(grep "staging-login.yaml" "$FAKE_ARGS_LOG" | grep -q -- "-e PHONE=732459186" && echo yes || echo no)"
check "the verification screenshot is written" "yes" \
  "$([ -s "$WORK/staging-login-verify.png" ] && echo yes || echo no)"

reset
DEMO_UDID=SIM-1 DEMO_APP_ID_IOS=io.galoy.bitcoinbeach GALOY_STAGING_GLOBAL_OTP=999111 \
  "$SCRIPTS/staging-login.sh" --skip-instance-switch --phone 655012345 --out-dir "$WORK" >/dev/null 2>&1
check "--skip-instance-switch skips exactly the switch flow" "0" \
  "$(grep -c "switch-to-staging.yaml" "$FAKE_ARGS_LOG")"
check "and the login still runs" "1" "$(grep -c "staging-login.yaml" "$FAKE_ARGS_LOG")"
check "--phone overrides the default" "yes" \
  "$(grep "staging-login.yaml" "$FAKE_ARGS_LOG" | grep -q -- "-e PHONE=655012345" && echo yes || echo no)"

reset
FAKE_MAESTRO_RC=1 DEMO_UDID=SIM-1 DEMO_APP_ID_IOS=io.galoy.bitcoinbeach GALOY_STAGING_GLOBAL_OTP=999111 \
  "$SCRIPTS/staging-login.sh" --out-dir "$WORK" >/dev/null 2>&1
check "a failing flow fails the script" "1" "$?"

echo
echo "the credential can never leak into the repo"

# The repo is public: the OTP may only ever travel as an env injection.
check "no flow file hardcodes an inputText value" "0" \
  "$(grep "inputText" "$FLOWS"/*.yaml | grep -cv '\${')"
check "flow headers are YAML, not prose (maestro parse-fails on >)" "yes" \
  "$(head -1 "$FLOWS/switch-to-staging.yaml" | grep -qE '^(#|appId:)' && head -1 "$FLOWS/staging-login.yaml" | grep -qE '^(#|appId:)' && echo yes || echo no)"

echo
echo "documented behavior matches the scripts"

SKILL_MD="$TESTS_DIR/../SKILL.md"
check "SKILL.md pre-approves this skill's commands (allowed-tools)" "yes" \
  "$(head -5 "$SKILL_MD" | grep "allowed-tools:" | grep -q -- "Bash(maestro \*)" && echo yes || echo no)"
check "SKILL.md sources the OTP from .env.local via the env var" "yes" \
  "$(grep -q "GALOY_STAGING_GLOBAL_OTP" "$SKILL_MD" && grep -q ".env.local" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md warns fresh installs point at Main (production)" "yes" \
  "$(grep -qi "Main" "$SKILL_MD" && grep -qi "production" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md carries the golden provisioning recipe" "yes" \
  "$(grep -q "bless-golden.sh" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md carries the demo-worktree native build prerequisites" "yes" \
  "$(grep -q "install-skia" "$SKILL_MD" && grep -qi "breez" "$SKILL_MD" && echo yes || echo no)"
check "SKILL.md never contains a 6-digit literal that could be the PIN" "0" \
  "$(grep -cE '(^|[^0-9.])[0-9]{6}([^0-9.]|$)' "$SKILL_MD")"

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
