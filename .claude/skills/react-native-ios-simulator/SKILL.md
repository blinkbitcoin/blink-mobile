---
name: react-native-ios-simulator
description: Use when running a React Native app on an iOS simulator on macOS — claiming an isolated simulator and Metro port, installing or building the app, reaching a particular screen or state, or any task involving xcrun simctl, Metro bundler ports, or a demo simulator. Required before capturing screenshots or video, and whenever other agents may share the same Mac.
---

# React Native on an Isolated iOS Simulator (macOS)

## Overview

Run the app on a simulator **you created**, fed by a Metro bundler on a port
**you reserved**, from a worktree **you own** — then prove on exit that
nothing else on the machine was disturbed.

Several agents run this concurrently on one Mac, alongside the user's own booted
simulator and their Metro on port 8081. Isolation here is mechanical, not a
convention to remember: the scripts reserve the port atomically and refuse to
shut down a device that is not named for your session.

**Core principle:** every simctl call is scoped to `$DEMO_UDID`. A simctl
command without a udid is a bug.

The app under test is configuration, not code: set `DEMO_APP_ID_IOS` to your
app's bundle id once per session. Nothing in these scripts assumes a
particular app.

## Never Do These

These take out the user's session or another agent's. There is no situation in
this workflow that needs any of them:

| Forbidden | Why |
|---|---|
| `simctl shutdown all` / `erase all` / `delete all` | Kills every agent's sim and the user's |
| `pkill -f metro`, `pkill node`, `killall node` | Kills the user's bundler on 8081 |
| Any `simctl` verb without `--udid`/`$DEMO_UDID` | Silently targets the *booted* device — usually the user's |
| `run-ios` with no `--udid` | Boots and hijacks a default simulator |
| Metro on 8081, or `--port` you picked by eye | 8081 is the user's; eyeballed ports collide with other agents |
| Booting/shutting a sim you did not create | Other agents' demo sims may be booted and mid-run |
| `simctl openurl` for deep links | Pops a SpringBoard confirm that simctl cannot dismiss and that survives relaunch — use TEMP `initialRouteName` |
| `--reset-cache` with the demo Metro config | Clears the *shared* `~/.cache/metro-demo` store — every other agent's warm cache dies with yours. Point `DEMO_METRO_CACHE_ROOT` at a fresh dir instead |

## Workflow

### 1. Claim a session

```bash
SKILL="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator
export DEMO_APP_ID_IOS=<your app's iOS bundle id>
eval "$("$SKILL/scripts/claim-session.sh" 3712)"
```

Exports `DEMO_PR`, `DEMO_UDID`, `DEMO_PORT`, `DEMO_SIM_NAME`,
`DEMO_SESSION_DIR`. It creates `${DEMO_SIM_PREFIX:-rn-demo}-pr<N>` if absent,
boots it, reserves a port in 8100–8499 by atomic mkdir in
`~/.claude/rn-sim-sessions` (override: `DEMO_SIM_REGISTRY`), persists the Metro
redirect onto that device only (needs `DEMO_APP_ID_IOS`; skipped with a note
otherwise), and snapshots which devices were booted beforehand.

Session state is keyed by the full device name (`<prefix>-pr<N>`), so repos
using these skills on the same machine never share or reap each other's
sessions even when their PR numbers coincide — provided each repo sets its own
`DEMO_SIM_PREFIX` (this repo's value lives in `AGENTS.md`).

Re-running is idempotent — same sim, same port. Sessions created before the
2026-08 rename keep their old device prefix; release them by setting
`DEMO_SIM_PREFIX=<old prefix>` for that one call.

When a **golden simulator** exists (see below), claiming clones it instead of
creating a blank device — app already installed, account already logged in —
and prints the golden's stamp as `# golden` comment lines, plus (when run from
an app worktree root) an instant `# golden verdict:` on whether the golden's
native build still matches `ios/Podfile.lock`. Anything that makes the clone
dishonest (golden booted, different device type, explicit runtime mismatch)
falls back to a blank create with a note on stderr, never silently.

Claim also reports missing credentials up front: set `DEMO_REQUIRED_ENV` to
the names of env vars real-account flows need (this repo lists it in
`AGENTS.md`), and any that are unset appear as a `# note: missing credentials`
line — the signal to plan the stub-harness route immediately instead of
hitting the wall mid-session. The claim itself never blocks on it; most demos
need no account at all.

