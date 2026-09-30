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
| 6 | `currencyList` | [display-currency-screen.tsx:35](../app/screens/settings-screen/display-currency-screen.tsx), [use-display-currency-from-region.ts:37](../app/self-custodial/hooks/use-display-currency-from-region.ts), and `useDisplayCurrency`'s formatting dictionary | Empty currency picker; a fresh account never gets its region's currency; **and every amount renders with the US dollar defaults**, so a naira balance shows a dollar sign. |
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
7. **Shared code must not depend on one adapter.** Anything under `app/hooks/`,
   `app/components/` or a screen both account types reach may depend on a port
   in `app/types/`, never on `app/self-custodial/` or `app/custodial/`. Added
   after the fact: phases 1–7 broke this in four places, which is what
   [Phase 8](#phase-8--put-the-shared-types-where-they-belong) repairs. Stating
   it here so the next addition does not have to rediscover it.

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

**Superseded: the sats-only receive and send flow.** This phase originally
argued that one was not worth building, on the reading that `OfflineGate` covers
every route that could spin without a rate. That argument does not hold, and
[Phase 11](#phase-11--sats-only-when-nothing-can-price) replaces it. What was
wrong with it is recorded there rather than edited out of here.

### Phase 3 — Currency list independence · done

The currency list is not only the settings picker. `useDisplayCurrency` builds
its symbol-and-fraction-size dictionary from the same list, so with the backend
down a naira balance rendered with a dollar sign and two forced decimals. That
was the larger half of this phase.

- **Mapping** — [currency-mapping.ts](../app/self-custodial/price/currency-mapping.ts).
  `FiatCurrency.info` gives name, `fractionSize` and a symbol grapheme; the flag
  is derived, since ISO 4217 is the ISO 3166 country code plus a unit letter.
  Checked against the backend's own `currencyList`, which answers `USD → 🇺🇸`,
  `EUR → 🇪🇺`, `PKR → 🇵🇰`. The X-codes (`XAF`, `XOF`, `XCD`, `XPF`, `XDR`,
  `XAU`, `XTS`) get no flag rather than a wrong one — `X` is not a country, the
  row reads fine without one, and 🇽🇦 beside the Central African franc would be
  a fabrication.
- **Persistence** — [self-custodial-fiat-currencies.ts](../app/store/persistent-state/self-custodial-fiat-currencies.ts),
  schema 23, beside the rates and for the same reason. No freshness rule: a
  symbol and a fraction size do not move the way a price does.
- **Provider** — the fiat provider now fetches both in one pass, with
  `Promise.allSettled` rather than all-or-nothing. The rates are what the
  balance needs; losing them because the currency list failed would be the
  worse trade.
- **One adapter** — [use-currency-list.ts](../app/hooks/use-currency-list.ts)
  picks the source: the SDK for a self-custodial account that has a list, the
  backend otherwise and for custodial always. It reports `isUnavailable` so the
  picker can say so instead of spinning, which only a self-custodial session can
  reach.
- **Consumers repointed**: `useDisplayCurrency` (the formatting dictionary),
  `display-currency-screen`, and `use-display-currency-from-region`.

The region hook's old `skip` on the query is gone — the adapter owns that now,
and `useDisplayCurrency` was fetching the list unconditionally anyway, so the
skip saved nothing Apollo's cache was not already saving.

### Phase 4 — Backend health awareness and noise suppression · done

- **`BlinkServicesStatus`** — [blink-services-status.ts](../app/graphql/blink-services-status.ts).
  `Reachable | Unreachable | Unknown`, observed from the traffic the app already
  makes rather than from a probe. The app fires several queries in the first
  second of any screen, so an outage is evident without adding requests to a
  service that is, by hypothesis, already struggling — which is why the backed-off
  prober the plan originally called for is not here. A response is recorded in
  `createServerTimeLink`, the one place every successful response passes through;
  a transport failure in the existing `errorLink`. Two consecutive failures make
  it `Unreachable`, since the `RetryLink` already makes five attempts per
  operation before reporting one. A 4xx counts as reached: an expired token is
  the server answering, and reporting Blink down for a session that merely needs
  renewing would be wrong on every screen. Reset when the Apollo client is
  rebuilt, because that is a different connection.
- **No toast storm.** A self-custodial session raises no transport toast. Every
  query still reaching the backend from such a session is one the user did not
  ask for, so a toast per failure is a stream of alarms about nothing they can
  act on while their wallet goes on working. Only the two generic transport
  toasts are suppressed: an authentication failure still routes to
  `handleTokenExpiry`, and a request the user actually made reports its own
  failure at the screen that made it.
- **Skip audit** — inventory rows 8, 9 and 10: `homeUnauthed` and
  `scanningQrCodeScreen` in the scan context, `mobileUpdate` on the home mount
  (the minimum supported build is a property of a backend this account does not
  talk to), and the authed `realtimePrice` on the send-destination screen, which
  a mixed-account user was firing from their self-custodial account.
- **`BackendFeatureGate`** gains the unreachable state, so Circles, Learn and
  Card explain the outage instead of trying and failing. Only for a session
  otherwise entitled to the feature: a user with no custodial account is told
  that first, because it is the durable reason and stays true when the servers
  come back.

**Not done: the home banner.** The plan called for one persistent, dismissible
banner to replace the suppressed toasts. On reflection a self-custodial session
has nothing to tell the user — every failing request is one they did not make,
and everything they can do still works — so a banner would be the noise it was
meant to replace. The places where an explanation is genuinely owed are the
backend-only tabs, and those now carry it. Revisit if the mixed-account case
turns out to need a signal on home.

**Not done: disabling backend-only settings rows.** Account level, KYC,
transaction limits, buy/sell and support still render and fail on tap. They are
a smaller surface than the tabs and each needs its own copy; worth a pass of its
own rather than a rushed one here.

### Phase 5 — LNURL server degradation · done

Scope decision: yes, "backend down" includes the LNURL server. It is a separate
deployment, and the switches in Phase 1 can take it down on its own.

- **Receive already survives it.** BOLT11, on-chain and Spark are SDK-local, and
  `canUsePaycode` in `use-payment-request` already turns only on whether an
  address is known. Nothing to change; recorded here so the test matrix covers
  it and nobody "fixes" it later.
- **The address survives it too.** The wallet provider now seeds
  `lightningAddress` from what this device recorded before asking the SDK. An
  address is a name the LNURL server answers for, not device state: it keeps
  working for whoever pays it whether or not this device can currently ask. A
  question that could not be asked is not an answer that the account has none,
  so a failed resolve leaves the seed standing. The SDK's answer still wins when
  it arrives, so a name changed on another device is honoured.
- **Registration says which failure it was.** New
  `SetUsernameError.SERVER_UNREACHABLE`, classified off `classifySdkError`.
  Collapsing it into `UNKNOWN_ERROR` told the user to try again later with no
  hint that their chosen address is still free — the one thing they want to know
  before going off to pick another.
- **Mode sync retries on foreground**, not only on the next launch, so a user
  who regains signal mid-session gets their Lightning Address back without
  restarting. Foreground only, never a timer: each Enhanced push costs the
  server a paid country lookup.

### Phase 6 — Send destination resolution · done

The highest-stakes item in the plan. Telling a sender that a real payee does not
exist is the worst thing the send screen can do: it sends them to correct a
spelling that was right, or to abandon a payment that would have gone through.

`accountDefaultWallet` failing at the transport resolves with no data and an
error, which was indistinguishable from an answer of "no such user".
`getUserWalletId` now returns `Found | NotFound | Unverifiable`, reading the
error rather than only the data, and treating a thrown lookup the same way —
whatever went wrong, nothing was learned about the name. A found wallet still
wins over an error alongside it, since a partial response that carries the id is
an answer.

`Unverifiable` becomes a new `InvalidDestinationReason.DestinationUnverifiable`
with its own copy: "We couldn't check {address} right now", advising that the
address may well be fine. `resolveUsername` retries over LNURL on it, as it does
for a genuinely absent username, because that route runs against a different
host.

This also fixed a pre-existing bug one level up. A Blink LNURL whose account
lookup failed used to fall through to `LnurlUnsupported` — marking a perfectly
payable code as one Blink can never pay, because our own backend had a bad
moment. It now falls back to paying over LNURL, which is what a self-custodial
sender does anyway. The test that pinned the old behaviour is updated with the
reasoning.

Invoices, on-chain addresses, Spark addresses and LNURL against third-party
domains never touched a Blink service and are unchanged, so a scanned QR always
works.

### Phase 7 — Tests and release gate · done

Unit and component coverage landed with each phase rather than in a pass at the
end; every guard added was mutation-tested, since a guard whose removal keeps
the suite green is not covered.

The one seam that needed a test of its own is the provider-to-hook wiring under
the exact conditions this work exists for:
[cold-start-offline.spec.tsx](../__tests__/self-custodial/price/cold-start-offline.spec.tsx)
mounts the real fiat provider around the real `usePriceConversion`, with every
backend query dead *and* the SDK's fiat feed rejecting, and asserts that a
balance still converts off the persisted feed — that a failed refresh does not
blank it, that a two-hour-old feed converts but reads stale, and that a feed
older than a day reports `Unavailable` rather than spinning.

A "Blink services unavailable" section is added to
[self-custodial-rollout.md](./self-custodial-rollout.md), covering both switches
in both modes, cold start, the send-resolution case, Lightning Address, recovery
within a session, and the custodial regression.

---

### Phase 11 — Sats-only when nothing can price

*Reopens what Phase 2b closed. The reasoning that closed it was wrong twice.*

**Why the earlier argument failed.** Phase 2b concluded that a wallet reaching
the receive or send screen could always be priced, because those routes sit
behind `OfflineGate` and the Breez fiat feed "rides on Breez's own gRPC, so if
Spark is up the feed is reachable". Two holes:

1. **They are different providers.** `strings` on the shipped
   `libbreez_sdk_spark_bindings.so` shows the Spark operators at
   `0.spark.lightspark.com`, `2.spark.flashnet.xyz` and `api.lightspark.com`,
   while the rates gRPC and datasync are at `bs1.breez.technology` and
   `nd1.breez.technology`. A regional block, a DNS failure or a Breez-side
   outage can take the feed down with Spark perfectly healthy, and nothing
   gates on that.
2. **A currency the feed does not carry needs no outage at all.**
   `listFiatRates` covers "fiat currencies for which there is a known exchange
   rate" — a bounded list. `toPriceRates` returns undefined for anything outside
   it, the backend is the only fallback, and if the backend is also down the
   user has a healthy Spark wallet, a passing `OfflineGate`, and
   `receive-screen.tsx:74` spinning on `!convertMoneyAmount` forever.

The second is the sharper one: it is reachable on a good connection.

**The rule.** When nothing can price, show every amount in the unit its own
wallet is denominated in — sats for Bitcoin, dollars for USDB — and drop the
converted line rather than inventing one. No rate is needed to state a balance
in its own unit, which is why this degrades cleanly instead of partially.

**Route taken: sats as the display currency, not a fiat-optional rewrite.**

The instinct is to make every screen tolerate a missing converter, threading an
optional one through the receive request state and the amount inputs. That is
correct and expensive, and it spreads "might be undefined" across the send and
receive flow, which is where the fund-loss watchpoints live.

Cheaper and safer: keep `convertMoneyAmount` total by making the display
currency *be* sats. Every screen keeps working unchanged, because the
conversion it asks for — Bitcoin to display — becomes the identity.

1. `usePriceConversion`, when `priceStatus === PriceStatus.Unavailable`, returns
   a sats-only converter instead of `undefined`:
   - Bitcoin ↔ display: identity, `currencyCode: "SAT"`.
   - Any currency to itself: identity, as today.
   - US dollars ↔ anything else: still unavailable. This is the honest gap and
     it is bounded — see below.
2. `useEffectiveDisplayCurrency` reports `"SAT"` in that mode, and
   `useDisplayCurrency` gains the matching dictionary entry
   (`symbol: ""`, `fractionDigits: 0`), which is the same shape
   `WalletCurrency.Btc` already carries in `currencyInfo`.
3. Remove the now-dead `!convertMoneyAmount` gates at
   [receive-screen.tsx:74](../app/screens/receive-bitcoin-screen/receive-screen.tsx)
   and [use-payment-request.ts:566](../app/self-custodial/hooks/use-payment-request.ts).
   They stop being reachable once the converter is total, and leaving them would
   hide a regression rather than catch one.
4. Say so on screen. One line, in the pattern the stale-rate notice already
   uses: amounts are in sats because no exchange rate is available. Without it
   a user whose balance silently changes denomination will read it as their
   money changing. One new string across 28 locales.

**The bounded gap.** A Stable Balance holder has a USDB balance, and expressing
it in sats needs the very rate that is missing. That row shows in dollars — its
own unit — with no sats equivalent, and the total is the Bitcoin balance alone,
exactly as `useTotalBalance` already does on the Unavailable branch. Understating
a total is safer than completing it with a rate we do not have. A self-custodial
account without Stable Balance has no USD leg at all, so for most users the
sats-only mode is complete rather than partial.

**Risk.** Lower than the rewrite, but not nil: `usePriceConversion` feeds every
screen showing an amount, and this adds a mode in which its converter means
something different. The guard is that the mode is reachable only from
`PriceStatus.Unavailable`, which a custodial session cannot enter, plus the
Phase 7 cold-start spec and the custodial regression in the release gate.

**Done when** with both outage switches on, a display currency the Breez feed
does not carry, and a cold start: home, receive and send all render in sats,
an invoice can be produced, a payment can be sent, and one line on screen says
why the amounts are not in the user's currency.

---

## Architecture follow-up: hexagonal adherence

Phases 1–7 were driven by what a user experiences during an outage, and the
shape of the code followed the shortest route to that. The result is sound in
the middle and loose at the edges: the pure mapping functions and the SDK bridge
sit where they should, but the seam between "which source answers" and "what the
app does with the answer" was written as a branch inside a shared hook rather
than as a port with two adapters.

That matters beyond tidiness. The repo already has the pattern — a port type in
`app/types/`, a `createCustodialX` / `createSelfCustodialX` pair under each
side's `adapters/`, and a shared hook that only selects between them
([use-scan-context.ts](../app/hooks/use-scan-context.ts) is the clearest
example, with `ScanContextAdapter` and `ContactAdapter` as the ports). Price and
currency now do the same job without the same shape, so a third price source —
a cached third-party feed, a merchant terminal's own rate — cannot be added
without editing the hook every screen depends on.

**What is already right, and should not be churned:**

- [bridge/fiat.ts](../app/self-custodial/bridge/fiat.ts) is a driven adapter and
  the only caller of `sdk.listFiatRates`.
- `rate-mapping.ts` and `currency-mapping.ts` are pure: no I/O, no React, no SDK
  handle. That is why they carry 47 tests with no mocks.
- Persistence is behind getter/wither pairs in `app/store/persistent-state/`.
- `PriceStatus` is exported from the hook that produces it, so
  `use-total-balance.ts` depends on the hook rather than on an adapter.

**Deliberate non-goal.** [blink-services-status.ts](../app/graphql/blink-services-status.ts)
stays a module-level store. It is written from inside Apollo links and read
through a hook, exactly like `server-time.ts` beside it, and it has one consumer
shape. Wrapping it in a context and a port would add indirection without
decoupling anything that varies. Hexagonal is a tool for the seams that have
more than one implementation, not a uniform coating.

---

### Phase 8 — Put the shared types where they belong · done

*Mechanical. No behaviour change, and the one the other two depend on.*

Today `app/hooks/` and two screens import domain types out of the
self-custodial module:

| Importer | Imports | From |
|----------|---------|------|
| [use-price-conversion.ts:12](../app/hooks/use-price-conversion.ts) | `RateFreshness`, `toPriceRates`, `toPriceRatesFromRealtimePrice`, `PriceRates` | `@app/self-custodial/price/rate-mapping` |
| [use-currency-list.ts:4](../app/hooks/use-currency-list.ts) | `DisplayCurrencyEntry` | `@app/self-custodial/price/currency-mapping` |
| [home-screen.tsx:31](../app/screens/home-screen/home-screen.tsx) | `RateFreshness` | same |
| [display-currency-screen.tsx:8](../app/screens/settings-screen/display-currency-screen.tsx) | `DisplayCurrencyEntry` | `@app/self-custodial/price/currency-mapping` |

The display-currency screen is shared with custodial users, so a custodial-only
session now carries a compile-time dependency on the self-custodial module. The
sharpest tell is `toPriceRatesFromRealtimePrice`: a function whose entire job is
to translate the *custodial backend's* `realtimePrice`, living in
`app/self-custodial/`.

1. New `app/types/price.ts`: `FiatRate`, `PriceRates`, `RateFreshness`,
   `RATES_FRESH_MS`, `RATES_USABLE_MS`, `rateFreshness`. These are statements
   about money and time, not about Breez.
2. New `app/types/currency.ts`: `DisplayCurrencyEntry`.
3. Leave behind, in the self-custodial module, only what translates *from Breez*:
   `toPriceRates`, `toDisplayCurrencyEntry`, `toDisplayCurrencyList`,
   `flagForCurrencyCode`.
4. Move `toPriceRatesFromRealtimePrice` to `app/custodial/adapters/price.ts`,
   where the thing it translates lives.
5. `StoredFiatRates` / `StoredFiatCurrencies` are persistence shapes: keep them
   in their `app/store/persistent-state/` modules, importing the domain types.

**Done when** `grep -rn "self-custodial" app/hooks app/screens/settings-screen/display-currency-screen.tsx app/screens/home-screen`
returns nothing about price or currency, and the suite is unchanged.

**Landed.** Both screens are clean; the suite is unchanged at 9,435. The specs
moved with the code they cover, which is the part worth noting: the freshness
rules are now `__tests__/types/price.spec.ts` and the `realtimePrice`
translation `__tests__/custodial/adapters/price.spec.ts`, so neither is filed
under a module that does not own it.

What remains in `app/hooks/` is two *function* imports — `toPriceRates` from the
self-custodial module and `toPriceRatesFromRealtimePrice` from the custodial one
— which is the branch [Phase 10](#phase-10--a-real-port-for-the-price-and-currency-sources)
replaces with selection. The types no longer leak, so the screens are already
off both adapters.

---

### Phase 9 — Make the config seam honest again · done

*Small, and a defect rather than a trade-off.*

`lnurlServerUrlFor(network)` was a pure function of its argument. Phase 1 made
it read `getSimulatedOutage()`, a global its signature does not declare, and
added `sdkLnurlDomainFor` with the same shape. Both are now untestable from
their inputs, and a reader cannot tell from the call site that a dev-only
switch can change the answer.

1. Take the override as a parameter: `lnurlServerUrlFor(network, outageHost?)`
   and `sdkLnurlDomainFor(network, outageHost?)`. Pure again.
2. Resolve it at the call sites, where the dependency is visible:
   - [use-account-mode-sync.ts:42](../app/self-custodial/hooks/use-account-mode-sync.ts)
     is a hook and can read `useSimulatedOutage()`.
   - `createSdkConfig` is not, so `initSdk` takes the domain in its params
     alongside `network` and `leewaySatPerVbyte`. Four callers
     ([use-sdk-lifecycle](../app/self-custodial/hooks/use-sdk-lifecycle.ts),
     [probe-account-wallets](../app/self-custodial/probe-account-wallets.ts),
     [migration-transfer-request](../app/self-custodial/migration-transfer-request.ts),
     and `lifecycle.ts` itself) each pass it.

That last point is the cost, and it is the point: three of those callers are not
React, so they must read the switch explicitly. Better a visible read at four
call sites than a hidden one inside a function that looks pure.

3. While there: the fiat provider calls `Date.now()` in five places
   ([fiat-rates.tsx](../app/self-custodial/providers/fiat-rates.tsx)), so
   freshness cannot be exercised without real wall-clock timestamps — the specs
   work around it by computing offsets from `Date.now()` themselves. Inject a
   `now: () => number` with the real clock as its default.

**Done when** nothing in `app/self-custodial/config.ts` imports
`simulated-outage`, and the freshness tests drive a fake clock.

**Landed**, with one change of shape from the sketch. Rather than an optional
`outageHost` argument on two functions, there is one pure
`resolveLnurlServer(network, outageHost)` returning both halves — the base URL
the app signs requests against and the domain the SDK connects with — and one
hook, [use-lnurl-server.ts](../app/self-custodial/hooks/use-lnurl-server.ts),
as the only place that reads the switch. Six callers now take the resolved
value: the mode sync, the SDK lifecycle, wallet restore, the account probe and
the two migration paths. Three of those are not React and receive it as an
argument, which was the cost and the point.

`probeSelfCustodialAccountWallets` became an options object on the way: the
fourth positional parameter tripped `max-params`, and the lint rule was right
that four positional arguments is where a call stops reading.

The provider takes `now?: () => number`, defaulted to the real clock. Two tests
drive a fixed one, so the freshness windows are crossed without waiting a day
and without the assertions drifting with the wall clock.

---

### Phase 10 — A real port for the price and currency sources · done

*The actual hexagonal fix, and the one with regression risk worth weighing.*

`usePriceConversion` currently gathers both sources and branches on
`isSelfCustodial` inline; `useCurrencyList` does the same. Neither declares what
a "price source" is, so the custodial path is not an implementation of anything
— it is the else-branch.

1. Declare the ports beside the types from Phase 8:

   ```ts
   // app/types/price.ts
   export type PriceSource = {
     rates: PriceRates | undefined
     freshness: RateFreshness
     /** Whether this source has finished trying, so a caller can tell
      *  "not yet" from "not coming". */
     hasSettled: boolean
   }

   // app/types/currency.ts
   export type CurrencyListSource = {
     currencies: readonly DisplayCurrencyEntry[]
     hasSettled: boolean
   }
   ```

2. Implement both sides, matching the `adapters/` convention:
   - `app/self-custodial/adapters/price.ts` — `createSelfCustodialPriceSource`,
     over the SDK feed and the persisted copy.
   - `app/custodial/adapters/price.ts` — `createCustodialPriceSource`, over
     `realtimePrice` / `realtimePriceUnauthed`, and the new home of
     `toPriceRatesFromRealtimePrice`.
   - The same pair for the currency list.

3. Reduce the hooks to selection, the way `use-scan-context.ts` already does:
   gather inputs, pick the adapter, derive `PriceStatus` from
   `rates` + `hasSettled`. The precedence rule the tests pin — SDK first for a
   self-custodial account, backend when it cannot price the display currency —
   becomes a property of the selection rather than of an `??` chain buried in
   the middle of a 220-line hook.

4. Retarget the tests. `use-price-conversion.spec.ts` currently mocks
   `@app/self-custodial/providers/fiat-rates` by module path, so it is coupled
   to where the implementation lives; with a port it passes a fake `PriceSource`
   and stops caring. That is the measurable payoff, not the diagram.

**Risk.** `usePriceConversion` is on every screen that shows an amount. Land it
behind a green full suite, and re-run the Phase 7 cold-start spec and the
custodial regression from the release gate before merging — the point of the
refactor is that neither should change.

**Done when** `app/types/price.ts` declares the port, both `adapters/`
directories implement it, neither hook mentions `isSelfCustodial` more than once,
and the price specs construct fakes rather than mocking module paths.

**Landed**, with one claim above corrected.

`PriceSource` and `CurrencyListSource` are declared in `app/types/`, alongside
`firstPricedSource` / `firstPopulatedCurrencyList` — the selection rule that was
a chain of `??` in the middle of the hook. Four adapters implement them:
`createSelfCustodialPriceSource`, `createCustodialPriceSource`,
`createSelfCustodialCurrencyList`, `createCustodialCurrencyList`. Both hooks now
build two sources and select, and adding a third is an extra argument to the
combinator rather than an edit downstream.

**The correction.** The plan said the price specs would "pass a fake
`PriceSource` and stop caring" about module paths. They do not, and could not:
`usePriceConversion` reaches its source through `useFiatRates`, a React context,
so a hook-level spec still has to mock that module. What actually improved is
better than a reworded claim:

- The logic left the hook. Selection, staleness and the denominator guard are
  now pure functions with specs that mock nothing at all —
  `__tests__/types/price-source.spec.ts`,
  `__tests__/self-custodial/adapters/price.spec.ts`,
  `__tests__/custodial/adapters/price-source.spec.ts`, 21 tests between them.
- The hook spec's fake is now typed against `SelfCustodialFeed`, a declared
  input, rather than against whatever the provider happened to return.

The remaining module mock is a property of `useFiatRates` being a context, not
of the port. Removing it would mean passing the source in as an argument, which
a hook consumed by screens cannot do — so it stays, deliberately.

**Two things the refactor turned up.** `probeSelfCustodialAccountWallets` had
grown a fourth positional parameter in Phase 9 and became an options object.
And five dependency arrays were missing the value Phase 9 threaded through them:
four gained it, and `use-sdk-lifecycle`'s effect did not — `lnurlDomain` is a
pure function of `network`, which is already in that array, so the only thing
that could move it alone is the developer switch, and tearing down a connected
wallet to apply a debug toggle is worse than the reload the control already asks
for. That one carries the reasoning and a scoped disable rather than a silent
omission.

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

1. ~~**Scope of "down".**~~ Settled: it covers the LNURL server, which Phase 1's
   switches can take down on its own.
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
| 3 | Currency selection works offline | 2 | Done |
| 4 | Honest, quiet UI | 1 | Done |
| 5 | Lightning address degrades gracefully | 1, Q1 | Done |
| 6 | Send never misreports a payee | 4 | Done |
| 7 | Regression-proofed | 2–6 | Done |
| 8 | Shared types out of the self-custodial module | — | Done |
| 9 | Config seam pure again, clock injected | — | Done |
| 10 | Price and currency behind a real port | 8 | Done |
| 11 | Sats-only when nothing can price | 2b | |

Phases 4 and 5 are independent of 2 and 3 and can run in parallel. Phase 2 is the
one that must land first if only one does.

Phase 11 reopens a decision Phase 2b got wrong and is the only outstanding
behaviour change. Phases 8–10 change no behaviour; they are the architecture
follow-up described above. 8 and 9 are mechanical and independent of each other. 10 depends on 8 and
is the only one carrying real regression risk, so it is worth deciding on
deliberately rather than treating as cleanup.
