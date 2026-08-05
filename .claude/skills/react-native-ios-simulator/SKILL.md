---
name: react-native-ios-simulator
description: Use when running a React Native app (blink-mobile) on an iOS simulator on macOS — claiming an isolated simulator and Metro port, installing or building the app, reaching a particular screen, or any task involving xcrun simctl, Metro bundler ports, or a demo simulator. Required before capturing screenshots or video, and whenever other agents may share the same Mac.
---

# React Native on an Isolated iOS Simulator (macOS)

## Overview

Run blink-mobile on a simulator **you created**, fed by a Metro bundler on a
port **you reserved**, from a worktree **you own** — then prove on exit that
nothing else on the machine was disturbed.

Several agents run this concurrently on one Mac, alongside the user's own booted
simulator and their Metro on port 8081. Isolation here is mechanical, not a
convention to remember: the scripts reserve the port atomically and refuse to
shut down a device that is not named after your PR.

**Core principle:** every simctl call is scoped to `$BLINK_UDID`. A simctl
command without a udid is a bug.

## Never Do These

These take out the user's session or another agent's. There is no situation in
this workflow that needs any of them:

| Forbidden | Why |
|---|---|
| `simctl shutdown all` / `erase all` / `delete all` | Kills every agent's sim and the user's |
| `pkill -f metro`, `pkill node`, `killall node` | Kills the user's bundler on 8081 |
| Any `simctl` verb without `--udid`/`$BLINK_UDID` | Silently targets the *booted* device — usually the user's |
| `run-ios` with no `--udid` | Boots and hijacks a default simulator |
| Metro on 8081, or `--port` you picked by eye | 8081 is the user's; eyeballed ports collide with other agents |
| Booting/shutting a sim you did not create | Other agents' demo sims may be booted and mid-run |
| `simctl openurl` for deep links | Pops a SpringBoard confirm that simctl cannot dismiss and that survives relaunch — use TEMP `initialRouteName` |

## Workflow

### 1. Claim a session

```bash
SKILL="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator
eval "$("$SKILL/scripts/claim-session.sh" 3712)"
```

Exports `BLINK_PR`, `BLINK_UDID`, `BLINK_PORT`, `BLINK_SIM_NAME`,
`BLINK_SESSION_DIR`. It creates `blink-pr<N>-demo` if absent, boots it,
reserves a port in 8100–8499 by atomic mkdir in `~/.claude/blink-sim-sessions`,
persists the Metro redirect onto that device only, and snapshots which devices
were booted beforehand.

Re-running is idempotent — same sim, same port.

### 2. Work in a scratchpad worktree

Never the shared checkout: the user keeps their own branch checked out and
Metro pointed at it.

```bash
git -C /path/to/blink-mobile worktree add /private/tmp/.../wt-3712 <branch>
```

`node_modules`: a real copy, never a symlink — Metro dies on symlinked modules
with `_lruCache is not a constructor`. Fastest working options, in order:

- `yarn install --frozen-lockfile --ignore-scripts` + `node node_modules/patch-package/index.js` (~21s warm cache)
- `cp -R` the main checkout's `node_modules` (~4 GB, ~5 min) when the branch adds no deps