### 2. Work in a scratchpad worktree

Never the shared checkout: the user keeps their own branch checked out and
Metro pointed at it.

```bash
git -C /path/to/your-app worktree add /private/tmp/.../wt-3712 <branch>
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
ls -dt ~/Library/Developer/Xcode/DerivedData/<YourApp>-*/Build/Products/Debug-iphonesimulator/*.app
xcrun simctl install "$DEMO_UDID" <path>/<YourApp>.app
```

Reuse is safe for pure-JS diffs and even dep removals (a native superset is
harmless) — while the native closure is unchanged. `Podfile.lock` is that
closure's fingerprint, so the verdict is a hash comparison, not git
archaeology (a wrong guess costs a ~14 min locked rebuild discovered as a
crash at launch):

```bash
"$SKILL/scripts/native-stamp.sh" check <dir-of-the-.app>/demo-native-stamp   # instant verdict
```

After any native build you make, stamp it so the next agent gets that verdict
too: `native-stamp.sh write <dir-of-the-.app>/demo-native-stamp`. For an
unstamped build (made outside this workflow), fall back to git:

```bash
git -C /path/to/your-app log origin/main --since=<build-date> -- ios/ package.json yarn.lock
```

If you genuinely must build (~14 min cold), take the lock and pin the device:

```bash
"$SKILL/scripts/with-lock.sh" native-build 1800 \
  node node_modules/react-native/cli.js run-ios --udid "$DEMO_UDID"
```

`npx react-native` misresolves inside a worktree — always `node node_modules/react-native/cli.js`.

### 4. Start your bundler and record its PID

The PID is what lets release-session stop *your* Metro without a `pkill`.
Run from the worktree root — the demo config resolves the app's own
`metro.config.js` from the working directory.

```bash
node node_modules/react-native/cli.js start --port "$DEMO_PORT" \
  --config "$SKILL/scripts/metro-demo.config.js" &
echo $! > "$DEMO_SESSION_DIR/metro.pid"
```

`metro-demo.config.js` is the app's own config plus a transform cache shared
across demo worktrees (`~/.cache/metro-demo`, override:
`DEMO_METRO_CACHE_ROOT`). Metro's cache keys are content- and
relative-path-based, so worktrees hit each other's entries: the first bundle
after a dependency bump is cold (~90s–2.5 min — poll with screenshots rather
than assuming failure at 40s), every later worktree's is warm (~15–30s, only
the diff's files re-transform). Never `--reset-cache` here — the store is
shared machine-wide.

### 5. Launch and shoot

```bash
xcrun simctl launch "$DEMO_UDID" "$DEMO_APP_ID_IOS" -RCT_jsLocation "localhost:$DEMO_PORT"
xcrun simctl io "$DEMO_UDID" screenshot /tmp/liveness.png   # poll only
```

Cold start takes ~40s to clear the splash; poll with throwaway screenshots.
For shots that will end up on a PR, use `react-native-demo-screenshots` — it
waits for the screen to settle first.

### 6. Reset to a fresh install when the demo needs it

```bash
"$SKILL/scripts/reset-app.sh"       # uses $DEMO_UDID / $DEMO_APP_ID_IOS / $DEMO_PORT
```

True uninstall/reinstall (bundle cached in the session dir first), then the
Metro redirect is re-persisted. This — not Maestro's `clearState` — is how to
simulate "the user reinstalled the app": `clearState` wipes the persisted
`RCT_jsLocation` redirect along with the app data, and the next plain launch
silently loads the user's 8081 bundler (see the `react-native-demo-videos`
gotcha table).

### 7. Flip JS with a reload, not a relaunch

Before/after pairs flip a file and shoot again. When the diff is JS-only,
reload the running app instead of terminate + launch + splash (~35s → ~5s per
flip, several flips per PR):

```bash
git checkout <main-sha> -- path/to/changed-screen.tsx
"$SKILL/scripts/reload-app.sh"      # uses $DEMO_PORT; same as pressing r in Metro
# shoot the "before", then restore and reload again
git checkout HEAD -- path/to/changed-screen.tsx
"$SKILL/scripts/reload-app.sh"
```

