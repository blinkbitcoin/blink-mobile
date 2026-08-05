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

echo
echo "====================================="
printf '%d suites, %d assertions passed, %d failed\n' "$SUITES" "$TOTAL_PASS" "$TOTAL_FAIL"
if [ "${#UNTESTED[@]}" -gt 0 ]; then
  printf 'untested skills: %s\n' "${UNTESTED[*]}"
fi
[ "$TOTAL_FAIL" -eq 0 ] || exit 1
