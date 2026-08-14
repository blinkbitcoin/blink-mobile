---
name: react-native-android-emulator
description: Use when running a React Native app on an Android emulator — claiming an isolated emulator and Metro port, pointing the app at that port, or any task involving adb, avd, emulator serials or an Android demo. Required before capturing Android screenshots or video, and whenever other agents may share the same machine.
allowed-tools: Bash(adb *) Bash(emulator *) Bash(maestro *) Bash(node node_modules/react-native/cli.js *) Bash(/*/.claude/skills/*/scripts/*.sh) Bash(/*/.claude/skills/*/scripts/*.sh *) Bash(/*/.claude/skills/*/tests/run.sh)
---

# React Native on an Isolated Android Emulator

## Overview

The Android twin of `react-native-ios-simulator`, and it exists because the
documented alternative — "pin the serial of an emulator you started" — does not
merely run slowly, it **silently produces a broken session**: a red *Unable to
load script* screen with **zero requests in your Metro log**, which reads like a
broken bundler rather than a request that went somewhere else.

**Core principle:** every `adb` call is scoped to `$DEMO_ANDROID_SERIAL`, and the
serial is *ours by construction* — the claim reserves an emulator console port and
boots with `-port <N>`, which fixes the serial at `emulator-<N>`. An `adb` command
without `-s` is a bug.

The app under test is configuration: set `DEMO_APP_ID_ANDROID` once per session.

## The thing that surprises everyone

**A React Native app on a stock emulator dials `10.0.2.2:8081`** — the host
loopback, on a port compiled into the framework. On a machine where several agents
each hold a Metro, 8081 is somebody else's, so your app loads *their* bundle or
nothing at all.

Two natural fixes both fail, and it is worth knowing why before you lose an hour:

| Attempt | What actually happens |
|---|---|
| `adb reverse tcp:8121 tcp:8121` | Succeeds, changes nothing. Reverse forwarding binds **device-localhost**, and the app is dialing **10.0.2.2** — an address the tunnel never sees. (Reverse forwarding is *not* broken on emulators; it is simply aimed at a door nobody knocks on.) |
| `adb shell setprop metro.host …` | Does override the emulator heuristic — but carries **no port**; the framework appends its own. It cannot express a claimed port. |

What works is the override the dev menu itself writes: the **`debug_http_host`**
preference, `host:port`, which `point-app-at-metro.sh` sets to
`10.0.2.2:<claimed port>`. No tunnel, your port.

## Never Do These

| Forbidden | Why |
|---|---|
| `adb` without `-s $DEMO_ANDROID_SERIAL` | Targets whichever single device is attached — usually another agent's emulator |
| `adb emu kill` on a serial you found | Kills a session that isn't yours; release only ever kills the PID it started |
| `pkill emulator` / `adb kill-server` | Takes out every agent's emulator and the adb daemon they share |
| Adopting a running emulator | It is someone's session; claim boots its own, and fails loudly when no AVD is free |
| Deleting an AVD to free a reservation | AVDs are durable hand-made artifacts; the reaper frees *reservations*, never AVDs |
| Assuming the app reached your Metro | The failure is silent — `verify-session.sh` is how you know |

## Workflow

### 1. Claim a session

```bash
SKILL="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-android-emulator
export DEMO_APP_ID_ANDROID=<your app's application id>
eval "$("$SKILL/scripts/claim-session.sh" 3712)"          # or: … 3712 Pixel_9a
```

Exports `DEMO_PR`, `DEMO_ANDROID_SERIAL`, `DEMO_PORT`, `DEMO_SIM_NAME`,
`DEMO_SESSION_DIR`. It reserves a Metro port **from the same registry the iOS skill
uses** (an iOS session and an Android session must never land on one port),
reserves an emulator console port and an AVD, boots that AVD with `-port`, waits
for `sys.boot_completed`, and records serial/PID/AVD plus a pre-flight list of
attached devices.

Re-running is idempotent. Concurrency is bounded by **AVD count** — unlike iOS,
where `simctl create` conjures devices; when all AVDs are reserved the claim fails
with the list rather than adopting somebody's emulator.

### 2. Get the app onto the emulator

```bash
adb -s "$DEMO_ANDROID_SERIAL" install -r <path>/app-debug.apk
```

A debuggable build is required for step 3 (`run-as`), which is the demo case
anyway.

### 3. Point the app at *your* Metro — the step that is easy to skip

```bash
node node_modules/react-native/cli.js start --port "$DEMO_PORT" \
  --config "$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator/scripts/metro-demo.config.js &
echo $! > "$DEMO_SESSION_DIR/metro.pid"

"$SKILL/scripts/point-app-at-metro.sh"        # debug_http_host = 10.0.2.2:$DEMO_PORT
adb -s "$DEMO_ANDROID_SERIAL" shell monkey -p "$DEMO_APP_ID_ANDROID" 1
```

`point-app-at-metro.sh` **force-stops the app** after writing, and that is not
superstition: the framework caches the resolved host in a process-static field, so
a value written after auto-detection has already run is ignored until the process
restarts.

If your worktree shares `node_modules` with another checkout, export
`DEMO_NODE_MODULES=<real clone>/node_modules` before starting Metro.

### 4. Verify — never assume

```bash
"$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator/scripts/verify-session.sh
```

Asserts Metro actually served a bundle on your port (watching the dev server's own
`/events` stream), reports a foreign Metro on 8081, and catches **checkout drift** —
the shared clone moving to another branch mid-session, which once manufactured a
phantom crash that looked like the change under test. Demos run from a **detached
worktree** for exactly this reason.

### 5. Capture

`react-native-demo-screenshots` and `react-native-demo-videos` pick Android up from
`$DEMO_ANDROID_SERIAL` automatically. One Android-specific rule: a Maestro flow
with `clearState` **deletes the `debug_http_host` preference**, so the next launch
dials 8081 again — re-run `point-app-at-metro.sh` after it (the videos skill
refuses such a flow unless the re-point is acknowledged).

### 6. Release

```bash
"$SKILL/scripts/release-session.sh" 3712            # keep the session 72h
"$SKILL/scripts/release-session.sh" 3712 --delete   # drop it now
```

Kills only the emulator PID this session started and only the Metro PID it
recorded, frees the port/console-port/AVD reservations, then asserts every device
attached at claim time is still attached. **A non-zero exit means you disturbed
someone else's session — report it, don't ignore it.**

## Reaching a screen, and what Android cannot demo yet

The JS-side techniques in the iOS skill (TEMP `initialRouteName`, stubbed hooks,
TEMP-mounted components, on-screen debug text) are platform-neutral and work here
unchanged. The `simctl`-side ones do not; Android equivalents:

| Goal | How |
|---|---|
| Fresh-install state | `adb -s "$SERIAL" shell pm clear <app-id>` — then **re-run `point-app-at-metro.sh`**, it wipes the pref too |
| A specific locale | `adb -s "$SERIAL" shell am start -e … ` per app, or change the emulator's system locale |
| Scrolling / taps | `maestro --udid "$SERIAL" test flow.yaml` (`--udid` takes a serial) |
| Screens under `FLAG_SECURE` | Black frames — TEMP-disable the screen-security hook and caption it |

**Account-gated screens cannot be demoed on Android yet.** There is no Android
equivalent of the iOS golden simulator (a blessed, logged-in device cloned per
session), so a screen reachable only from a signed-in account has no honest
recording path — the fallback is stills plus a captioned explanation. That gap is
tracked separately.

## After Editing the Scripts

```bash
"$SKILL/tests/run.sh"     # 56 assertions, ~20s, exits non-zero on failure; fake adb + emulator, no device, no network
```

Run it after touching anything in `scripts/`. If you add a guarantee, add the
assertion that fails without it — the suite is mutation-checked.