A full reload re-runs the JS entry point, so TEMP `initialRouteName` edits take
effect — the case Fast Refresh cannot cover and the reason flips used to need a
relaunch. The script broadcasts on Metro's `/message` websocket and then
**waits for Metro to report the re-served bundle** on `/events`: a broadcast
with no app connected succeeds silently, and an unconfirmed flip produces a
before/after pair whose sides are quietly identical. Non-zero exit means no
bundle request followed — fall back to `simctl terminate` + launch. That
fallback is not hypothetical: an app's dev-server connection dies after a few
reload cycles, and from then on every broadcast lands nowhere until the next
cold launch. Native diffs still need a rebuild, not a reload.

Exit 0 confirms the bundle was *served*, not that JS finished re-rendering —
the app takes a few more seconds to execute it, and capture's settle-wait will
happily lock onto the stable white teardown screen. Poll with throwaway
screenshots until content is visible before shooting the real frame.

### 8. Release and verify

```bash
"$SKILL/scripts/release-session.sh" 3712            # shut down, keep for 72h (default)
"$SKILL/scripts/release-session.sh" 3712 --delete   # remove immediately
```

Refuses to touch a device not named `${DEMO_SIM_PREFIX:-rn-demo}-pr<N>`, kills
only the recorded Metro PID, frees the port, then asserts every device booted
at claim time is still booted. **A non-zero exit here means you damaged someone
else's session — report it, don't ignore it.**

The default release keeps the simulator (with its app install and account) for
`DEMO_SIM_TTL_HOURS` (72h) so retakes cost ~3 min instead of a full rebuild;
`reap-stale.sh` — run automatically by every claim and release — deletes it
once the stamp expires, so kept sims cannot accumulate the way they did before
this skill existed (eight piled up once, one still booted from a session a week
dead). Use `--delete` only when you know no more shots are coming and want the
disk back now. A re-claim inside the window un-stamps the session, and the
reaper never touches a booted device or one named for another session prefix.

## The Golden Simulator: Skip Install + Login

A video session used to pay a fresh staging login (OTP, coordinate taps,
keyboard overlays) on every new simulator, and every session paid the app
install. The golden simulator pays both **once**: a blessed, shutdown device
with the app installed and an account logged in, which `claim-session.sh`
clones in seconds for each session. Clones are immutable copies — sessions can
never contaminate the golden or each other, which is what the rejected
warm-sim-reuse idea could not guarantee.

Create or refresh it by promoting a session you set up once:

```bash
eval "$("$SKILL/scripts/claim-session.sh" 3712)"
# install the app, log in to staging once (Maestro or by hand), verify the
# home screen, then promote - bless REPLACES release for this session:
"$SKILL/scripts/bless-golden.sh" 3712 --sha "$(git rev-parse HEAD)"
```

`bless-golden.sh` verifies the device is this session's (same ownership gate as
release), stops the session's Metro, shuts the device down, renames it to
`${DEMO_SIM_PREFIX:-rn-demo}-golden` (swapping out and deleting any previous
golden — exactly one device ever carries the name), writes a stamp
(`sha`/`date`/`device-type`/`runtime`), and adopts the session: port freed,
manifest gone, nothing left to release. Both the swap and claim's clone run
under a shared lock, so a clone can never race a re-bless.

**Staleness is judged, not guessed — and mechanically.** Bless hashes the
build's `ios/Podfile.lock` into the stamp (`--lockfile` overrides the default
cwd-relative path), and every claim run from an app worktree root prints the
verdict as a `# golden verdict:` line: `native build matches` or
`NATIVE BUILD STALE`. Stale means a native module changed since the bless (a
`Podfile.lock` change, like the geetest module rename) — install a fresh build
onto the clone or re-bless; do not trust the cloned install. For a stamp
without a hash (blessed before lockfile stamping, or blessed without a
lockfile), fall back to diffing native paths against the stamp's SHA:

```bash
git -C /path/to/your-app log <stamp-sha>..origin/main -- ios/ package.json yarn.lock
```

A clone that comes up logged out (staging sessions do expire) means the same
thing — re-bless with a fresh login. Opt out of cloning with
`DEMO_SIM_GOLDEN=none`, or point at a differently named golden with
`DEMO_SIM_GOLDEN=<device name>`. The reaper never touches the golden: it has
no session, and the name gate refuses it like any foreign device.

## After Editing the Scripts

The isolation guarantees are load-bearing for every other agent on this Mac, so
they are tested rather than asserted:

