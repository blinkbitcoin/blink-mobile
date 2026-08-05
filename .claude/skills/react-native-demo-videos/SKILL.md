---
name: react-native-demo-videos
description: Use when a PR needs a moving demo rather than screenshots — recording a user session flow on an iOS simulator or Android emulator to show a bugfix or feature behaving, before/after interaction videos, animated GIF, MP4 or WebM of app navigation, "demo expected behavior". Covers simctl recordVideo and adb screenrecord. Takes gif, mp4 or webm, and optionally ios or android, as arguments.
---

# Demo Videos for blink-mobile PRs

## Overview

Some behavior cannot be shown in a still. "The receipt disappears after you've
been away for thirty seconds" is a sequence — pay, leave, wait, return — and a
reviewer only believes it by watching it happen.

This skill scripts that sequence with Maestro, records it with `simctl`
(iOS) or `adb screenrecord` (Android), encodes it small enough to publish, and
puts it on the PR.

Session isolation is **not** handled here.

- **iOS** — claim a simulator with the `react-native-ios-simulator` skill
  first; everything below assumes `$BLINK_UDID` is set and the app is installed.
- **Android** — no claim skill exists yet. Pin the serial of an emulator *you
  started* (`adb devices`) in `$BLINK_ANDROID_SERIAL`, with the app installed;
  never record an emulator you didn't start.

With both variables set, the host OS decides: macOS records the iOS simulator
(only macOS has one), any other host records Android. Override with
`--platform ios|android` on the scripts, or by invoking the skill with an
`ios`/`android` argument.

**Core principle:** the recorder is stopped with SIGINT and nothing else.
`recordVideo` writes the QuickTime index only on a clean interrupt — any other
signal leaves a correctly-sized file that plays nowhere. On Android the SIGINT
must land on the *on-device* `screenrecord` process (`adb shell kill -2`);
killing the adb client races the disconnect and corrupts the file the same way.
`record-flow.sh` owns both stop paths — don't improvise either.

## Arguments: `gif`, `mp4` or `webm`, optionally `ios` or `android`

```
/react-native-demo-videos gif            # assets branch + <img>   (default)
/react-native-demo-videos mp4            # Chrome upload → real video player
/react-native-demo-videos webm           # same route, ~30% smaller (VP9)
/react-native-demo-videos gif android    # force the platform (default: iOS on
                                         # macOS, Android elsewhere)
```

A platform argument means the user wants that platform — pass it through as
`--platform` on record-flow.sh rather than relying on the host default.

Pick with the trade-off, not by habit:

| | `gif` | `mp4` | `webm` |
|---|---|---|---|
| Renders as | inline loop, no controls | native player, scrub, fullscreen | native player, scrub, fullscreen |
| Route | orphan assets branch, pure CLI | GitHub upload endpoint via Chrome | same Chrome route |
| Needs | nothing beyond git | Chrome extension connected | Chrome extension connected |
| Cost | 2–6 MB living in the repo forever | none | none |
| Good for | short loops, ≤20s, one behavior | longer walkthroughs, fine detail | a walkthrough that busts the size budget as mp4 |

Default to `mp4` over `webm` unless size is the problem: GitHub accepts both
but warns codec support is browser-specific and recommends H.264 — a VP9 webm
may not play for a reviewer on an old Safari.

**MP4 and WebM cannot be served from the assets branch.**
`raw.githubusercontent.com` returns `application/octet-stream` with
`x-content-type-options: nosniff` for video, so no browser will play it in a
`<video>`. Images get `image/png` and render fine, which is why GIF works and
video files do not. This is verified, not folklore — don't try to route video
through the branch.

If `mp4` or `webm` was asked for and Chrome is not connected, **stop and say
so**. Do not quietly produce a GIF: someone who asked for a player and got a
silent loop has been misled about what is on their PR.

## Workflow

### 1. Claim a session

```bash
SIM="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator
eval "$("$SIM/scripts/claim-session.sh" 3712)"          # iOS (other skill)
# export BLINK_ANDROID_SERIAL=emulator-5554             # Android instead
```

### 2. Write the flow

Maestro flows live next to the worktree and are checked in nowhere — they're
scaffolding. `flows/example-receipt-dismiss.yaml` in this skill is a worked
example; copy its shape. Maestro drives both platforms with the same YAML —
`--udid` takes an emulator serial too — but the `appId` differs:
`io.galoy.bitcoinbeach` on iOS, `com.galoyapp` on Android. For a flow that
must run on both, use `appId: ${APP_ID}` and pass `-e APP_ID=...`.

```yaml
appId: io.galoy.bitcoinbeach   # com.galoyapp on Android
---
- clearState          # a re-run must start where the last one started
- launchApp
- waitForAnimationToEnd:
    timeout: 10000    # never record a half-finished transition
- tapOn: "Send"
```

Two rules that come from things going wrong before:

- **`waitForAnimationToEnd` between steps.** Without it the recording catches
  screens mid-transition and looks broken rather than fast.
- **`tapOn: point: "50%,56%"` when text matching is flaky.** `tapOn: "Receive"`
  fails while the wallet is still connecting; a point tap does not.

Reaching a screen without an account (TEMP `initialRouteName`, stubbed hooks,
locale launch args) is covered by the simulator skill — the same tricks apply.

### 3. Record

```bash
SKILL="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-demo-videos
"$SKILL/scripts/record-flow.sh" after flows/receipt.yaml ./demo
```

