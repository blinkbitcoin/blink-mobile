#!/bin/bash
# Run every skill's test suite.
#
# Each skill owns its own suite under <skill>/tests/run.sh; this only collects
# them. A skill with no suite is reported, not silently passed over — an
# untested skill should be visible, not invisible.
#
#   ./run-all-tests.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASS=0; TOTAL_FAIL=0; SUITES=0; UNTESTED=()

for dir in "$HERE"/*/; do
  name=$(basename "$dir")
  suite="$dir/tests/run.sh"

  if [ ! -x "$suite" ]; then
    UNTESTED+=("$name")
    continue
  fi

  SUITES=$((SUITES + 1))
  printf '\n\033[1m=== %s ===\033[0m\n' "$name"
  out=$("$suite" 2>&1); rc=$?
  echo "$out" | grep -E '^\s+(PASS|FAIL|SKIP)|^\s*[0-9]+ passed' >/dev/null 2>&1

  # Show failures in full; collapse a green suite to its summary line.
  if [ "$rc" -eq 0 ]; then
    echo "$out" | tail -2 | head -1
    echo "$out" | tail -1
  else
    echo "$out"
  fi

  line=$(echo "$out" | grep -oE '[0-9]+ passed, [0-9]+ failed' | tail -1)
  p=$(echo "$line" | grep -oE '^[0-9]+'); f=$(echo "$line" | grep -oE '[0-9]+ failed' | grep -oE '^[0-9]+')
  TOTAL_PASS=$((TOTAL_PASS + ${p:-0}))
  TOTAL_FAIL=$((TOTAL_FAIL + ${f:-0}))
done

# --- README freshness -------------------------------------------------------
# The README is the human landing page; a skill it does not mention is a skill
# nobody onboards into. Counted as one assertion per skill dir.
printf '\n\033[1m=== README ===\033[0m\n'
for dir in "$HERE"/*/; do
  name=$(basename "$dir")
  if [ -f "$HERE/README.md" ] && grep -q "$name" "$HERE/README.md"; then
    TOTAL_PASS=$((TOTAL_PASS + 1))
    printf '  \033[32mPASS\033[0m README mentions %s\n' "$name"
  else
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    printf '  \033[31mFAIL\033[0m README.md is missing or does not mention %s\n' "$name"
  fi
done

# --- Makefile (discovery and trust only) --------------------------------------
# Doing lives in the SKILL.mds; the Makefile exists so `make help` orients a
# human and `make test` is the one-keystroke trust command (also what CI would
# call). Checked with `make -n`/output greps.
printf '\n\033[1m=== Makefile ===\033[0m\n'
MK_TEST=$(make -s -n -C "$HERE" test 2>/dev/null)
if echo "$MK_TEST" | grep -q "run-all-tests.sh"; then
  TOTAL_PASS=$((TOTAL_PASS + 1)); printf '  \033[32mPASS\033[0m make test delegates to run-all-tests\n'
else
  TOTAL_FAIL=$((TOTAL_FAIL + 1)); printf '  \033[31mFAIL\033[0m make test delegates to run-all-tests\n'
fi
MK_HELP=$(make -s -C "$HERE" help 2>/dev/null)
if echo "$MK_HELP" | grep -q "SKILL.md"; then
  TOTAL_PASS=$((TOTAL_PASS + 1)); printf '  \033[32mPASS\033[0m make help points at the SKILL.md doing-interface\n'
else
  TOTAL_FAIL=$((TOTAL_FAIL + 1)); printf '  \033[31mFAIL\033[0m make help points at the SKILL.md doing-interface\n'
fi
if make -s -n -C "$HERE" claim PR=12 >/dev/null 2>&1; then
  TOTAL_FAIL=$((TOTAL_FAIL + 1)); printf '  \033[31mFAIL\033[0m pipeline targets must not exist (SKILL.md is the one doing-interface)\n'
else
  TOTAL_PASS=$((TOTAL_PASS + 1)); printf '  \033[32mPASS\033[0m no pipeline targets: SKILL.md is the one doing-interface\n'
fi

echo
echo "====================================="
printf '%d suites, %d assertions passed, %d failed\n' "$SUITES" "$TOTAL_PASS" "$TOTAL_FAIL"
if [ "${#UNTESTED[@]}" -gt 0 ]; then
  printf 'untested skills: %s\n' "${UNTESTED[*]}"
fi
[ "$TOTAL_FAIL" -eq 0 ] || exit 1
