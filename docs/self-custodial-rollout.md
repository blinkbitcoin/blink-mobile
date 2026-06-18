# Self-Custodial Rollout — Release Gate Checklist

This document defines the cross-cutting regression and release-gate checks that
must pass before promoting a self-custodial release to staged or general
rollout. It corresponds to Story 6.5 of Epic 6 (Rollout, Settings, and
Hardening) in `blink-specs` (branch `feat--self-custodial-1`).

The list is a manual gate. Most items are validated by existing CI commands;
the rest require scripted manual or QA verification.

## Pre-merge gate (CI / scripted)

- `yarn check-code` clean (TypeScript, ESLint, i18n freshness, GraphQL schema).
- `yarn jest` full suite green.
- `yarn update-translations` run on the merge branch — `app/i18n/i18n-types.ts`
  must be in sync with `app/i18n/raw-i18n/source/en.json` (FR-NFR17).
- `app/i18n/raw-i18n/translations/*.json`: every locale carries any new key
  added to the English source for this release (NFR17).

## Backup / Restore matrix (NFR22)

For every supported OS version in the release matrix, exercise both onboarding
flows end-to-end at least once:

- Manual phrase backup → restore on a fresh device install.
- Cloud backup (Google Drive on Android, iCloud on iOS) → restore on a fresh
  device install.

Any failure on a supported OS blocks release.

## Deep-link routing (NFR23)

For each active-account combination, hit at least one deep link of every
supported type (`bitcoin:`, `lightning:`, `lnurl1...`, `lnurlp1...`, LN
address, BIP21, Spark address):

- Custodial-only user → routes to custodial flow.
- Self-custodial-only user → routes to self-custodial flow.
- Mixed-account user with custodial active → routes to custodial flow.
- Mixed-account user with self-custodial active → routes to self-custodial
  flow.

## Custodial regression (NFR24, FR68)

Run the suite with `nonCustodialEnabled` forced to `false` (Firebase Remote
Config or local override). Every existing custodial-only flow must work
identically to a pre-Spark build:

- Onboarding (account-type selection screen is hidden; user lands on the
  legacy custodial path).
- Send / Receive on each Lightning, on-chain, and LNURL variant.
- Settings, account level, KYC upgrade, contacts, notifications.

Document any visible diff and treat it as a release blocker.

## Feature-flag rollback (Story 6.4 / NFR15)

With a self-custodial account active and operational on a device, flip
`nonCustodialEnabled` to `false` in Remote Config and re-launch the app.

- If the user has a custodial account on the device: app must auto-route to
  custodial. Self-custodial UI must disappear. Mnemonic and backup state must
  remain intact.
- If the user has only self-custodial: app must show the
  `TemporarilyUnavailableScreen`. Mnemonic must remain in the keychain.

Then flip the flag back to `true` and re-launch:

- Self-custodial provider must reinitialize with the same wallet identifier,
  backup status, and Stable Balance preference. No data loss.

## Backend-only feature gating (Story 6.7 / FR83–FR85)

Verify all three tabs in each account state:

- Self-custodial-only user → Circles, Earns, Card all show the
  `BackendFeatureGate` "needs custodial account" explanation.
- Custodial account on device but not signed in → all three show the
  "sign in" explanation.
- Authed custodial user (any active account) → all three render their
  feature normally (mixed-account rule).

Tabs must remain visible in navigation in every state.

## Observability (Story 6.8)

Confirm via Firebase Console that the four self-custodial events fire under
the right conditions and contain only safe payload fields:

- `self_custodial_backup_completed` (with `backup_method`).
- `self_custodial_restore_completed`.
- `self_custodial_stable_balance_activated` (with `label`).
- `self_custodial_rollout_exposed` (once per session, with the flag values
  and `has_custodial_account`).

No payload field should ever contain mnemonic, backup phrase, or any other
recovery material (NFR6).

## Accessibility (NFR18)

For every new screen added in this Epic (Account Information, Transaction
Limits, Ways to Get Paid, Backend Feature Gate, Temporarily Unavailable):

- Touch targets ≥ 44 × 44 pt.
- Text contrast meets WCAG AA.
- VoiceOver (iOS) and TalkBack (Android) read all interactive elements with
  meaningful labels.

## Fund-loss watchpoints (NFR11)

Manual scripted scenarios — no observed fund loss in any of these is a hard
release gate:

- Self-custodial onboarding → backup → restore → balance reconciles.
- Send Lightning, send on-chain, receive Lightning, receive on-chain.
- Stable Balance activate → BTC↔USDB convert in both directions → deactivate.
- Account switch mid-flight: start a send on self-custodial, switch to
  custodial before confirmation completes → no double-spend, no orphan
  payment.

## Release evidence

Before promotion, archive:

- The CI run link with all checks green.
- A short note (`yyyy-mm-dd-self-custodial-rollout.md`) in the team's release
  log describing which manual scenarios were executed and the build SHA.
- Firebase analytics dashboard screenshot showing the four self-custodial
  events for the cohort.