Runs an unrecorded warm-up first (Maestro installs a driver on first contact
with a device — ~20s with an installer on screen), starts the recorder, pads
lead-in and lead-out so the clip doesn't start or stop on a hard cut, runs the
flow, then interrupts the recorder and verifies with `ffprobe` that what came
out is playable. Produces `after.mov` on iOS; on Android, `after.mp4` — pulled
off the device and cleaned up there automatically. Either feeds straight into
`encode-demo.sh`.

A failing flow fails the script but keeps the partial recording, which is
usually the fastest way to see what went wrong.

**Android:** `screenrecord` hard-caps a recording at 3 minutes. The script
warns and keeps what was captured when the cap is hit, but flows longer than
~2.5 minutes should be split or shortened up front.

### 4. Encode

```bash
"$SKILL/scripts/encode-demo.sh" ./demo/after.mov ./demo/after.gif  --format gif
"$SKILL/scripts/encode-demo.sh" ./demo/after.mov ./demo/after.mp4  --format mp4
"$SKILL/scripts/encode-demo.sh" ./demo/after.mov ./demo/after.webm --format webm
```

Defaults: 480px wide, 12 fps for GIF / 24 for MP4 and WebM, 10 MB budget. Over
budget exits 3 with a concrete suggestion rather than shipping something that
will be rejected at upload. The input is whatever the recorder produced —
`.mov` on iOS, `.mp4` on Android.

### 5. Publish

**GIF:**

```bash
cd /path/to/blink-mobile
"$SKILL/scripts/publish-demo.sh" 3712 before.gif after.gif --dry-run   # inspect
"$SKILL/scripts/publish-demo.sh" 3712 before.gif after.gif             # push + print embed
```

Pushes an orphan `assets/pr-<N>-demo` branch by plumbing (no checkout, no branch
switch) and prints the markdown. Ask before the first push — it's an org repo.

**MP4 / WebM:** GitHub's upload endpoint needs a browser session, so this part
is driven through the Chrome extension:

1. `list_connected_browsers` — if none, stop and tell the user.
2. Open the PR, focus the comment box.
3. `file_upload` with the `.mp4`/`.webm`; GitHub returns a
   `https://github.com/user-attachments/assets/<uuid>` URL.
4. Post the comment with that URL on its own line — GitHub turns it into a
   player automatically; no `<video>` tag needed.

Uploading publishes to an external service. Confirm with the user first, as with
any push.

## Before/After Pairs

The `after` side is cheap; the `before` side is where the time goes.

```bash
# after: on the branch as-is
record-flow.sh after flows/receipt.yaml ./demo

# before: revert just the changed file, re-run THE SAME flow
git checkout <main-sha> -- app/screens/send-bitcoin-screen/send-bitcoin-completed-screen.tsx
record-flow.sh before flows/receipt.yaml ./demo
git checkout HEAD -- app/screens/send-bitcoin-screen/send-bitcoin-completed-screen.tsx
```

**Same flow on both sides, always.** Two differently-driven recordings prove
nothing — the difference has to come from the code, not from how you tapped.

For a JS-only change, a file checkout plus fast refresh (~12s) is enough. A
branch detach is only needed when native code differs.

Consider whether the `before` is worth recording at all: for a crash or a
missing screen, a single still plus a sentence is often clearer than a video of
nothing happening.

## Length

Keep demos to one behavior, 10–20s. A 35-second wait in the flow (like a
staleness timeout) is dead screen time — record it, then trim, or shorten the
threshold with a TEMP constant and say so in the PR comment.

## Gotchas

| Gotcha | What happens |
|---|---|
| Stopping the recorder with anything but SIGINT | Right-sized file, no moov atom, plays nowhere |
| Stopping an Android recording by killing the adb client | Same corrupt file — the on-device `screenrecord` must get the SIGINT (`adb shell kill -2`), which record-flow.sh does |
| A flow longer than 3 minutes on Android | `screenrecord` stops at its cap; the tail of the flow is silently missing (record-flow.sh warns) |
| Recording a ScreenGuard screen on Android (backup phrase) | Black frames — `FLAG_SECURE` blocks capture; TEMP-disable `useScreenSecurity` and caption it |
| Launching the recorder from a background script without the SIG_DFL shim | SIGINT is inherited as *ignored*; the recorder can never be stopped cleanly and every recording is corrupt |
| Recording before the Maestro warm-up | Every demo opens on a driver installer |
| No explicit `fps` filter when encoding | `recordVideo` output is variable-frame-rate; GIF timing drifts |
| Single-pass GIF palette | Anything appearing after the opening frames bands badly |
| `maestro record` | No `--udid` (hijacks a device) and uploads to Maestro's cloud without `--local` — never use it; drive with `maestro test --udid` instead |
| MP4 on the assets branch | `application/octet-stream` + `nosniff`, will not play |
| Shutting the simulator down while recording | Truncated, unplayable file |

## After Editing the Scripts

```bash
"$SKILL/tests/run.sh"     # 70 assertions, ~30s, exits non-zero on failure
```

Fakes `xcrun`, `adb` (the full screenrecord start/kill -2/pull lifecycle) and
`maestro`; uses real ffmpeg against a synthesized clip, so the encoding
guarantees are checked by a real encoder. No simulator, no emulator, no
network, safe to run while other agents work. Mutation-checked — the suite
goes red when the SIGINT rule (either platform's), the disposition shim, or
the palette pass is broken.
