---
name: blink-staging-session
description: Use when a Blink demo session needs a real logged-in staging account on a claimed iOS simulator — logging in with the staging global OTP, switching a fresh install off the Main (production) instance, or provisioning/refreshing the golden simulator with a live login. Blink-repo-specific; the app-agnostic simulator mechanics live in react-native-ios-simulator.
allowed-tools: Bash(xcrun simctl *) Bash(maestro *) Bash(/*/.claude/skills/*/scripts/*.sh) Bash(/*/.claude/skills/*/scripts/*.sh *) Bash(/*/.claude/skills/*/tests/run.sh)
---

# A Logged-In Staging Session on a Claimed Simulator (Blink-specific)

## Overview

The generic skills are deliberately app-agnostic; this one owns the parts
that are pure Blink: which backend a fresh install points at, how the login
flow is laid out, and where the staging credential comes from. It exists so
no session ever again spends forty minutes rediscovering that a staging
login was possible all along.

Two facts do most of the work:

- **Staging accepts a global OTP.** Any valid-format phone number logs in
  with the shared code. The value is machine state, never repo state:
  `GALOY_STAGING_GLOBAL_OTP` in `.env.local` (gitignored, loaded by `.envrc`
  via direnv). `claim-session.sh` already reports it when missing (it is in
  `DEMO_REQUIRED_ENV`); if it is not set, ask the user for the standard PIN —
  every developer has it — and never write the value into anything tracked.
- **A fresh install points at Main — production.** The persisted-state
  default is `galoyInstance: Main`, dev build or not. Logging in with the
  staging OTP against Main fails; the instance must be switched first via
  the hidden developer screen (triple-tap the GetStarted logo).

## Logging in

Claim a session and install the app first (`react-native-ios-simulator`,
steps 1–5 — the app must be running against your session's Metro), then:

```bash
BLINK="$(git rev-parse --show-toplevel)"/.claude/skills/blink-staging-session
"$BLINK/scripts/staging-login.sh"                      # fresh install: switches to Staging, then logs in
"$BLINK/scripts/staging-login.sh" --skip-instance-switch   # already on Staging
"$BLINK/scripts/staging-login.sh" --phone 732459186        # pick the account
```

The script drives both flows with Maestro coordinate taps (the app's
accessibility tree is collapsed on these screens — see the simulator skill's
element-blindness section), injects the OTP as a Maestro env var so it never
lands in a flow file, and finishes with a verification screenshot. **Look at
that screenshot**: a successful login shows the phone number and balances on
the home screen. The script cannot read pixels; you can.

Notes that save retakes:

- The country code defaults to the device locale. The default phone digits
  are a Swedish mobile shape; pass `--phone` with digits valid for whatever
  country the picker shows if your simulator differs.
- Staging accounts are shared by number: anyone logging in with the same
  digits lands in the same account. For a golden bless that is fine (the
  account is disposable); for a demo needing pristine state, pick unlikely
  digits of your own.
- The coordinate taps assume the skill's default portrait iPhone
  (16-Pro-class). A different device type may need adjusted percentages —
  screenshot between steps rather than guessing.

## Provisioning or refreshing the golden simulator

This is the Blink recipe for the generic `bless-golden.sh` (which does the
mechanical part: driver bake, stamps, swap):

1. Claim a session; **build fresh if the native closure moved** — and note
   that in a demo worktree `yarn install --ignore-scripts` skips two
   postinstalls a native build needs: run `npx install-skia` and
   `node_modules/@breeztech/breez-sdk-spark-react-native/scripts/postinstall.sh`
   before `pod install`, or the build dies at link on missing Skia/Breez
   binaries. Simulator builds are x86_64 by design (`EXCLUDED_ARCHS arm64`
   in the Podfile) — that is not a mistake to fix.
2. `staging-login.sh`, verify the home screen.
3. Bless from the worktree root so both stamps are right:

```bash
SIM="$(git rev-parse --show-toplevel)"/.claude/skills/react-native-ios-simulator
"$SIM/scripts/bless-golden.sh" <pr> --sha "$(git rev-parse --short HEAD)" --lockfile ios/Podfile.lock
```

Re-bless whenever a clone tells you to: it comes up logged out (staging
sessions expire), the claim prints `NATIVE BUILD STALE`, or the claim notes a
maestro upgrade voided the baked driver.

## After Editing the Scripts

```bash
"$BLINK/tests/run.sh"     # exits non-zero on failure; fake maestro/xcrun, no simulator, no network
```

Same house rule as the other skills: a new guarantee lands with the
assertion that fails without it.
