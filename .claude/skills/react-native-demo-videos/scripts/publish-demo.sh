#!/bin/bash
# Publish demo GIFs to a PR, with a demo-specific caption.
#
# The orphan-branch plumbing is NOT reimplemented here: it lives in the
# github-pr-image-attachments skill, and this decorates it with the demo
# purpose and framing. One implementation of the tricky part, one place to fix
# it.
#
# GIF only, by design. An MP4 served from raw.githubusercontent.com comes back
# as application/octet-stream with x-content-type-options: nosniff, so no
# browser will play it in a <video>. MP4 goes through GitHub's upload endpoint
# via Chrome — see the skill body.
#
# Usage: publish-demo.sh <pr> <file.gif> [more.gif...] [--dry-run] [--repo owner/name]

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUSH="$HERE/../../github-pr-image-attachments/scripts/push-assets-branch.sh"

PR=""; FILES=(); PASSTHROUGH=()

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) PASSTHROUGH+=("$1"); shift ;;
    --repo|--remote) PASSTHROUGH+=("$1" "${2:?}"); shift 2 ;;
    --format)
      [ "${2:-}" = "gif" ] || { echo "FATAL: publish-demo.sh handles gif only; '${2:-}' must go through the Chrome upload route" >&2; exit 64; }
      shift 2 ;;
    -*) echo "FATAL: unknown option '$1'" >&2; exit 64 ;;
    *) if [ -z "$PR" ]; then PR="$1"; else FILES+=("$1"); fi; shift ;;
  esac
done

die() { echo "FATAL: $*" >&2; exit 1; }

[ -x "$PUSH" ] || die "the github-pr-image-attachments skill is missing at $PUSH.
       This skill decorates it rather than duplicating its plumbing."

case "$PR" in
  ''|*[!0-9]*) die "usage: publish-demo.sh <pr-number> <file.gif> [...] [--dry-run]" ;;
esac
[ "${#FILES[@]}" -gt 0 ] || die "no files given"

for f in "${FILES[@]}"; do
  case "$f" in
    *.gif) : ;;
    *.mp4|*.mov|*.webm) die "$f is video: raw-hosted video will not play on GitHub (octet-stream + nosniff). Convert to gif, or use the Chrome upload route." ;;
    *) die "$f is not a .gif" ;;
  esac
done

OUT=$("$PUSH" "$PR" demo "${FILES[@]}" "${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}" 2>&1) || {
  echo "$OUT" >&2
  die "push-assets-branch.sh failed"
}
echo "$OUT" | grep -v '^RAW_'

RAW=$(echo "$OUT" | grep '^RAW_BASE=' | head -1 | cut -d= -f2-)
[ -n "$RAW" ] || die "push-assets-branch.sh did not report a RAW_BASE"
BRANCH="assets/pr-${PR}-demo"

echo
echo "--- embed markdown ---"
if [ "${#FILES[@]}" -eq 2 ]; then
  a=$(basename "${FILES[0]}"); b=$(basename "${FILES[1]}")
  printf '| %s | %s |\n|---|---|\n| <img src="%s/%s" width="280"> | <img src="%s/%s" width="280"> |\n' \
    "${a%.gif}" "${b%.gif}" "$RAW" "$a" "$RAW" "$b"
else
  for f in "${FILES[@]}"; do
    base=$(basename "$f")
    printf '<img src="%s/%s" width="280" alt="%s">\n' "$RAW" "$base" "${base%.gif}"
  done
fi
printf '\n<sub>Demos live on branch `%s` — deleting it breaks them.</sub>\n' "$BRANCH"