```bash
"$SKILL/tests/run.sh"     # 155 assertions, ~60s, exits non-zero on failure
```

It creates **no real simulators** — a fake `xcrun` goes first on PATH and the
session registry is redirected to a temp dir. Safe to run at any time, including
while other agents are mid-run.

Run it after touching anything in `scripts/`. If you add a guarantee, add the
assertion that fails without it — the suite has been mutation-checked, so a new
rule with no failing test is a rule nobody is holding you to.

## Reaching a Screen or State Without an Account

Most shots need no auth at all.

| Goal | How |
|---|---|
| Boot straight into any screen | TEMP `initialRouteName={"someScreen"}` + `initialParams` in the root navigator |
| A component in isolation | TEMP-mount it in the logged-out initial screen inside a padded `<View>`; neutralise any absolute-position full-bleed decoration with `{display:"none"}` so it cannot overlay your component |
| A state only the server can set (a lock, a flag, a migration phase) | TEMP-stub the single hook that *reads* it to return the target state, plus settled-state stubs for sibling data hooks the screen gates on. Stub inputs, never the logic under test — and caption in the PR exactly what was forced |
| A fresh-reinstall state | `scripts/reset-app.sh` — never Maestro `clearState`, which wipes the persisted Metro redirect along with the data |
| Seeing a value the UI doesn't show (Metro not forwarding console.log) | TEMP `<Text>DBG:{JSON.stringify(x)}</Text>` in the screen + a screenshot — one frame settles what logs can't |
| A specific locale | `simctl launch "$DEMO_UDID" "$DEMO_APP_ID_IOS" -AppleLanguages "(es)" -AppleLocale es_ES` — launch-arg locale applies when the app follows the device locale; args don't persist, so this is safe on a shared sim |
| Data-gated rows (username, profile fields) | TEMP-stub the hook that feeds the row → `return { username: "demouser", loading: false }` |
| Dark mode | `simctl ui appearance dark` does **not** work for apps that theme from their own persisted preference — edit that preference in the app's storage (AsyncStorage manifest or equivalent), then terminate + launch |
| Dynamic Type | `simctl ui "$DEMO_UDID" content_size accessibility-extra-large`, re-lays out in ~8s, then back to `medium` |
| Scrolling | simctl cannot scroll — `maestro --udid "$DEMO_UDID" test flow.yaml` with `- swipe: start: 50%,80% end: 50%,20%` |
| Behind a native `Alert` | Alerts can't be tapped via simctl and refire on relaunch — TEMP-set the modal's `useState(true)`, TEMP-suppress the alert trigger, then terminate + launch |

A flow that needs a backend credential absent from local builds (a payments
key, a wallet SDK key) dead-ends no matter what the UI promises. Mount the
component over a reachable real screen instead and caption the limitation
honestly.

Revert every TEMP edit with `git checkout` before finishing. They live in the
worktree only.

## Driving the UI: Element Blindness

Maestro's element targeting can fail silently: a ScrollView that is itself an
accessibility element collapses its children, so `maestro hierarchy` shows only
the scroll container and **testID / text matching fail app-wide** while taps
report success on nothing. Diagnose before writing taps:

```bash
maestro --udid "$DEMO_UDID" hierarchy        # if this shows only containers, element matching is blind
```

When the tree is collapsed, drive by geometry: take a fresh screenshot, then
`tapOn: point: "X%,Y%"` — percentages are resolution-independent, so the same
flow works across device sizes. Two more traps on iOS: dismiss the one-time
keyboard-intro overlay before the first `inputText`, and never assume
Appium/WebdriverIO selectors from a repo's e2e specs will transfer — Appium
sees a deeper tree than Maestro does.

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
| Maestro `clearState` to fake a reinstall | Persisted Metro redirect dies with the data; next launch loads the user's 8081 bundler — use `reset-app.sh` |
| `tapOn: "SomeText"` without checking the hierarchy | Collapsed accessibility tree: the tap never lands and nothing says so |
| Reusing Appium selectors in Maestro flows | Appium sees a deeper tree; the selectors match nothing |

## Red Flags — Stop

- About to type `simctl` with no udid
- About to `pkill` anything
- Reaching for a sim you did not create because it's "already booted"
- Release script exited non-zero and you moved on
- Editing files in the shared checkout rather than your worktree
