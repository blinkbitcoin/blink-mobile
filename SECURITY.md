# Security policy

## Reporting a vulnerability

Report privately. Do **not** open a public issue, and do not describe the
problem in a pull request.

- Email: `security@blink.sv`.

Include the app version (shown at the bottom of the Settings screen, or the
commit if you built from source), the platform (iOS or Android), and the
smallest set of steps that reproduces the issue. Expect an acknowledgement
within a few working days. Please give us a reasonable window to ship a fix
before disclosing publicly; a fix reaches users through an expedited App Store
or Google Play release, so allow for store review time.

Bugs in the backend this app talks to belong to
[blinkbitcoin/blink](https://github.com/blinkbitcoin/blink); the same
address covers both.

## Supported versions

Only `main` and the most recent store release are supported. Older builds get
no backported fixes — an affected user is expected to take the current store
update.

## Secrets policy

- **Nothing secret goes in the repository.** Signing material (`*.keystore`,
  the App Store provisioning profile), `GoogleService-Info.plist` and
  `.env.local` are gitignored. Release credentials live in CI secrets, not in
  the tree.
- **Sensitive data on the device goes through `react-native-keychain`**
  (Keychain on iOS, Keystore on Android), never `AsyncStorage`, which is
  unencrypted. This is one of the always-apply rules in
  [AGENTS.md](AGENTS.md).
- If a secret is committed or otherwise exposed, treat it as compromised:
  rotate first, then clean up history.

Dependency exposure is watched by `make audit` (`audit.sh`, which fails the
`Audit` CI check on any critical advisory), by Dependabot
(`.github/dependabot.yml`, daily), and by CodeQL on every pull request to
`main` (`.github/workflows/codeql.yml`).
