#!/bin/bash
# Rank where demo-session time actually goes, from the local span telemetry.
#
# Reads the spans-*.jsonl files the skills emit (see lib/telemetry.sh) and
# prints per-span aggregates - count, p50, p95, max, total - ranked by total
# time, which is the "what should we optimize next" ordering. Groups are
# (span, origin-or-format, ok): reclaim/clone/create claims are different
# distributions, and failure samples (a timed-out capture) sit in their own
# ok=false rows so they can never inflate a latency percentile.
#
# Percentiles are nearest-rank (value at ceil(p*n)) - deterministic, no
# interpolation, exact for the test fixtures.
#
# Usage: spans-report.sh [--since <N>d|<N>h] [--dir <telemetry-dir>]
#                        [--compare <revA> <revB>]
#   --since    default 7d - old, pre-optimization history must not poison the
#              ranking forever
#   --dir      defaults like the lib: $DEMO_TELEMETRY_DIR, else
#              $DEMO_SIM_REGISTRY/telemetry, else ~/.claude/rn-sim-sessions/telemetry
#   --compare  before/after table for two code revisions (the `rev` field
#              every span carries) - the one command that verifies an
#              optimization actually optimized
#
# Torn lines (a writer killed mid-append) are skipped and counted, never fatal.

set -euo pipefail

SINCE="7d"
DIR="${DEMO_TELEMETRY_DIR:-${DEMO_SIM_REGISTRY:-$HOME/.claude/rn-sim-sessions}/telemetry}"
REV_A=""; REV_B=""

while [ $# -gt 0 ]; do
  case "$1" in
    --since)   SINCE="${2:?--since needs e.g. 7d or 24h}"; shift 2 ;;
    --dir)     DIR="${2:?--dir needs a path}"; shift 2 ;;
    --compare) REV_A="${2:?--compare needs two revs}"; REV_B="${3:?--compare needs two revs}"; shift 3 ;;
    *) echo "FATAL: unknown argument '$1' (usage: spans-report.sh [--since Nd|Nh] [--dir D] [--compare revA revB])" >&2; exit 64 ;;
  esac
done

[ -d "$DIR" ] || { echo "no telemetry at $DIR - nothing has emitted spans yet" >&2; exit 1; }

SINCE="$SINCE" REV_A="$REV_A" REV_B="$REV_B" python3 - "$DIR"/spans-*.jsonl <<'PY'
import glob
import json
import math
import os
import re
import sys
import time

def parse_since(text):
    m = re.match(r"^(\d+)([dh])$", text)
    if not m:
        sys.stderr.write("FATAL: --since must look like 7d or 24h, got %r\n" % text)
        sys.exit(64)
    n, unit = int(m.group(1)), m.group(2)
    return time.time() - n * (86400 if unit == "d" else 3600)

cutoff = parse_since(os.environ.get("SINCE") or "7d")
rev_a, rev_b = os.environ.get("REV_A") or "", os.environ.get("REV_B") or ""

records, torn = [], 0
for path in sys.argv[1:]:
    try:
        lines = open(path).read().splitlines()
    except OSError:
        continue
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
            r["dur_ms"]; r["span"]; r["ts"]
        except (ValueError, KeyError, TypeError):
            torn += 1
            continue
        if r["ts"] >= cutoff:
            records.append(r)

def discriminator(r):
    meta = r.get("meta") or {}
    return str(meta.get("origin") or meta.get("fmt") or "")

def pctl(sorted_durs, p):
    return sorted_durs[max(0, math.ceil(p * len(sorted_durs)) - 1)]

def aggregate(rows):
    groups = {}
    for r in rows:
        key = (r["span"], discriminator(r), bool(r.get("ok", True)))
        groups.setdefault(key, []).append(r["dur_ms"])
    out = []
    for (span, disc, ok), durs in groups.items():
        durs.sort()
        out.append({
            "span": span, "disc": disc, "ok": ok, "count": len(durs),
            "p50": pctl(durs, 0.50), "p95": pctl(durs, 0.95),
            "max": durs[-1], "total": sum(durs),
        })
    out.sort(key=lambda g: g["total"], reverse=True)
    return out

def label(g):
    parts = [g["span"]]
    if g["disc"]:
        parts.append(g["disc"])
    if not g["ok"]:
        parts.append("FAILED")
    return " ".join(parts)

def print_table(rows, title):
    print(title)
    print("%-52s %6s %8s %8s %8s %10s" % ("span", "n", "p50ms", "p95ms", "maxms", "totalms"))
    for g in rows:
        print("%-52s %6d %8d %8d %8d %10d" % (label(g), g["count"], g["p50"], g["p95"], g["max"], g["total"]))

if rev_a:
    a = aggregate([r for r in records if r.get("rev") == rev_a])
    b = aggregate([r for r in records if r.get("rev") == rev_b])
    index_a = {(g["span"], g["disc"], g["ok"]): g for g in a}
    index_b = {(g["span"], g["disc"], g["ok"]): g for g in b}
    print("compare %s -> %s" % (rev_a, rev_b))
    print("%-52s %14s %14s %8s" % ("span", rev_a + " p50/n", rev_b + " p50/n", "delta"))
    for key in sorted(set(index_a) | set(index_b), key=lambda k: -(index_a.get(k, index_b.get(k))["total"])):
        ga, gb = index_a.get(key), index_b.get(key)
        fa = "%d/%d" % (ga["p50"], ga["count"]) if ga else "-"
        fb = "%d/%d" % (gb["p50"], gb["count"]) if gb else "-"
        if ga and gb and ga["p50"] > 0:
            delta = "%+d%%" % round(100.0 * (gb["p50"] - ga["p50"]) / ga["p50"])
        else:
            delta = "-"
        name = key[0] + ((" " + key[1]) if key[1] else "") + ("" if key[2] else " FAILED")
        print("%-52s %14s %14s %8s" % (name, fa, fb, delta))
else:
    print_table(aggregate(records), "spans ranked by total time (since cutoff)")

if torn:
    print("(%d unparseable line%s skipped)" % (torn, "s" if torn != 1 else ""))
PY
