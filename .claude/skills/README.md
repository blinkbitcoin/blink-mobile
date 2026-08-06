# Agent Skills

Executable, **tested** workflows for producing on-device proof of app behavior
— screenshots and demo videos on isolated simulators, published straight onto
PRs. Claude Code discovers them automatically (each skill's `SKILL.md` is the
agent-facing contract); this README is the human landing page.

The skills are app-agnostic. The app under test is configuration:

```bash
export DEMO_APP_ID_IOS=<your app's iOS bundle id>
export DEMO_APP_ID_ANDROID=<your app's Android application id>
```

Scripts refuse to run without the value they need — there are no silent
defaults. A repo adopting these skills should carry its values in its agent
instructions (e.g. `AGENTS.md`).

## The skills

| Skill | One line |
|---|---|
| [`react-native-ios-simulator`](./react-native-ios-simulator/SKILL.md) | Claim/release an **isolated** simulator + Metro port; reach screens and states (stubs, reinstall via `reset-app.sh`); never touches your simulator or your Metro on 8081 |
| [`react-native-demo-screenshots`](./react-native-demo-screenshots/SKILL.md) | Settle-aware capture, honest before/after crop pairs, numeric comparison against design mocks |
| [`react-native-demo-videos`](./react-native-demo-videos/SKILL.md) | Maestro-driven recordings with safe recorder stop paths, GIF/MP4/WebM encoding, and a guard against the `clearState` Metro-redirect trap |
| [`github-pr-image-attachments`](./github-pr-image-attachments/SKILL.md) | Embed images in PR comments via an orphan `assets/pr-<N>-*` branch (`gh` has no attachment upload); repo derived from the origin remote |

Some checkouts also carry `gh-stack` (a vendored personal workflow for stacked
PRs) — it is not part of the demo pipeline.

## Quickstart (a before/after screenshot pair on a PR)

```bash
SKILLS="$(git rev-parse --show-toplevel)"/.claude/skills   # or this directory
export DEMO_APP_ID_IOS=<bundle id>

eval "$("$SKILLS/react-native-ios-simulator/scripts/claim-session.sh" <PR#>)"
# install a build, start Metro on $DEMO_PORT — see the simulator SKILL.md
"$SKILLS/react-native-demo-screenshots/scripts/capture.sh" after ./shots
# ...flip the code to the before state, capture again, then:
"$SKILLS/github-pr-image-attachments/scripts/push-assets-branch.sh" <PR#> screenshots shots/*.png
"$SKILLS/react-native-ios-simulator/scripts/release-session.sh" <PR#>
```

The scripts and their session contract are the one doing-interface, for humans
and agents alike (`make help` orients you; pipeline make-wrappers were tried
and removed — they added a second way to hold session state without covering
the flow's hard middle).

Every step is safer than it looks: sessions own a **named** simulator and an
**atomically reserved** port, every destructive verb is guarded by that name,
and release proves on exit that nothing else on the machine was disturbed.

## Trusting it

```bash
./run-all-tests.sh
```

Runs every skill's suite — a couple hundred assertions against fake
`xcrun`/`adb`/`maestro` binaries (real `ffmpeg`/ImageMagick/git where the
guarantee needs the real tool). No simulators, no emulators, no network: safe
on any machine, any time, including CI. The load-bearing guards are
mutation-checked, and the key `SKILL.md` claims are pinned by prose-contract
assertions, so documentation drift fails the tests. This script also fails if
a skill lacks a suite or this README stops mentioning it.

## Adding or changing a skill

1. Scripts live in `<skill>/scripts/`, the agent contract in
   `<skill>/SKILL.md`, the suite in `<skill>/tests/run.sh` (executable,
   ending with the standard `N passed, M failed` line — `run-all-tests.sh`
   picks it up automatically).
2. New rule → new failing assertion first. A guarantee without a test that
   fails when it breaks is a guarantee nobody is holding you to.
3. Keep skills app-agnostic: app identity, device naming, and target repos
   are configuration (`DEMO_*` env), never hardcoded.
