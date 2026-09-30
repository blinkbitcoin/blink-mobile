# Self-Custodial Backend Independence — Implementation Plan

A self-custodial account holds its keys on the device and settles through the
Breez Spark SDK. Nothing about holding, sending, or receiving money on it needs
the Blink backend. The app, however, still does: a self-custodial session today
depends on `api.blink.sv` for the exchange rate, the currency list, and parts of
destination resolution, and it has no notion of the backend being unreachable —
so when the backend is down a self-custodial user cannot see a balance, cannot
open the receive screen, and cannot enter an amount to send.

This document inventories every Blink-service touchpoint a self-custodial
session still reaches, and plans the work to make the wallet fully usable while
those services are unavailable.

Related: [Architecture](./architecture.md),
[Self-Custodial Rollout](./self-custodial-rollout.md),
[API Reference](./api-reference.md).

## Goal and non-goals

**Goal.** With every Blink service unreachable, a self-custodial account can:
view its balances in its display currency, receive (Lightning invoice, Lightning
address, on-chain, Spark), send (invoice, LNURL/Lightning address, on-chain,
Spark), convert BTC↔USDB, read its transaction history, change settings, and
back up or restore — with honest, non-alarming UI about what is degraded.

**Non-goals.** Features that *are* the backend stay unavailable and must say so
plainly rather than fail: custodial account sign-in and switching, the custodial
↔ self-custodial migration and transfer, KYC / account level, Circles, Earn,
Card, buy/sell, bulletins, support chat, push-notification registration, and
resolving a bare Blink username that the device has never seen.

## What "backend down" means

Four distinct conditions, which the app currently cannot tell apart:

| Condition | What the client sees |
|-----------|----------------------|
| Host unreachable / DNS fails | `Network request failed` |
| TCP connects, 5xx | `statusCode >= 500` |
| Reachable but slow | Nothing until the `RetryLink` budget is spent (~25–45 s) |
| Partially up (GraphQL ok, LNURL server down) | Per-endpoint failures |