Both write shared state (yarn's global cache, disk). Wrap in the lock:

```bash
"$SKILL/scripts/with-lock.sh" yarn-install 900 yarn install --frozen-lockfile --ignore-scripts
```

### 3. Get the app onto your device

Prefer **reusing** a recent build over making one — a native build writes to
shared DerivedData that other agents are reading from:

```bash
ls -dt ~/Library/Developer/Xcode/DerivedData/GaloyApp-*/Build/Products/Debug-iphonesimulator/Blink.app
xcrun simctl install "$BLINK_UDID" <path>/Blink.app
```

Reuse is safe for pure-JS diffs and even dep removals (a native superset is
harmless). Confirm nothing added a native module since the build:

```bash
git -C .../blink-mobile log origin/main --since=<build-date> -- ios/ package.json yarn.lock
```

If you genuinely must build (~14 min cold), take the lock and pin the device:

```bash
"$SKILL/scripts/with-lock.sh" native-build 1800 \
  node node_modules/react-native/cli.js run-ios --udid "$BLINK_UDID"
```

`npx react-native` misresolves inside a worktree — always `node node_modules/react-native/cli.js`.

### 4. Start your bundler and record its PID

The PID is what lets release-session stop *your* Metro without a `pkill`.

```bash
node node_modules/react-native/cli.js start --port "$BLINK_PORT" &
echo $! > "$BLINK_SESSION_DIR/metro.pid"
```

First bundle on a cold worktree is ~90s–2.5 min. Poll with screenshots rather
than assuming failure at 40s.

### 5. Launch and shoot

```bash
xcrun simctl launch "$BLINK_UDID" io.galoy.bitcoinbeach -RCT_jsLocation "localhost:$BLINK_PORT"
xcrun simctl io "$BLINK_UDID" screenshot /tmp/liveness.png   # poll only
```

Cold start takes ~40s to clear the splash; poll with throwaway screenshots.
For shots that will end up on a PR, use `react-native-demo-screenshots` — it
waits for the screen to settle first.

### 6. Release and verify

```bash
"$SKILL/scripts/release-session.sh" 3712            # shut down, keep for 24h (default)
"$SKILL/scripts/release-session.sh" 3712 --delete   # remove immediately
```

Refuses to touch a device not named `blink-pr<N>-demo`, kills only the recorded
Metro PID, frees the port, then asserts every device booted at claim time is
still booted. **A non-zero exit here means you damaged someone else's session —
report it, don't ignore it.**

The default release keeps the simulator (with its app install and account) for
`BLINK_SIM_TTL_HOURS` (24h) so retakes cost ~3 min instead of a full rebuild;
`reap-stale.sh` — run automatically by every claim and release — deletes it
once the stamp expires, so kept sims cannot accumulate the way they did before
this skill existed (eight piled up once, one still booted from a session a week
dead). Use `--delete` only when you know no more shots are coming and want the
disk back now. A re-claim inside the window un-stamps the session, and the
reaper never touches a booted device or one named for another PR.

## After Editing the Scripts

The isolation guarantees are load-bearing for every other agent on this Mac, so
they are tested rather than asserted:

```bash
"$SKILL/tests/run.sh"     # 36 assertions, ~20s, exits non-zero on failure
```

It creates **no real simulators** — a fake `xcrun` goes first on PATH and the
session registry is redirected to a temp dir. Safe to run at any time, including
while other agents are mid-run.

Run it after touching anything in `scripts/`. If you add a guarantee, add the
assertion that fails without it — the suite has been mutation-checked, so a new
rule with no failing test is a rule nobody is holding you to.

## Reaching a Screen Without an Account

Most shots need no auth at all.

| Goal | How |
|---|---|
| Boot straight into any screen | TEMP `initialRouteName={"sendBitcoinCompleted"}` + `initialParams` in `root-navigator.tsx` |
| A component in isolation | TEMP-mount it in `GetStartedScreen` (logged-out initial route) inside `<View style={{paddingHorizontal:20,paddingTop:80,rowGap:20}}>`, and neutralise `styles.logoWrapper` with `{display:"none"}` — it is `position:absolute` full-bleed and will overlay your cards |
| A specific locale | `simctl launch "$BLINK_UDID" io.galoy.bitcoinbeach -AppleLanguages "(es)" -AppleLocale es_ES` — the app follows launch-arg locale when logged out; launch args don't persist, so this is safe on a shared sim |
| Username-gated rows | TEMP stub `use-pay-links.ts` → `return { username: "demouser", loading: false }` |
| Dark mode | `simctl ui appearance dark` does **not** work — Blink themes from its own preference. Edit AsyncStorage `manifest.json` in the app container: `persistentState` is a JSON *string*; parse it, set `themeByAccountId[activeAccountId]="dark"`, then terminate + launch |
| Dynamic Type | `simctl ui "$BLINK_UDID" content_size accessibility-extra-large`, re-lays out in ~8s, then back to `medium` |
| Scrolling | simctl cannot scroll — `maestro --udid "$BLINK_UDID" test flow.yaml` with `- swipe: start: 50%,80% end: 50%,20%` |
| Behind a native `Alert` | Alerts can't be tapped via simctl and refire on relaunch — TEMP-set the modal's `useState(true)`, TEMP-suppress the alert trigger, then terminate + launch |

A **real self-custodial account** is creatable with no OTP and no backend
(getStarted → Create new account → Accept). But `BREEZ_API_KEY` is absent from
any local build, so the wallet lands on "Wallet is offline" — self-custodial
Receive/Transfer cannot be shot live. Mount the component over the real
non-custodial home instead and caption the limitation honestly.

Revert every TEMP edit with `git checkout` before finishing. They live in the
worktree only.

## Capturing the Result

This skill gets the app onto an isolated device. Capture is a separate concern:

- **Stills** — `react-native-demo-screenshots` (settle-aware capture, honest
  crop pairs, numeric comparison against a design mock)
- **Video** — `react-native-demo-videos` (Maestro flow, `recordVideo`, gif/mp4)

Do not improvise either. Screenshotting without waiting for the screen to settle
puts splash screens on PRs, and `recordVideo` has a signal-handling trap that
silently produces unplayable files.

## Attaching the Result to a PR

Out of scope here. **Use the `github-pr-image-attachments` skill** — `gh` cannot
upload attachments, so it takes a specific orphan-branch route.

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Picking a port by eye | Two agents on one port; the second device renders the first's JS |
| `pkill -f metro` to clean up | User's 8081 bundler dies mid-session |
| Building without the lock | Two writers in one DerivedData |
| Skipping the release script | Sims accumulate booted for weeks; collateral damage goes unnoticed |
| Symlinked `node_modules` | Metro: `_lruCache is not a constructor` |
| Assuming failure at 40s | First cold bundle is ~2.5 min |

## Red Flags — Stop

- About to type `simctl` with no udid
- About to `pkill` anything
- Reaching for a sim you did not create because it's "already booted"
- Release script exited non-zero and you moved on
- Editing files in `blink-mobile/` rather than your worktree
