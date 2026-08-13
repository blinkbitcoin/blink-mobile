#!/bin/bash
# Push image assets to an orphan branch and print their raw URLs.
#
# This is the canonical implementation of the orphan-branch route. Other skills
# call it rather than re-implementing the plumbing — the failure mode of a
# hand-rolled copy (a malformed tree, a mangled refspec) is a branch that looks
# fine and serves 404s to every image on the PR.
#
# Builds the commit with plumbing only: no checkout, no branch switch, nothing
# that touches the working tree of whatever worktree you are standing in.
#
# Usage: push-assets-branch.sh <pr> <purpose> <file...> [--dry-run] [--repo owner/name] [--remote R]
#   The target repo defaults to the origin remote's owner/name (ssh or https
#   GitHub URL); pass --repo for anything the remote URL cannot express.
#
#   push-assets-branch.sh 3712 screenshots before.png after.png
#     -> pushes assets/pr-3712-screenshots
#     -> prints RAW_BASE=https://raw.githubusercontent.com/<repo>/assets/pr-3712-screenshots

set -uo pipefail

# Telemetry is best-effort and optional: this skill still works when the
# simulator skill's lib is absent (skills get copied around individually).
TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../../react-native-ios-simulator/lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }
T_PUSH=$(tel_now)

PR=""; PURPOSE=""; FILES=(); DRY=""; REPO=""; REMOTE="origin"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --repo)    REPO="${2:?--repo needs owner/name}"; shift 2 ;;
    --remote)  REMOTE="${2:?}"; shift 2 ;;
    -*) echo "FATAL: unknown option '$1'" >&2; exit 64 ;;
    *)
      if   [ -z "$PR" ];      then PR="$1"
      elif [ -z "$PURPOSE" ]; then PURPOSE="$1"
      else FILES+=("$1"); fi
      shift ;;
  esac
done

die() { echo "FATAL: $*" >&2; exit 1; }

case "$PR" in
  ''|*[!0-9]*) die "usage: push-assets-branch.sh <pr-number> <purpose> <file...>" ;;
esac
case "$PURPOSE" in
  '') die "no purpose given (e.g. screenshots, demo)" ;;
  *[!a-z0-9-]*) die "purpose '$PURPOSE' must be lowercase letters, digits and dashes" ;;
esac
[ "${#FILES[@]}" -gt 0 ] || die "no files given"

# Only images travel this route. An MP4 served from raw.githubusercontent.com
# comes back as application/octet-stream with nosniff, so no browser will play
# it — it has to go through GitHub's upload endpoint instead.
for f in "${FILES[@]}"; do
  [ -f "$f" ] || die "not found: $f"
  case "$f" in
    *.png|*.gif|*.jpg|*.jpeg|*.webp) : ;;
    *.mp4|*.mov|*.webm) die "$f is video: raw-hosted video will not play on GitHub. Use the Chrome upload route." ;;
    *) die "$f is not an image" ;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a git repository"

BRANCH="assets/pr-${PR}-${PURPOSE}"

if [ -z "$REPO" ]; then
  URL=$(git remote get-url "$REMOTE" 2>/dev/null) || die "no remote '$REMOTE'"
  REPO=$(printf '%s' "$URL" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
fi

# --- Build the tree ---------------------------------------------------------
TREE_INPUT=""
SEEN=""
for f in "${FILES[@]}"; do
  base=$(basename "$f")
  case " $SEEN " in
    *" $base "*) die "two inputs share the basename '$base'; one would overwrite the other" ;;
  esac
  SEEN="$SEEN $base"
  if [ -n "$DRY" ]; then
    blob="0000000000000000000000000000000000000000"
  else
    blob=$(git hash-object -w "$f") || die "could not hash $f"
  fi
  TREE_INPUT="${TREE_INPUT}100644 blob ${blob}	${base}
"
done

RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

if [ -n "$DRY" ]; then
  echo "DRY RUN - nothing pushed"
  echo "branch:  $BRANCH"
  echo "repo:    $REPO"
  echo "refspec: <commit>:refs/heads/$BRANCH"
else
  TREE=$(printf '%s' "$TREE_INPUT" | git mktree) || die "git mktree failed"
  COMMIT=$(git commit-tree "$TREE" -m "$PURPOSE for #$PR") || die "git commit-tree failed"
  # The refspec is written literally. Assembling it in a shell variable has
  # been mangled before.
  git push "$REMOTE" "$COMMIT:refs/heads/$BRANCH" >/dev/null 2>&1 || die "push failed"
  echo "pushed $BRANCH"
fi

# Machine-readable first, so callers can build their own markdown.
tel_emit pub.push.total "$T_PUSH" pr="$PR" purpose="$PURPOSE" \
  files="${#FILES[@]}" dry_run="$([ -n "$DRY" ] && echo 1 || echo 0)"
echo "RAW_BASE=$RAW"
for f in "${FILES[@]}"; do
  echo "RAW_FILE=$RAW/$(basename "$f")"
done