The LNURL server is a **separate service** from the GraphQL API. It is addressed
by `lnurlServerUrlFor(network)` in
[app/self-custodial/config.ts](../app/self-custodial/config.ts) — `blink.sv` on
mainnet, `staging.blink.sv` otherwise. It is never the local dev stack, so
stopping a local backend does not exercise the LNURL paths (see
[Verification](#verification-with-the-backend-off)).

## Current touchpoint inventory

Verified by reading the call sites on `claude/self-custodial-offline-plan-c72165`
at 01fc4e5c2.

### Hard blockers — the wallet is unusable

| # | Touchpoint | Where | Effect with the backend down |
|---|-----------|-------|------------------------------|
| 1 | `realtimePriceUnauthed` | [use-price-conversion.ts:41](../app/hooks/use-price-conversion.ts) | `convertMoneyAmount` is `undefined`. Everything below follows from this. |
| 2 | Balance header | [use-total-balance.ts:46](../app/components/balance-header/use-total-balance.ts) | `isLoading = !convertMoneyAmount` — the home balance is a skeleton forever. |
| 3 | Receive screen | [receive-screen.tsx:74](../app/screens/receive-bitcoin-screen/receive-screen.tsx) | `if (!convertMoneyAmount) return <LoadingView />` — a permanent spinner. No invoice can be produced. |
| 4 | Send amount entry | [send-bitcoin-details-screen.tsx:222](../app/screens/send-bitcoin-screen/send-bitcoin-details-screen.tsx) | `paymentDetail` is never built, so the details screen never becomes interactive. |
| 5 | Apollo cache is not restored | [client.tsx:267-271](../app/graphql/client.tsx) | `persistor.restore()` runs only `if (token)`. A self-custodial-only user starts every launch with an empty cache, so there is not even a stale price to fall back on. |

Points 2–4 are all consequences of point 1. **Fixing the price source fixes the
wallet.**

### Degraded — usable but wrong or noisy

| # | Touchpoint | Where | Effect |
|---|-----------|-------|--------|
| 6 | `currencyList` | [display-currency-screen.tsx:35](../app/screens/settings-screen/display-currency-screen.tsx), [use-display-currency-from-region.ts:37](../app/self-custodial/hooks/use-display-currency-from-region.ts) | Empty currency picker; a fresh account never gets its region's currency and is stuck on USD. |
| 7 | Network-error toasts | [network-error-component.tsx:175](../app/graphql/network-error-component.tsx) | Every failed background query raises a toast. A self-custodial user gets repeated "connection" toasts for queries they never asked for. |
| 8 | `homeUnauthed` in scan context | [use-scan-context.ts:25](../app/hooks/use-scan-context.ts) | Runs unskipped even in self-custodial mode, where the result is discarded — pure wasted request and one more toast. |
| 9 | `mobileUpdate` | [app-update.tsx:47](../app/components/app-update/app-update.tsx) | `no-cache`, unskipped, on every home mount. Harmless result, another toast. |
| 10 | `realtimePrice` (authed) | [send-bitcoin-destination-screen.tsx:195](../app/screens/send-bitcoin-screen/send-bitcoin-destination-screen.tsx) | Skipped on `!isAuthed` but not on `isSelfCustodial`, so a mixed-account user fires it while on the self-custodial account. |
| 11 | Username resolution | [resolve-destination.ts](../app/screens/send-bitcoin-screen/payment-destination/resolve-destination.ts), [resolve-username.ts](../app/screens/send-bitcoin-screen/payment-destination/resolve-username.ts) | `accountDefaultWallet` failing is indistinguishable from "no such user", so a typed Blink handle reports `UsernameDoesNotExist`. |
| 12 | LNURL-server mode sync | [use-account-mode-sync.ts](../app/self-custodial/hooks/use-account-mode-sync.ts) | Already tolerant (logs, retries next launch), but there is no in-session retry, so an Enhanced push made while offline is deferred a whole launch. |
| 13 | Lightning-address registration | [use-register-lightning-address.ts](../app/self-custodial/hooks/use-register-lightning-address.ts) | Server unreachable collapses into `SetUsernameError.UNKNOWN_ERROR`, same as a real validation failure. |
| 14 | Backend-only tabs | [backend-feature-gate.tsx](../app/components/backend-feature-gate/backend-feature-gate.tsx) | Gates on account type and auth, not on reachability. An authed mixed-account user sees Circles/Earn/Card try and fail rather than explain. |

### Already independent — confirm, do not change

These need no work; they are listed so the plan's test matrix covers them and so
nobody "fixes" them later.

- Wallet creation and restore — [use-provision-self-custodial-account.ts](../app/self-custodial/hooks/use-provision-self-custodial-account.ts), mnemonic in `react-native-keychain`, SDK storage under `storageDirFor()`.
- Balances, transaction history, CSV export — SDK-local ([providers/wallet-snapshot.ts](../app/self-custodial/providers/wallet-snapshot.ts), [mappers/transaction-csv.ts](../app/self-custodial/mappers/transaction-csv.ts)).
- Contacts — derived from local SDK payment history ([use-self-custodial-contacts.ts](../app/self-custodial/hooks/use-self-custodial-contacts.ts)).
- Fee quotes and tiers — [use-onchain-fee-tiers.ts](../app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers.ts) calls `prepareSend` on the SDK.
- BTC↔USDB conversion — [bridge/convert.ts](../app/self-custodial/bridge/convert.ts).
- Online/offline status and the payment gate — [providers/is-online.ts](../app/self-custodial/providers/is-online.ts) reads Spark's own service status, not Blink's.
- Self-custodial region gating — Firebase Remote Config country lists plus a third-party IP lookup ([ip-country-lookup.ts](../app/utils/ip-country-lookup.ts)); `custodialRestrictions` is skipped for self-custodial ([restrictions.tsx:181-190](../app/custodial/providers/restrictions.tsx)).
- Feature flags — Firebase Remote Config ([feature-flags-context.tsx](../app/config/feature-flags-context.tsx)).
- Display-currency *preference* — persistent state ([self-custodial-display-currency.ts](../app/store/persistent-state/self-custodial-display-currency.ts)).
- Parsing invoices, on-chain addresses, Spark addresses, and LNURL against a
  third-party domain.

## Design principles

1. **Prefer a local source over a cached one.** The Breez SDK already ships fiat
   rates and a currency list; use them rather than caching Blink's.
2. **Prefer a cached one over nothing.** Where only Blink can answer, persist the
   last good answer with a timestamp and label it.
3. **One place decides reachability.** Consumers ask a provider, not each query.
4. **Never silently substitute.** A stale rate is marked stale wherever money is
   shown against it.
5. **Never widen an existing privacy boundary.** The Apollo-cache restore skip at
   [client.tsx:268](../app/graphql/client.tsx) exists so a persisted custodial
   cache cannot leak into a self-custodial session. Keep it; put what
   self-custodial needs in `persistentState` instead.
6. **Custodial behaviour is unchanged.** Every branch added here is behind
   `activeAccount?.type === AccountType.SelfCustodial`.

## The key enabler: Breez ships fiat data

`@breeztech/breez-sdk-spark-react-native@0.22.0` exposes two methods on the
connected SDK, verified in the shipped bindings at
`src/generated/breez_sdk_spark.ts`:

```ts
sdk.listFiatRates()      // => { rates: Array<{ coin: string; value: number }> }
sdk.listFiatCurrencies() // => { currencies: Array<FiatCurrency> }
```

```ts
type FiatCurrency = { id: string; info: CurrencyInfo }
type CurrencyInfo = {
  name: string
  fractionSize: number
  spacing: number | undefined
  symbol: Symbol | undefined
  uniqSymbol: Symbol | undefined
  localizedName: Array<LocalizedName>
  localeOverrides: Array<LocaleOverrides>
}
```

This covers everything the app's `Currency` type needs (`id`, `name`, `symbol`,
`fractionDigits` ← `fractionSize`) except `flag`, which is derivable.

Both open questions about this feed are now answered, from the shipped
`libbreez_sdk_spark_bindings.so` rather than from the bindings' own prose:

- **`Rate.value` is the price of one whole BTC denominated in `coin`.** The
  bindings only call it "denominator in an exchange rate". The direction is
  settled by the SDK's own cross-chain code, which looks `"USD"` up in this feed
  and fails with `Cross-chain: BTC/USD rate not found in feed` — so the entry
  keyed `USD` *is* the BTC/USD rate.
- **The SDK caches in memory only.** `breez_sdk_spark::cross_chain::cached_fiat`
  holds a `HashMap<&str, CachedEntry>` behind `get_or_fetch`, with a `now_ms`
  TTL. It answers offline within a session, but the map is rebuilt empty on every
  process launch, so a cold start has nothing. The app must persist what it
  reads; that layer is load-bearing, not belt-and-braces.

## Phases

The phases are ordered by user impact. Phase 2 alone converts "unusable" into
"usable"; everything after it is polish and honesty.

---

### Phase 1 — Reproducibility · done

*Small. Prerequisite for trusting any later phase.*

Shipped as [app/config/simulated-outage.ts](../app/config/simulated-outage.ts):
a developer-only store with an independent switch per service (GraphQL API,
LNURL server), each in one of three modes — `Off`, `Refused` (loopback port 1,
so the socket is refused at once) and `Unreachable` (RFC 5737 TEST-NET-1, so
requests hang until their own timeout). Those are the first three rows of
[What "backend down" means](#what-backend-down-means); the fourth, partial
availability, is the two switches set differently.

It rewrites the addresses the client dials rather than stubbing failures, so the
real transport, its retry budget and every consumer in between are exercised.

- `useAppConfig` applies the GraphQL switch to `graphqlUri`/`graphqlWsUri`, which
  rebuilds the Apollo client on the spot.
- `lnurlServerUrlFor` applies the LNURL switch for the app's own signed requests.
- A new `sdkLnurlDomainFor` applies it to `config.lnurlDomain` at SDK connect.
  Deliberately *not* `lnurlDomainsFor`: that decides whether a scanned code names
  an account we issued, and black-holing it would change parsing rather than
  connectivity.
- `hydrateSimulatedOutage()` runs at module scope in `app.tsx`, before the Apollo
  client exists, so a reload reproduces a cold start with the backend already
  down — the case at inventory row 5.
- Hard-gated to `__DEV__`: a release build reads "no outage" whatever is stored
  and refuses to write.

The scoped-failure-logging item originally planned here moved into the phases
that touch those call sites, rather than churning them twice.

**Done when** the switches produce the exact symptoms in the inventory table.

---

### Phase 2 — Price independence · done *(the blocker)*

*The only phase that changes whether the wallet works at all.*

- **Bridge** — [app/self-custodial/bridge/fiat.ts](../app/self-custodial/bridge/fiat.ts):
  `listFiatRates` and `listFiatCurrencies`, each behind a 10 s abort.
- **Mapping** — [app/self-custodial/price/rate-mapping.ts](../app/self-custodial/price/rate-mapping.ts),
  pure. Turns the feed into the two ratios the conversion layer works in:
  `displayCurrencyPerSat = rate(display) / 100_000_000` and
  `displayCurrencyPerCent = rate(display) / rate("USD") / 100`. A display
  currency of USD short-circuits to an exact hundredth rather than dividing a
  rate by itself. A missing, zero, negative or non-finite rate yields
  `undefined`, never a number: an amount derived from a missing rate would read
  as free. `toPriceRatesFromRealtimePrice` brings the backend's price into the
  same shape, so one comparison picks between the two sources.
- **Persistence** — [self-custodial-fiat-rates.ts](../app/store/persistent-state/self-custodial-fiat-rates.ts),
  schema 22. Device-wide, not per account: a rate belongs to the world. It lives
  in `persistentState` rather than the Apollo cache precisely because that
  cache's restore is skipped without a token, which is the privacy boundary
  principle 5 protects.
- **Provider** — [fiat-rates.tsx](../app/self-custodial/providers/fiat-rates.tsx).
  Hydrates from persistent state on the first render, so a cold start has a rate
  before any fetch settles; refreshes on SDK connect, on foreground and every
  5 min; one request in flight at a time. A failed refresh is silent and leaves
  the stored feed standing — the freshness the consumer reads already says how
  old it is, and an empty result never overwrites a good feed.
- **Conversion** — [use-price-conversion.ts](../app/hooks/use-price-conversion.ts).
  For a self-custodial account: SDK feed first, backend second, and the backend
  query is skipped entirely once the SDK has answered — so a self-custodial
  session makes no price request of its own. It still asks when the feed cannot
  price the display currency, which is the feed's own gap rather than an outage.
  The hook now also returns `priceFreshness`.

Staleness thresholds: fresh under 1 h, usable-but-marked under 24 h, withheld
beyond that. A feed timestamped in the future (clock correction, a user setting
the date back) reads fresh rather than expired — blanking a figure the app just
fetched is the worse failure.

### Phase 2b — Saying so on screen · done

`usePriceConversion` now also returns `priceStatus`: `Ready`, `Pending` (none
yet, a source may still answer) or `Unavailable` (none, and none is coming).
Only a self-custodial session can reach `Unavailable`, because it is the only
one whose price source can be known to have finished empty — the fiat provider
reports `hasSettled`. A custodial session keeps today's behaviour, where no
price means the screen is still loading.

- **Balance header, no rate at all.** `useTotalBalance` shows the Bitcoin
  balance in sats instead of a skeleton. The balance is read from the SDK's own
  storage and is not in doubt; only its price is. A held USD balance is left out
  of that figure rather than completed with a rate we do not have.
- **Balance header, old rate.** A `Stale` rate adds one line under the figure:
  "Exchange rate may be out of date". It never withholds the number — an old
  rate is a caveat on it, not a reason to hide it — and it is suppressed while
  the balance is hidden or still loading, and when the figure is in sats, which
  needs no rate.

**Deliberately not done: a sats-only receive and send flow.** The original plan
called for one, on the reading that inventory rows 3 and 4 spin forever without
a rate. Looking again at the routing, that case is almost unreachable:

- Every receive, send, conversion and deposit route is wrapped in `OfflineGate`
  ([root-navigator.tsx:229-262](../app/navigation/root-navigator.tsx)), which
  shows the offline notice whenever the Spark status is `Offline`, `Error` or
  `Unavailable`.
- The SDK's fiat feed is served by Breez's own gRPC service, not by Blink. If
  Spark is reachable enough to open the receive screen, that feed is reachable
  too; if it is not, `OfflineGate` has already taken over.
- A feed older than 24 h implies 24 h without Spark, which is the same gate.

So the residual gap is a wallet that connected to Spark but cannot reach the
fiat feed — narrow enough that rebuilding the receive request state to be
fiat-optional is not worth the risk it would carry. **Home is the exception**,
since it sits outside `OfflineGate`, and that is exactly the case the sats
fallback above covers.

If this is revisited, the work is in
[use-payment-request.ts:566](../app/self-custodial/hooks/use-payment-request.ts),
which returns null without a converter, and in the receive components that take
`convertMoneyAmount` as a required prop.

### Phase 3 — Currency list independence

1. New `app/hooks/use-currency-list.ts` returning the app's `Currency[]`,
   sourced from `listFiatCurrencies` for self-custodial and from
   `useCurrencyListQuery` for custodial.
2. `flag` derivation: ISO-4217 code → ISO-3166 alpha-2 prefix → regional-indicator
   emoji, with an explicit override table for the codes that are not country
   prefixed (`EUR`, `XAF`, `XOF`, `XCD`, `XPF`, `XDR`). Fall back to no flag
   rather than a wrong one.
3. Repoint [display-currency-screen.tsx:35](../app/screens/settings-screen/display-currency-screen.tsx)
   and [use-display-currency-from-region.ts:37](../app/self-custodial/hooks/use-display-currency-from-region.ts)
   at the new hook. The comment in the latter about "a launch that never reaches
   the currency list writes nothing" can then be narrowed to the custodial case.
4. Persist the list alongside the rates so the picker works on a cold start
   before the SDK connects.

**Done when** the display-currency picker lists currencies and a freshly restored
wallet picks up its region's currency, with both Phase 1 toggles on.

---

### Phase 4 — Backend health awareness and noise suppression

1. **`BlinkServicesStatusProvider`** — new `app/graphql/backend-status.tsx`.
   Model it on the verdict machine already in
   [restrictions.tsx](../app/custodial/providers/restrictions.tsx): a tri-state
   (`Reachable | Unreachable | Unknown`), fed by the existing `errorLink`
   observations, with `useBackoffRetry` for the fast lane and a one-per-minute
   slow lane while `Unreachable`, suppressed while the app is backgrounded. Do
   **not** add a NetInfo dependency — the app has none today, and reachability of
   *Blink* is the question, not of the internet.
2. **Toast suppression.** In
   [network-error-component.tsx](../app/graphql/network-error-component.tsx),
   suppress the `errors.network.connection` and `errors.network.server` toasts
   while the active account is self-custodial and the failing operation was not
   user-initiated. Replace the repetition with one persistent, dismissible home
   banner: "Some Blink features are unavailable. Your wallet still works."
   - New i18n keys under a `SelfCustodialBackendDown` namespace. Remember all 28
     locale JSONs need the key or the locale-parity test fails.
3. **Skip audit.** Add `skip: isSelfCustodial` to inventory rows 8, 9 and 10.
4. **Extend `BackendFeatureGate`** with a third state driven by the new provider:
   "Blink services are temporarily unreachable", distinct from "sign in" and
   "needs a custodial account". Keeps the tabs visible per NFR-FR83–85.
5. **Settings.** Rows that can only be answered by the backend (account level,
   KYC, transaction limits, buy/sell, support) render a disabled state with the
   reason rather than an error.

**Done when** a self-custodial session with the backend down raises at most one
banner and no repeated toasts, and every backend-only surface explains itself.

---

### Phase 5 — LNURL server degradation

Scope decision required (see [Open questions](#open-questions)): whether "backend
down" includes the LNURL server. Assuming yes:

1. **Receive without the server.** The receive screen must offer BOLT11, on-chain,
   and Spark unconditionally — all three are SDK-local. Only the Lightning-address
   tab depends on the server.
2. **Address from storage.** Read the account's known address from
   [storage/account-index.ts](../app/self-custodial/storage/account-index.ts)
   rather than re-resolving through `getLightningAddress(sdk)` on every mount, and
   show it with a "cannot verify right now" note when the server is unreachable.
   The address keeps working for payers as soon as the server returns; nothing
   about it is device state.
3. **Registration errors.** Add `SetUsernameError.SERVER_UNREACHABLE` to
   [username-validation.ts](../app/components/set-lightning-address-modal/username-validation.ts)
   and classify it in
   [use-register-lightning-address.ts](../app/self-custodial/hooks/use-register-lightning-address.ts),
   with copy that says to try again rather than implying the name is taken.
4. **Mode-sync retry.** Give
   [use-account-mode-sync.ts](../app/self-custodial/hooks/use-account-mode-sync.ts)
   a bounded in-session retry on foreground, so an Enhanced push that failed
   offline lands as soon as connectivity returns instead of waiting a launch.
   Keep the existing "record what landed" discipline — each Enhanced push costs
   the server a paid country lookup.

---

### Phase 6 — Send destination resolution

1. In [resolve-username.ts](../app/screens/send-bitcoin-screen/payment-destination/resolve-username.ts),
   distinguish a *network failure* on `accountDefaultWallet` from a genuine
   "no such account". On a network failure, fall straight through to the
   Lightning-address/LNURL path instead of reporting `UsernameDoesNotExist`.
2. If the LNURL fetch also fails, surface a new invalid reason
   (`DestinationUnverifiable`) with copy that says the name could not be checked
   right now — never that it does not exist. Misreporting a real payee as
   nonexistent is the worst outcome in this whole plan.
3. Document in the same file that invoices, on-chain addresses, Spark addresses,
   and LNURL against third-party domains resolve without any Blink service, so a
   scanned QR always works.

---

### Phase 7 — Tests and release gate

**Unit** (`__tests__/self-custodial/`):
- Rate mapping: sat and cent derivation, missing display currency, missing USD
  anchor, zero and absurd rates.
- Staleness thresholds and the three-tier fallback order in `usePriceConversion`.
- Currency mapping including the flag override table.
- The status provider's state machine, including backoff bounds and the
  background suppression.
- Error classification for registration and destination resolution.

**RNTL** (with Apollo mocks erroring and the SDK mocked):
- Home renders a balance from persisted rates on a cold start.
- Receive renders an invoice, not `receive-loading`.
- Send details builds a payment detail and accepts a sats amount.
- Display-currency picker is populated.
- Exactly one banner, no toast storm.

Per the repo's testing notes: RNTL negative assertions need a positive anchor —
`waitFor` + `not.toHaveBeenCalled` is vacuous, and a missing Apollo mock looks
identical to correct offline behaviour. Mutation-test every guard added here.

**Release gate.** Add a "Blink services unavailable" section to
[self-custodial-rollout.md](./self-custodial-rollout.md) covering the matrix
below, for each of self-custodial-only and mixed-account users.

---

## Verification with the backend off

Yes — switching off the local stack is worth doing, and it is the only way to
confirm some of this. Two caveats about what it does and does not cover:

- **It does not test the LNURL server.** The Local instance maps to regtest
  ([config.ts](../app/self-custodial/config.ts)), and `lnurlDomainFor(Regtest)`
  is `staging.blink.sv` — a hosted service. Lightning-address registration,
  recovery, and mode sync will keep working with the local stack down. Testing
  those needs the Phase 1 override or a hosts-file block.
- **It does not test the cold-start path by itself.** The failure at inventory
  row 5 only shows up on a *fresh launch* with the backend already down. Kill the
  app before each run.

What I would like confirmed on-device, with the local backend stopped:

| # | Assumption | How to check |
|---|-----------|--------------|
| A1 | Home balance never resolves | Cold start on a funded self-custodial account; the balance stays a skeleton |
| A2 | Receive is a permanent spinner | Open Receive; expect `receive-loading` to persist |
| A3 | Send amount entry never activates | Scan or paste an invoice, reach Details |
| A4 | Toast storm | Count the connection toasts in the first 60 s on Home |
| A5 | Everything SDK-local still works | Transaction list, CSV export, contacts, fee quotes, BTC↔USDB convert |
| A6 | Boot is not blocked | The app reaches Home at all (the Apollo provider does not await the network — worth confirming empirically) |
| A7 | ~~`sdk.listFiatRates()` units~~ | Answered from the binary: `value` is the BTC price in `coin`. |
| A8 | ~~`sdk.listFiatRates()` offline behaviour~~ | Answered from the binary: an in-memory TTL cache, empty after a process launch. |
| A9 | Phase 2 actually holds on a device | Both switches on, kill and relaunch: the balance, receive and send-amount screens all work off the persisted feed. |

A7 and A8 were the two answers that could have changed the shape of the plan
rather than its details, and both are now settled from
`libbreez_sdk_spark_bindings.so`. A9 replaces them as the thing worth checking
on hardware. Everything else above is a confirmation of static reading, not a
dependency.

## Open questions

1. **Scope of "down".** Does this work cover the LNURL server, or only the
   GraphQL API? Phase 5 assumes yes.
2. ~~**Rate provenance.**~~ Settled in Phase 2: the SDK wins for a
   self-custodial account whenever it can price the display currency. Both quote
   the same market, and preferring the source that survives an outage keeps an
   amount on screen from changing meaning as services come and go. A custodial
   session is untouched.
3. **Stale-rate ceiling.** Phase 2 picked 24 h, on the reasoning that the people
   most likely to be offline for long would rather see yesterday's number than a
   blank. Confirm before release — a user checking net worth may disagree.
4. **Banner persistence.** Dismissible for the session, or sticky until services
   return?
5. **Mixed-account users.** When the backend is down and the active account is
   custodial, should the app offer to switch to a self-custodial account on the
   device rather than showing a dead session?

## Sequencing summary

| Phase | Outcome | Depends on | Status |
|-------|---------|-----------|--------|
| 1 | Outage reproducible on demand | — | Done |
| 2 | **Wallet is usable offline** | 1 | Done |
| 2b | Staleness marker and home sats fallback | 2 | Done |
| 3 | Currency selection works offline | 2 | |
| 4 | Honest, quiet UI | 1 | |
| 5 | Lightning address degrades gracefully | 1, Q1 | |
| 6 | Send never misreports a payee | 4 | |
| 7 | Regression-proofed | 2–6 | |

Phases 4 and 5 are independent of 2 and 3 and can run in parallel. Phase 2 is the
one that must land first if only one does.
