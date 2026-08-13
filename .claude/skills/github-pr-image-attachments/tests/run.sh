#!/bin/bash
# Integration tests for the orphan-branch publishing route.
#
# Pushes for real — to a local bare repository standing in for origin. No
# network, no GitHub, but the git plumbing (hash-object, mktree, commit-tree,
# refspec) is exercised end to end, which is the part that fails silently: a
# malformed tree or a mangled refspec produces a branch that looks fine and
# serves 404s to every image on the PR.
#
#   ./tests/run.sh

set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUSH="$TESTS_DIR/../scripts/push-assets-branch.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/pr-assets-tests.XXXXXX")"

PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT

# Redirecting the registry keeps every test span inside $WORK (telemetry
# derives its store from it).
export DEMO_SIM_REGISTRY="$WORK/registry"

ok()  { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s\n       %s\n' "$1" "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected '$2', got '$3'"; fi; }

# A bare repo playing the part of origin, and a working repo pointed at it.
git init -q --bare "$WORK/origin.git"
REPO="$WORK/repo"; mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" remote add origin "$WORK/origin.git"
git -C "$REPO" config user.email t@example.com
git -C "$REPO" config user.name Test

# Real images, so the file-type gate is exercised against real files.
magick -size 60x120 xc:red   "$REPO/before.png" 2>/dev/null
magick -size 60x120 xc:green "$REPO/after.png"  2>/dev/null
magick -size 40x40   xc:blue  "$REPO/extra.gif"  2>/dev/null
printf 'not a video really' > "$REPO/clip.mp4"

echo
echo "pushing assets"

out=$(cd "$REPO" && "$PUSH" 3712 screenshots before.png after.png --repo acme/sample-app 2>&1)
check "push exits zero" "0" "$?"

REF=$(git -C "$WORK/origin.git" for-each-ref --format='%(refname)' | head -1)
check "created the branch the convention requires" "refs/heads/assets/pr-3712-screenshots" "$REF"

TREE_FILES=$(git -C "$WORK/origin.git" ls-tree -r --name-only refs/heads/assets/pr-3712-screenshots | sort | tr '\n' ' ')
check "both files landed in the tree" "after.png before.png " "$TREE_FILES"

# The bytes on the branch must be the bytes we shot.
PUSHED_SHA=$(git -C "$WORK/origin.git" rev-parse "refs/heads/assets/pr-3712-screenshots:after.png")
LOCAL_SHA=$(git -C "$REPO" hash-object after.png)
check "pushed blob matches the local file" "$LOCAL_SHA" "$PUSHED_SHA"

check "reports a usable RAW_BASE" "https://raw.githubusercontent.com/acme/sample-app/assets/pr-3712-screenshots" \
  "$(echo "$out" | grep '^RAW_BASE=' | cut -d= -f2-)"
check "reports one RAW_FILE per input" "2" "$(echo "$out" | grep -c '^RAW_FILE=')"
check "a successful push emits its telemetry span" "yes" \
  "$(grep -l '"span":"pub.push.total"' "$WORK/registry/telemetry"/spans-*.jsonl >/dev/null 2>&1 && echo yes || echo no)"
check "RAW_FILE points at a path that exists in the tree" "yes" \
  "$(f=$(echo "$out" | grep '^RAW_FILE=' | head -1 | sed 's#.*/##'); git -C "$WORK/origin.git" ls-tree -r --name-only refs/heads/assets/pr-3712-screenshots | grep -qx "$f" && echo yes || echo no)"

# --- working tree is untouched ----------------------------------------------
check "left the working tree clean" "" "$(cd "$REPO" && git status --porcelain=v1 --untracked-files=no)"
check "did not switch branches" "yes" \
  "$(cd "$REPO" && git symbolic-ref -q HEAD >/dev/null && echo yes || echo no)"

echo
echo "repo derivation from the remote"

# Without --repo, owner/name comes from the origin remote URL — both shapes.
DREPO="$WORK/derive-repo"
mkdir -p "$DREPO" && git -C "$DREPO" init -q
cp "$REPO/before.png" "$DREPO/before.png"
git -C "$DREPO" remote add origin git@github.com:acme/derived-ssh.git
out=$(cd "$DREPO" && "$PUSH" 77 screenshots before.png --dry-run 2>&1)
check "derives owner/name from an ssh remote" "yes" \
  "$(echo "$out" | grep -q "raw.githubusercontent.com/acme/derived-ssh/assets/pr-77-screenshots" && echo yes || echo no)"
git -C "$DREPO" remote set-url origin https://github.com/acme/derived-https.git
out=$(cd "$DREPO" && "$PUSH" 77 screenshots before.png --dry-run 2>&1)
check "derives owner/name from an https remote" "yes" \
  "$(echo "$out" | grep -q "raw.githubusercontent.com/acme/derived-https/assets/pr-77-screenshots" && echo yes || echo no)"

echo
echo "purpose and naming"

(cd "$REPO" && "$PUSH" 3712 demo extra.gif --repo o/r >/dev/null 2>&1)
check "a second purpose gets its own branch" "yes" \
  "$(git -C "$WORK/origin.git" show-ref --verify -q refs/heads/assets/pr-3712-demo && echo yes || echo no)"

(cd "$REPO" && "$PUSH" 3712 "Screen Shots" before.png --repo o/r) >/dev/null 2>&1
check "rejects a purpose that is not slug-safe" "1" "$?"

echo
echo "input validation"

(cd "$REPO" && "$PUSH" 3712 screenshots clip.mp4 --dry-run) >/dev/null 2>&1
check "refuses video on the raw route" "1" "$?"
(cd "$REPO" && "$PUSH" not-a-pr screenshots before.png --dry-run) >/dev/null 2>&1
check "rejects a non-numeric PR number" "1" "$?"
(cd "$REPO" && "$PUSH" 3712 screenshots missing.png --dry-run) >/dev/null 2>&1
check "rejects a missing file" "1" "$?"
(cd "$REPO" && "$PUSH" 3712 screenshots) >/dev/null 2>&1
check "rejects an empty file list" "1" "$?"

# Two inputs with the same basename would silently overwrite in a flat tree.
mkdir -p "$REPO/sub" && cp "$REPO/before.png" "$REPO/sub/before.png"
(cd "$REPO" && "$PUSH" 3712 screenshots before.png sub/before.png --dry-run) >/dev/null 2>&1
check "rejects colliding basenames" "1" "$?"

echo
echo "dry run"

before_refs=$(git -C "$WORK/origin.git" for-each-ref --format='%(refname)' | wc -l | tr -d ' ')
dry=$(cd "$REPO" && "$PUSH" 4444 screenshots before.png --dry-run --repo o/r 2>&1)
check "dry run exits zero" "0" "$?"
check "dry run pushes nothing" "$before_refs" "$(git -C "$WORK/origin.git" for-each-ref --format='%(refname)' | wc -l | tr -d ' ')"
check "dry run still reports the refspec" "yes" \
  "$(echo "$dry" | grep -q "refs/heads/assets/pr-4444-screenshots" && echo yes || echo no)"

echo
echo "documented commands match the scripts"
# The SKILL.md tells agents to use this convention; if the prose and the script
# disagree, the prose wins in practice and produces broken branches.
check "SKILL.md documents the assets/ prefix" "yes" \
  "$(grep -q 'assets/pr-<N>-<purpose>' "$TESTS_DIR/../SKILL.md" && echo yes || echo no)"
check "SKILL.md documents deriving the repo from the origin remote" "yes" \
  "$(grep -qi "remote" "$TESTS_DIR/../SKILL.md" && echo yes || echo no)"
check "SKILL.md keeps the per-org consent rule" "yes" \
  "$(grep -qi "ask before the first push" "$TESTS_DIR/../SKILL.md" && echo yes || echo no)"
check "SKILL.md warns that raw MP4 will not play" "yes" \
  "$(grep -qi 'octet-stream' "$TESTS_DIR/../SKILL.md" && echo yes || echo no)"

echo
echo "-------------------------------------"
printf '%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
