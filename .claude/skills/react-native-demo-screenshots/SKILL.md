---
name: react-native-demo-screenshots
description: Use when capturing still screenshots of a React Native app on an iOS simulator or Android emulator for a PR — before/after image pairs, showing a UI change or copy fix, cropping a pair honestly, or comparing a render against a design mock numerically. Covers simctl and adb screencap.
allowed-tools: Bash(xcrun simctl *) Bash(magick *) Bash(/*/.claude/skills/*/scripts/*.sh) Bash(/*/.claude/skills/*/scripts/*.sh *) Bash(/*/.claude/skills/*/tests/run.sh)
---

# Demo Screenshots for React Native PRs

## Overview

Stills are the right medium when the change is a *state*: new copy, a restyled
card, a row that should or shouldn't be there. When the change is a *sequence*,
use the `react-native-demo-videos` skill instead.

Session isolation is **not** handled here.

- **iOS** — claim a simulator with the `react-native-ios-simulator` skill
  first; everything below assumes `$DEMO_UDID` is set and the app is installed.
- **Android** — no claim skill exists yet. Pin the serial of an emulator *you
  started* (`adb devices`) in `$DEMO_ANDROID_SERIAL`, with the app installed;
  never shoot an emulator you didn't start.

With both variables set, the host OS decides: macOS shoots the iOS simulator
(only macOS has one), any other host shoots Android. Override with
`--platform ios|android` — also the flag to reach for when the user asks for
the non-default platform — or implicitly with `--udid`/`--serial`.

**Core principle:** a pair only means something if both sides were shot the
same way — same device, same state, same crop. Anything that differs between
before and after, other than the code, is a way for the comparison to lie.

## Workflow

```bash
SIM="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator
SHOT="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-demo-screenshots
eval "$("$SIM/scripts/claim-session.sh" 3712)"          # iOS
# export DEMO_ANDROID_SERIAL=emulator-5554             # Android instead

"$SHOT/scripts/capture.sh" after ./shots
```

`capture.sh` shoots via `simctl` or `adb exec-out screencap -p` depending on
which device is claimed, and shoots repeatedly until two consecutive frames are
identical, then keeps one. Shooting blind is the usual way to end up with a splash screen, a
skeleton loader, or a half-finished transition on the PR. If the screen never
settles it still writes a file and says so on stderr, rather than pretending.

`--no-wait` shoots once, for screens that animate forever (a spinner, a
looping illustration).

## Before/After Pairs

Fastest first:

- **One file changed:** `git checkout <main-sha> -- <file>` → `reload-app.sh` from the simulator skill (~5s, no relaunch; a full reload also applies TEMP `initialRouteName` edits, which fast refresh does not) → shoot → `git checkout HEAD -- <file>` → reload again
- **Copy/i18n swaps:** `git checkout origin/main -- app/i18n` → `reload-app.sh` (still JS-only), shoot, restore
- **Whole branch:** build native once from the pre-change tree, then `git checkout --detach <branch>` for the JS side. Needs `git checkout -- ios/Podfile.lock` first, since pod install dirties it

**Never a simulator per side.** Running "before" on one device and "after" on
another halves wall-clock on paper and was explicitly rejected (issue #4092):
two simulators are two devices — different app data, account state,
remote-config fetches, timing — and anything that differs between the sides
other than the code is a way for the comparison to lie. A worktree per side
against one simulator is honest but slower than it sounds: each worktree pays
its own `node_modules` install and every side-switch is a Metro swap, while
the in-place flip above is a file checkout plus a ~5s reload. One worktree,
one device, flip the code.

Then crop both sides with one box:

```bash
"$SHOT/scripts/crop-pair.sh" shots/before.png shots/after.png \
  --crop 1179x600+0+400 --out-dir shots/cropped
```

It refuses to run when the inputs differ in size, or when the box doesn't fit —
both of which silently produce a comparison that flatters one side.

## Comparing Against a Design Mock

Measure, never eyeball. ImageMagick is installed.

Get the card bounding box by scanning one text-free row or column for the
card's exact background hex:

```bash
magick shot.png -crop 1206x1+0+840 +repage txt:- | grep '#1B1B1BFF'
```

Get icon and button boxes by isolating the accent colour:

```bash
magick shot.png -fuzz 25% -fill white -opaque '#FF7700' \
  -fill black +opaque white -connected-components 8 -verbose null: | head -20
```

Then **normalise every measurement against card width** so the mock and the
screenshot compare at different scales. This caught an icon 42% oversized and
type 15% undersized that both looked fine in review.

## Reaching a Screen

Covered by `react-native-ios-simulator` — TEMP `initialRouteName`, stubbed
hooks, locale launch args, dark mode via AsyncStorage, Dynamic Type. The same
techniques serve stills and video. The JS-side tricks (TEMP `initialRouteName`,
stubbed hooks, TEMP-mounted components) are platform-neutral and work unchanged
on Android; the `simctl`-side ones (locale launch args, Dynamic Type) are
iOS-only.

**Android only:** the backup-phrase screens register ScreenGuard
(`FLAG_SECURE`), so `screencap` and `screenrecord` return black frames there.
TEMP-disable the `useScreenSecurity` hook to shoot them, and caption that this
was forced.

## Publishing

Out of scope here. **Use the `github-pr-image-attachments` skill**, which owns
the orphan-branch route and its gotchas:

```bash
cd /path/to/your-app
ATT="$(git rev-parse --show-toplevel)"/.claude/skills/github-pr-image-attachments
"$ATT/scripts/push-assets-branch.sh" 3712 screenshots before.png after.png
```

Attaching is the default, not a question — including when the state had to be
simulated. Caption honestly what was forced.

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Shooting without waiting for the screen to settle | Splash screen or mid-transition on the PR |
| Different crop boxes per side | The comparison flatters whichever side was cropped tighter |
| Shooting the pair on different devices, or one side per platform | Different sizes and chrome; no honest comparison possible |
| `simctl ui appearance dark` | Doesn't work for apps that theme from their own persisted preference |
| `adb shell screencap -p > file` | Old adb mangles the PNG's line endings — `exec-out` (what capture.sh uses) is the binary-safe channel |
| Shooting a ScreenGuard screen on Android | A black frame, not the screen |
| Judging a mock comparison by eye | Misses 15–40% size errors that look fine |

## After Editing the Scripts

```bash
"$SHOT/tests/run.sh"     # 58 assertions, ~15s, exits non-zero on failure
```

Fakes `xcrun` and `adb` (writing real PNGs) and uses real ImageMagick, so the
crop and validation guarantees are enforced by the tool that will enforce them
in production. No simulator, no emulator, no network.
