---
name: github-pr-image-attachments
description: Use when embedding screenshots, GIFs, or any image into a GitHub pull request comment or review from the command line — including "attach the screenshots to the PR", "add before/after images", or when a gh attachment upload or gist has been blocked. Covers blinkbitcoin repos.
---

# Attaching Images to a GitHub PR

## Overview

`gh` has no attachment upload. The web drag-and-drop endpoint needs a browser
session, and gist creation gets blocked by the permission classifier. The route
that works is to push the images to an **orphan branch in the same repo** and
embed `raw.githubusercontent.com` URLs.

**Core principle:** the asset branch must outlive the PR. Delete it and every
embedded image 404s, including in the merged history.

## Rule

Screenshots always go **in the PR itself**, never handed to the user as local
files to drag in — this holds even when the state shown was simulated or
mocked. If the images can't be embedded, say so in the PR rather than leaving
them out.

## Ask First

Pushing a branch to an org repo is outward-facing. Ask before the first push.
The `assets/pr-<N>-*` pattern is established convention on
`blinkbitcoin/blink-mobile`; for any other repo or org, get explicit approval
first.

## Procedure

Build a commit with git plumbing — no checkout, no branch switch, nothing that
touches the working tree:

```bash
cd /path/to/repo
PR=3712

BLOB_BEFORE=$(git hash-object -w before.png)
BLOB_AFTER=$(git hash-object -w after.png)
TREE=$(printf '100644 blob %s\tbefore.png\n100644 blob %s\tafter.png\n' \
  "$BLOB_BEFORE" "$BLOB_AFTER" | git mktree)
COMMIT=$(git commit-tree "$TREE" -m "screenshots for #$PR")

git push origin "$COMMIT:refs/heads/assets/pr-$PR-screenshots"
```

Then embed, two-up in a table:

```bash
RAW=https://raw.githubusercontent.com/blinkbitcoin/blink-mobile/assets/pr-$PR-screenshots
gh pr comment "$PR" --body "| Before | After |
|---|---|
| <img src=\"$RAW/before.png\" width=\"300\"> | <img src=\"$RAW/after.png\" width=\"300\"> |

<sub>Images live on branch \`assets/pr-$PR-screenshots\` — deleting it breaks them.</sub>"
```

## Naming

`assets/pr-<N>-<purpose>` — e.g. `assets/pr-3712-screenshots`,
`assets/pr-3712-demo`. This is what the repo actually uses; every asset branch
on `blinkbitcoin/blink-mobile` follows it (`assets/pr-3973`,
`assets/pr-3977-screenshots`, `assets/pr-3993-screenshots`,
`assets/pr-3995-screenshots`, `assets/pr-4024-screenshots`). The `assets/`
prefix keeps them grouped and out of the way of real branches.

## Video

GIFs are images and travel this route unchanged — embed with `<img>` like any
screenshot.

**MP4 does not.** `raw.githubusercontent.com` serves `.mp4` as
`application/octet-stream` with `x-content-type-options: nosniff`, so no browser
will play it in a `<video>` element; a `.png` from the same branch comes back as
`image/png`, which is why screenshots work. Verified directly against both.

Video therefore has to go through GitHub's own upload endpoint, which needs a
browser session: upload the file into the comment box via the Chrome extension
and GitHub returns a `https://github.com/user-attachments/assets/<uuid>` URL
that renders as a real player. Put that URL on its own line — no `<video>` tag
required. See the `react-native-demo-videos` skill for producing the file.

## Common Mistakes

| Mistake | Consequence |
|---|---|
| `git push origin "$COMMIT:refs/heads/..."` with the refspec assembled in a shell variable | Expansion mangles it; put the refspec literal in the command |
| Cleaning up the asset branch after merge | Every image in the PR and its history 404s |
| No note that the branch must survive | Someone tidies it up later and breaks the PR |
| `gh pr comment` with a bare markdown `![]()` | Works, but `<img width>` is what keeps phone screenshots from rendering full-bleed |
| Handing PNGs to the user for manual drag-drop | The images end up nowhere; embed them |

## Verify

Open one raw URL after pushing — a 404 means the push landed on a different ref
than the one you embedded.

```bash
curl -sSI "$RAW/after.png" | head -1
```
