# Logging into Staging (Custodial Account)

How to get a **custodial** staging session in a local development build —
for manual testing, demos, and on-device verification of custodial-only
surfaces (wind-down, migration, intraledger send, etc.). Collected from a
device-verified walkthrough during a PR review (see #4083); every step below
was needed at least once.

## The trap: "Create new account" is self-custodial

On GetStarted, **Create new account → Accept** provisions a *local
self-custodial* wallet. It works without a backend, but its send/receive
surfaces dead-end on **"Wallet is offline"** in local builds (no Breez API key
is configured), and none of the custodial-only features exist on it.

A custodial account is only reachable via:

> GetStarted → **Log in / Restore** → **Custodial** → SMS login

## Steps

1. **Switch the environment to Staging first** (before logging in):
   triple-tap the logo on the GetStarted screen → developer screen → scroll to
   *Update Environment* → select **Staging** → **Save changes**. Verify the
   screen shows `Galoy Instance: Staging`.
2. **Log in / Restore → Custodial.** The country picker defaults to the
   device locale (e.g. +46 on a Swedish-locale machine) — pick the region your
   whitelisted test number belongs to (e.g. El Salvador, +503) manually.
3. **Enter a whitelisted staging test number** and request the SMS code.
4. **OTP:** use the global staging test OTP, available to the team as
   `$GALOY_STAGING_GLOBAL_OTP` (ask ops / check your team secret store — the
   value is deliberately not in this repo). Note that detox's local default
   code is rejected by staging; the env-var value is the one that works.

## Pre-flight: is the number whitelisted?

Burning UI attempts on a dead number is slow. Probe the API directly:

```bash
curl -s https://api.staging.blink.sv/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation login($input: UserLoginInput!) { userLogin(input: $input) { errors { code } authToken } }","variables":{"input":{"phone":"+503XXXXXXXX","code":"000001"}}}'
```

- `PHONE_CODE_ERROR` → the number is whitelisted; only the code was wrong.
  Proceed in the UI.
- `PHONE_PROVIDER_ERROR` → the number is not usable on staging; find another.

## Staging network facts

- Staging runs **signet** — confirm with
  `{ globals { network } }` against the staging GraphQL endpoint.
- For send-flow address validation, the BIP173 signet/testnet test vector
  `tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx` is accepted as a valid
  destination.

## Related

- [Development Setup](./dev.md) — local environment, Nix, Metro
- [E2E Testing](./e2e-testing.md) — automated flows against staging
