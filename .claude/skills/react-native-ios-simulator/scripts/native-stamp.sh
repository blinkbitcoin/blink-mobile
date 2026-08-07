#!/bin/bash
# Instant verdict on whether a native build still matches the app's
# ios/Podfile.lock - replacing git archaeology with a hash comparison.
#
# Why this exists: reusing a DerivedData build (SKILL.md step 3) or a golden
# simulator's app install is safe only while no native module changed since
# that build was made. Deciding that by reading git history is slow and
# error-prone, and a wrong guess costs a ~14 min locked rebuild discovered
# only when the app crashes at launch (a renamed native module - the geetest
# rename - did exactly this). Podfile.lock is the native closure's fingerprint:
# same hash, same native build inputs.
#
# Usage:
#   native-stamp.sh write <stamp-file> [--lockfile <path>]
#   native-stamp.sh check <stamp-file> [--lockfile <path>]
#
#   write   records podfile-lock-hash=<sha256> into the stamp file, replacing
#           any previous hash line and preserving every other key - so it works
#           on the golden stamp (bless-golden.sh calls this) and on a plain
#           build stamp you drop next to a DerivedData .app after building.
#   check   compares the current lockfile against the recorded hash.
#           Exit 0: match. Exit 1: STALE (or no hash recorded - a stamp that
#           cannot vouch for its build must fail, not pass silently).
#
#   --lockfile defaults to ios/Podfile.lock relative to the cwd, which is the
#   app worktree root in every workflow this skill documents.

set -euo pipefail

die() { echo "FATAL: $*" >&2; exit 1; }

MODE="${1:?usage: native-stamp.sh <write|check> <stamp-file> [--lockfile <path>]}"
STAMP="${2:?missing stamp-file (usage: native-stamp.sh <write|check> <stamp-file> [--lockfile <path>])}"
shift 2

LOCKFILE="ios/Podfile.lock"
while [ $# -gt 0 ]; do
  case "$1" in
    --lockfile) LOCKFILE="${2:?--lockfile needs a value}"; shift 2 ;;
    *) die "unknown argument '$1'" ;;
  esac
done

[ -f "$LOCKFILE" ] || die "no lockfile at $LOCKFILE - run from the app worktree root or pass --lockfile"
HASH=$(shasum -a 256 "$LOCKFILE" | cut -d' ' -f1)

case "$MODE" in
  write)
    touch "$STAMP"
    if grep -q '^podfile-lock-hash=' "$STAMP"; then
      sed -i '' "s|^podfile-lock-hash=.*|podfile-lock-hash=$HASH|" "$STAMP"
    else
      echo "podfile-lock-hash=$HASH" >> "$STAMP"
    fi
    echo "stamped $STAMP (podfile-lock-hash=$HASH)"
    ;;
  check)
    [ -f "$STAMP" ] || die "no stamp at $STAMP - nothing vouches for this build; rebuild or write a stamp at build time"
    RECORDED=$(grep '^podfile-lock-hash=' "$STAMP" 2>/dev/null | cut -d= -f2- || true)
    [ -n "$RECORDED" ] || die "stamp $STAMP has no podfile-lock-hash - it predates lockfile stamping and cannot vouch for the build; re-bless (or re-stamp after a fresh build)"
    if [ "$RECORDED" = "$HASH" ]; then
      echo "native build matches $LOCKFILE (podfile-lock-hash $HASH)"
    else
      die "native build is STALE: $LOCKFILE hashes to $HASH but the stamp recorded $RECORDED.
       A native module changed since this build was stamped (a Podfile.lock change,
       like the geetest module rename) - rebuild, or re-bless the golden, before
       trusting this install"
    fi
    ;;
  *) die "mode must be 'write' or 'check', got '$MODE'" ;;
esac
