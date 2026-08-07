# Local span telemetry for the demo skills. Source this; never execute it.
#
# Purpose: every skill script emits one JSON line per meaningful phase so
# `spans-report.sh` can rank where capture time actually goes. Local files
# only - no network, no export, nothing leaves the machine.
#
# The API has no start/end pairing on purpose: macOS bash 3.2 has no
# associative arrays, so paired state either breaks nesting or forces a
# hand-rolled stack. The start time lives in a variable the caller owns:
#
#   t0=$(tel_now)
#   xcrun simctl boot "$UDID"
#   tel_emit sim.claim.boot "$t0"
#
#   tel_span sim.bless.total udid="$UDID" -- some-command args...
#
# Ground rules, enforced by the test suite:
# - Emitting can NEVER fail the caller. Every instrumented script runs
#   `set -euo pipefail`; telemetry that can abort a claim is worse than no
#   telemetry. All failure paths end in `|| true` / `return 0`.
# - No spans inside hot loops (settle loops, poll loops). A python3 spawn is
#   ~20-50ms; per-frame spans would distort the very numbers they measure.
#   Time the loop once and record counts in meta instead.
# - One record = one line = one O_APPEND write; appends of this size do not
#   interleave on APFS, so concurrent agents share one file safely.
# - Wall clock only (two separate spawns cannot share a monotonic clock);
#   negative durations are clamped to 0 and flagged meta.clock_skew=1.
#
# Record schema (v1):
#   {"v":1,"ts":<epoch>,"dur_ms":<int>,"span":"sim.claim.total",
#    "skill":"sim","session":"blink-demo-pr4092","run_id":"<pid.ts>",
#    "rev":"<git short sha>","ok":true,"meta":{...}}
# `skill` is the span's first dot-segment. `rev` is the skills checkout's
# HEAD, cached once per process - it is what makes before/after comparison
# (`spans-report.sh --compare`) possible.
#
# Config:
#   DEMO_TELEMETRY=0        kill switch - no files, no spawns
#   DEMO_TELEMETRY_DIR      span dir; defaults inside the session registry so
#                           the test suites' DEMO_SIM_REGISTRY redirect
#                           isolates test telemetry automatically
#
# Explicit non-goal: Metro start -> first bundle. Metro is started by the
# agent from SKILL.md prose, not by any script, so there is no script-owned
# instrumentation point; only bench/live.sh measures it.

TEL_ENABLED=1
[ "${DEMO_TELEMETRY:-1}" = "0" ] && TEL_ENABLED=0

# One run_id per process tree: reconstructing "this capture's spans" from a
# shared machine-wide file needs more than the session name, which conflates
# re-runs.
if [ -z "${TEL_RUN_ID:-}" ]; then
  TEL_RUN_ID="$$.$(date +%s)"
  export TEL_RUN_ID
fi

# Which code produced the span - cached once, exported so child scripts
# (claim calls reap, record calls maestro wrappers) reuse it for free.
if [ -z "${TEL_REV:-}" ]; then
  TEL_REV=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --short HEAD 2>/dev/null || echo "")
  export TEL_REV
fi

tel_dir() {
  echo "${DEMO_TELEMETRY_DIR:-${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}/telemetry}"
}

# tel_now -> epoch seconds as a float. Exactly one python3 spawn.
tel_now() {
  [ "$TEL_ENABLED" = "1" ] || { echo 0; return 0; }
  python3 -c 'import time; print("%.6f" % time.time())' 2>/dev/null || echo 0
}

# tel_emit <span> <t0> [k=v ...]
# Builds the record and takes the end timestamp in ONE python3 spawn, then
# appends it in one write. Never fails the caller.
tel_emit() {
  [ "$TEL_ENABLED" = "1" ] || return 0
  local span="${1:-}" t0="${2:-0}"
  [ -n "$span" ] || return 0
  shift 2 2>/dev/null || return 0
  local dir line
  dir=$(tel_dir)
  mkdir -p "$dir" 2>/dev/null || return 0
  line=$(TEL_SPAN="$span" TEL_T0="$t0" TEL_SESSION="${DEMO_SIM_NAME:-}" \
    python3 - "$@" <<'PY' 2>/dev/null
import json, os, sys, time
t1 = time.time()
try:
    t0 = float(os.environ.get("TEL_T0") or 0)
except ValueError:
    t0 = 0.0
raw_ms = int(round((t1 - t0) * 1000)) if t0 > 0 else 0
span = os.environ.get("TEL_SPAN", "")
rec = {
    "v": 1,
    "ts": round(t1, 3),
    "dur_ms": max(raw_ms, 0),
    "span": span,
    "skill": span.split(".", 1)[0],
    "session": os.environ.get("TEL_SESSION", ""),
    "run_id": os.environ.get("TEL_RUN_ID", ""),
    "rev": os.environ.get("TEL_REV", ""),
    "ok": True,
    "meta": {},
}
if t0 > 0 and raw_ms < 0:
    rec["meta"]["clock_skew"] = 1
for kv in sys.argv[1:]:
    if "=" not in kv:
        continue
    k, v = kv.split("=", 1)
    if k == "ok":
        rec["ok"] = v not in ("0", "false", "")
    else:
        try:
            rec["meta"][k] = int(v)
        except ValueError:
            try:
                rec["meta"][k] = float(v)
            except ValueError:
                rec["meta"][k] = v
print(json.dumps(rec, separators=(",", ":")))
PY
  ) || return 0
  [ -n "$line" ] || return 0
  # stderr silenced FIRST: if the append-open itself fails (unwritable dir),
  # the shell reports that failure before later redirects would apply.
  printf '%s\n' "$line" 2>/dev/null >> "$dir/spans-$(date +%Y%m).jsonl" || true
  return 0
}

# tel_span <span> [k=v ...] -- cmd args...
# Times one command. Transparent: preserves exit code, stdout and stderr, so
# a caller under `set -e` still fails when the command fails - only the
# telemetry itself is swallowed.
tel_span() {
  local span="${1:-}"
  [ -n "$span" ] || return 0
  shift
  local metas=() rc=0 t0
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do
    metas[${#metas[@]}]="$1"
    shift
  done
  [ $# -gt 0 ] && shift   # the --
  t0=$(tel_now)
  "$@" || rc=$?
  if [ "$rc" -eq 0 ]; then
    tel_emit "$span" "$t0" ${metas[@]+"${metas[@]}"} ok=1 || true
  else
    tel_emit "$span" "$t0" ${metas[@]+"${metas[@]}"} ok=0 rc="$rc" || true
  fi
  return $rc
}
