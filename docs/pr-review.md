# PR Review Guide

A practical guide for reviewing pull requests in blink-mobile. It codifies the conventions
and review standards actually practiced in this repo (derived from the repo's tooling and
two months of review history, May–July 2026, PRs ~#3731–#3904 including the Spark
self-custodial stack). PR numbers are cited throughout as precedent — read the linked
reviews when in doubt about how a rule is applied.

Companion docs: [AGENTS.md](../AGENTS.md) (critical always-apply rules),
[CONTRIBUTING.MD](../CONTRIBUTING.MD) (contributor workflow),
[architecture.md](./architecture.md), [e2e-testing.md](./e2e-testing.md).

---

## 1. Process conventions

### PR titles and commits

- **Conventional commits are enforced by CI** (`Conventional commits` check,
  `.github/workflows/conventional.yaml`). Format: `type(scope): description`.
- Scopes map to **feature domains, not directories**: `self-custodial`, `custodial`,
  `bulletins`, `send`, `conversion`, `stablesats`, `restrictions`, `i18n`, `codegen`,
  `android`, `ios`, `navigation`, `deps`. Infra PRs use bare `ci:`.
- PRs are **squash-merged** (via Graphite stacked PRs), so the PR title becomes the commit
  message on `main` — review the title as carefully as the code.
- Branch naming: `type--kebab-description` (e.g. `fix--self-custodial-deposit-claim`) or
  `type/kebab-description`. Never file a PR from a fork's `main` branch (#3850).

### PR descriptions

There is no template file, but the de-facto structure is expected and reviewers treat
missing pieces as findings:

- **`## Problem` / `## Root cause` / `## Fix`** for bug fixes — root-cause writeups are
  expected to be deep (#3901, #3903 are good models).
- **`## Test plan`** with checkboxes for anything behavioral (#3877).
- **Screenshots / before-after** for any UI change (#3884, #3799).
- **Design-decision sections** ("Why a warning, not a block", #3821) when the approach
  wasn't the obvious one.
- **A "Notes" entry for every behavior change** — an undocumented protocol/format change
  (e.g. a changed address regex) is itself a blocking finding, even when the code is
  correct (#3865). State explicitly whether migration is needed.
- **Prose must match the diff.** Reviewers (human and bot) cross-check description claims
  against the code; a claim the code doesn't implement is a finding (#3903).
- **Document upgrade tradeoffs for QA** — if existing users will see a one-time behavior
  change after update (e.g. a previously-dismissed modal reappearing because the dismissal
  mechanism changed), the description must say so, so "QA should expect it" (#3818).
- Link the tracking issue (`Closes #NNNN`, or the blink-wip issue for internal work).

### Review mechanics

- **One approval merges.** The standard loop is: one structured review →
  author fixes → same reviewer approves. Aim for a single round.
- **House review format**: a single review body with **numbered findings, tiered by
  severity** (`Critical` / `Important` / `blocking` vs. non-gating notes, IDs like
  C1/I2/D3), each anchored to `file:line` with a short code excerpt, and stating the head
  SHA reviewed. Scattered drive-by inline comments are rare here; the numbered body is the
  norm because authors respond point-by-point. Two conventions worth copying:
  **open with "Real strengths first"** — catalogue what's done well, with `file:line`,
  before the criticals (#3758, #3765) — and when there are several criticals, give a
  **prioritized landing order** ("Land Critical #1 first — it's a one-line move …
  prevents silent fund-stranding", #3764).
- **Author response format**: one comment mirroring the reviewer's finding IDs, each item
  either "Done — <what changed> + <which new test pins it> + commit hash" or a reasoned
  pushback. Documented, reasoned pushback is a fully accepted resolution — e.g. keeping
  mirrored state but adding a comment explaining the invariant (#3847), standing by chosen
  copy (#3862), or explicitly deferring to a follow-up ticket the reviewer suggested
  (#3804). Correcting the reviewer's diagnosis is also legitimate and valued — on #3824
  the author showed the SDK timeout *resolved* with an empty payment (premature success)
  rather than rejecting, and fixed the real mechanism.
- **On-demand AI review**: comment `@blink-claw-bot review` to trigger a bot review; it
  verifies against a named head SHA and re-reviews after each push. Its security findings
  have real hit-rate (open redirect and secret-retention on #3775) but are advisory —
  human approval decides.
- Median merge latency is well under a day; big features iterating through rounds are the
  exception. Don't let a small fix sit — review promptly or hand off.

### CI gates (what must be green)

| Check | What it runs | Hard gate? |
|-------|--------------|-----------|
| **Check Code** | `yarn check-code` = `tsc:check` + `eslint:check` + `check:translations` + `check:codegen` + `graphql-check` | Yes |
| **Tests** | Jest (`yarn test`) | Yes — the gate reviewers cite |
| **Audit** | dependency advisories (`make audit`) | Yes |
| **Conventional commits** | PR title/commit format | Yes |
| **CodeQL / spelling / qlty** | static analysis, typos | Yes |
| **Android / iOS (E2E)** | Detox on self-hosted runners | Flaky; routinely fails/times out even on merged PRs. Investigate, but don't treat a red E2E alone as blocking — do treat a *relevant* E2E failure as one |

Most common Tests failure: **stale copy assertions after an i18n/copy change** (#3862,
#3882). If a PR changes user-facing strings, check that test assertions were updated in the
same PR.

---

## 2. Core review principles (ranked by how often they're enforced)

### 2.1 Every fix needs a test that would fail if the fix were reverted

The single most enforced norm in this repo. "Test coverage" is a standing section of
nearly every substantive review.

- The test must **pin the behavior the PR claims**: for a timeout bump, a test where a
  slow response between the old and new limit now succeeds — "reverting the bump fails it"
  (#3860). For a fallback expression like `liveValue ?? persistedValue`, a test that fails
  if the fallback is deleted (#3868).
- **Mocks must not neutralize the assumption being fixed.** If every spec mocks the parser
  the fix depends on, the fix has no coverage — add one integration test using the real
  parser with only the HTTP boundary mocked (#3849, #3873). Test file conventions:
  `*.spec.ts(x)` and `*.integration.spec.ts` under `__tests__/`.
- **Enumerate all enum states**, not just the happy ones — a card row shown for
  `CANCELED`/`FAILED` statuses when tests only covered `ACTIVE`/`LOCKED` is a finding
  (#3899).
- Decided-but-implicit behavior should be locked in: a "stays restricted after the country
  leaves the blocklist" test pins stickiness rather than leaving it accidental (#3847).
- Concurrency needs coverage too: unguarded double-invocation of an SDK call is a finding;
  the fix is the existing `useInFlightGuard` pattern plus a test (#3868).
- Don't hardcode external addresses/accounts in integration tests (#3873).

**The coverage-gap taxonomy** (established during the Spark stack reviews, #3762/#3764/#3765):

- **Tier 1** — production code with no test file at all.
- **Tier 2** — *false-confidence tests*: tests that pass while a confirmed bug is alive,
  e.g. a mock that only sums BTC so "every existing assertion would also pass against the
  pre-PR implementation" (#3762). These are worse than no tests.
- **Tier 3** — a regression test per finding, ideally demonstrated **failing before /
  green after** the fix ("each Critical should have a failing test against current code
  before the fix lands", #3762). Load-bearing assertion values must be locked, not
  approximated (#3764's substring-precedence test).

**As a reviewer, ask:** "If someone reverted the core line of this diff, which test goes
red?" If the answer is "none", request one.

### 2.2 Fail closed on money movement and compliance gates

This is a Bitcoin wallet; the threat model includes flaky SDK probes, rate-limited geo
APIs, and users deliberately trying to bypass regional restrictions.

- **Geo/compliance gates must not open on detection failure.** A geolocation error
  silently defaulting to a permitted country is a Critical finding — the fail-closed
  branch must actually be reachable (#3804).
- **Payment confirmation UI must disable on probe failure.** If a fee/dust check errors,
  the slide-to-confirm must be gated on the error, not just on `loading` — otherwise a
  flaky SDK call lets the user sweep their balance without the warning (#3821).
- **Restriction caches and kill-switches must not be bypassable** by clearing state or
  racing the cache read (#3847, #3880). New restrictions ship with a Remote Config
  kill-switch as the remedy for wrongly-stuck users (#3880).
- Reviewers also probe **abuse vectors** product-side: "how do we prevent someone
  squatting infinite usernames?" (#3868). Ask the question even if it's out of scope for
  the diff.

### 2.3 No unbounded or silent failure states

- **No permanent spinners.** If a dependency (SDK connection, network) can be absent at
  screen-open, surface a distinct error immediately or after a bounded wait — never strand
  the user in loading (#3824).
- **Validate external data shapes before use.** Remote Config JSON cast to `T[]` without
  `Array.isArray` means an operator typo throws mid-render; guard + two test cases (#3804).
- **Observability on every fallback path.** Silent fallbacks with no `logError` are a
  finding — "the entire compliance chain has zero production observability" was a Critical
  (#3804).
- **No premature success.** Timing out and reporting success is worse than reporting the
  timeout (#3824).
- **Builds must fail loudly when assumptions break**: `patch-package --error-on-fail` +
  exact version pins, so a dependency bump can't silently drop a patch and re-ship a
  production crash under a green pipeline (#3825).

### 2.4 Reuse existing utilities and patterns

Before accepting new helper code, check the repo already has the utility — reviewers do:

- `openExternalUrl` instead of bare `InAppBrowser.open()` with no catch/fallback (#3899).
- The shared password `validatePassword` utility (with at most a custom regex) instead of
  ad-hoc JS validation — "custom JS password logic is almost always the wrong path"
  (#3835, the bluntest rejection in the sample).
- `useInFlightGuard` for concurrent-call protection, "same pattern as use-create-wallet /
  use-restore-wallet" (#3868).
- **Extend existing GraphQL queries rather than adding new ones**: adding `cards { id }`
  to the existing `homeAuthed` query is free; a new network-only query on every
  home-screen mount is a blocking perf finding (#3899).
- The standard feature-flags convention for new Remote Config keys, with registered
  defaults (#3903).
- **Native APIs mid-business-logic are a code smell**: "Whenever native APIs like
  `JSON.parse` is used in middle of app/business logic it automatically should signal:
  use existing or new utility function with a fitting name" (#3804 — this review birthed
  `app/utils/remote-config.ts`).

### 2.5 The adapter pattern (uniform ports)

The load-bearing architecture rule of the custodial/self-custodial split. It was
established in #3746 ("provider-agnostic layer that allows custodial and self-custodial
accounts to coexist behind shared interfaces") and fully articulated in the #3758 review:
**mode must not leak into call sites — it hides behind a uniform port.** Reviews carry a
standing "Incomplete adapter pattern" section, filled in even when the answer is "None
introduced" (#3823, #3825).

The layering, from the SDK outwards:

```
bridge/     low-level SDK primitives only; DI on the Breez SDK; forwards args
            verbatim; no formatting, no presentation (a `$` hard-coded in the
            bridge was a finding, #3761)
adapters/   uniform, mode-agnostic contracts (SendPaymentAdapter, GetFeeAdapter,
            ConvertAdapter… in app/types/); catch bridge errors and ALWAYS return
            result objects — never throw, never fake Apollo error shapes (#3758);
            no mode names in contracts ("createCustodial*" prefix "leaks the
            concrete type… drop it before the pattern solidifies", #3746)
mappers/    pure functions; exhaustive switches with `satisfies never` plus a
            crashlytics-recorded deterministic fallback — transaction-mapper.ts's
            reportUnhandledEnum is "the gold-standard pattern" (#3761)
providers/  wire adapters into WalletState — "same shape" from both providers
hooks       provider-agnostic (usePayments(), useActiveWallet()); return
            `undefined` adapters during the loading window rather than defaulting
            to a mode that may not match (#3758)
screens     zero mode branches
```

What reviewers flag against it:

- **`isSelfCustodial` branches at call sites** — the anti-pattern. The Spark stack peaked
  at "60+ `isSelfCustodial` branches across 11 files; `home-screen.tsx` alone has 15 mode
  branches" (#3758); three screen call sites special-casing SC in one PR was a finding
  (#3765). New code should not add mode branches outside the provider layer.
- **Parallel pathways instead of abstraction** — a hook gated `enabled: isSelfCustodial`
  that mirrors the custodial flow "rather than abstracting it" (#3761).
- **Interface honesty (LSP)** — an adapter that declares `add`/`delete` and throws
  `unsupported()` at runtime "formally implements the interface but partially refuses it";
  capabilities-gate the methods or split a `ReadOnlyContactAdapter` (#3768).
- **Mode-flavored shared types** — contracts carrying `isSelfCustodial: boolean` or
  Apollo-/Breez-specific fields (#3758).

Known debt: the stack was consciously approved on 2026-05-12 *before* full adapter
conformance ("Yet to be refactored to fully respect SOLID (i.e. ~adapter pattern), but
approving since critical code/test issues were addressed so that we can get this into
internal testing asap" — #3761/#3762/#3764/#3765), with unification tracked in #3777 and
production rollout of #3768 gated on it. When reviewing new SC work, check whether it pays
this debt down or adds to it.

### 2.6 Design-level review vocabulary

Deep reviews label structural findings by principle, and authors answer per-principle:

- **SRP** — "useSdkLifecycle has at least six responsibilities" (#3762); "state-machine-
  in-disguise: nine mutable refs across four effects" (#3823).
- **ISP** — a hook exposing 5 fields whose only consumer uses 2 (#3804); bolting
  `{ loading }` onto an adapter type via intersection (#3768).
- **OCP** — shotgun surgery in `feature-flags-context` (#3804); two modules both encoding
  the same status semantics (#3764).
- **DRY with a threshold** — "the per-account pattern's 5th use has no shared key
  primitive… extract to a shared `account-key.ts` before the 6th copy" (#3818).
- **Pure core, thin hook** — business decisions belong in pure functions unit-testable
  without `renderHook` or mocks: `decideCustodialEligibility` (#3804), a decision-only
  `useSendDustWarning` returning a `hidden|pending|blocked|visible` union with formatting
  left to the screen (#3821).
- **Load-bearing comments are reviewable artifacts** — deleting one is a finding (#3821);
  invariants invisible in the code (e.g. a fix that only works because of React effect
  declaration order) must be commented (#3823).
- **Naming smells** — container nouns (`Info`, `Result`, `helpers`, `utils`); lying
  constants (`LIGHTNING_FEE_SATS = 0` was also the actual fee bug) (#3758); prefer
  polarity that makes the footgun unwritable ("`signupAllowed` vs `signupBlocked` — the
  `!signupBlocked` footgun can't be written", #3804); `with*` prefix for pure state
  transformers (#3818).
- Keep files under ~350 lines (cited "per project standards", #3776).

### 2.7 Fragile implicit coupling: derive, guard, or comment

- State that mirrors derivable state is suspect — either derive it directly or **comment
  why the mirror is needed**; a documented invariant is an accepted resolution (#3847).
- Cross-module invariants (e.g. `wallets.length === 0` meaning "not loaded" only because
  another module always returns 2 wallets) must be made explicit or commented (#3860).
- Shared i18n keys across domains need a marker comment so a future translator doesn't
  diverge them accidentally — or duplicate the key per domain now (#3864).

### 2.8 Security and key handling

- **Client-embedded API keys are extractable.** Anything read through
  `react-native-config` survives R8 into the release `BuildConfig` (see
  [android-env-config-r8.md](./android-env-config-r8.md)) — a production provider token in
  the app binary can be pulled and reused. Flag every new `*_API_KEY` env var (#3877).
- Sensitive data goes to **react-native-keychain, never AsyncStorage** (AGENTS.md).
- **Payment mutations must NOT have retry logic** — retries are handled specially in
  `app/graphql/client.tsx` (AGENTS.md).
- **Deep links and callback URLs need allowlists.** `Linking.openURL(returnUrl)` from an
  attacker-controlled URI field is an open redirect — a malicious NWC URI could set
  `return_to=https://evil-phishing-site.com`; fix with a scheme allowlist (#3775).
- **Secrets must not linger in navigation params or React context** — NWC connection
  secrets were stripped from provider state after review (#3775).
- Dependency advisories: fix via yarn `resolutions` pinning (#3833); patched native deps
  get exact pins, `--error-on-fail` (so a dep bump can't silently drop the patch, #3825),
  and **upstream-first**: file the upstream issue/PR *now* and link it inside the patch
  comment block — "that's the exit criterion for deleting the patch" (#3825).
- Regressions against established legal/compliance behavior (e.g. a ToS/Privacy acceptance
  checkbox disappearing from a flow) are blocking unless explicitly confirmed as
  deliberate (#3899).

### 2.9 Platform-specific review

- Android: New Architecture/Fabric jank, R8/proguard survival of config values, native
  crashes handled via patch-package (#3840, #3825, #3877).
- iOS: OS-version UI changes (e.g. iOS 26 Liquid Glass headers, #3853), CocoaPods churn.
- If a diff touches shared UI or navigation, ask whether it was tested on **both**
  platforms; the test plan should say so.

---

## 3. Area checklists

### GraphQL

- [ ] `app/graphql/generated.ts` (and `generated.gql`) never hand-edited — regenerate with
      `yarn dev:codegen`; CI's `check:codegen` catches drift (#3859).
- [ ] New data needs: extend an existing query (e.g. `homeAuthed`) before adding a new
      one; scrutinize any new query mounted on hot paths like the home screen (#3899).
- [ ] No retry logic on payment mutations.
- [ ] Cache behavior considered (Apollo cache + `apollo3-cache-persist` — will stale
      persisted data break the new code path?).

### i18n

- [ ] Only `app/i18n/en/index.ts` is hand-edited; `i18n-types.ts`, `raw-i18n/`, and all
      locale folders are generated via `yarn update-translations`.
- [ ] A copy change regenerates **all ~28 locales in the same PR** (expect a wide but
      mechanical diff, ~30 files for two strings — #3884).
- [ ] No stale English fallbacks left in individual locales (#3862 ar/th).
- [ ] Copy is user-facing language — no internal rationale leaking into strings ("Due to
      user experience concerns we decided…" is a finding, #3862).
- [ ] Test assertions updated alongside copy changes — the most common `Tests` failure
      (#3862, #3882).
- [ ] Keys are per-domain; intentional key sharing across domains is commented (#3864).
- [ ] For languages a reviewer speaks, sanity-check the actual translation, not just the
      mechanics (#3862 HU/VI/DE review).

### Self-custodial / custodial (Breez Spark SDK)

- [ ] **"Custodial path preserved 1:1"** — the custodial flow being untouched is a stated
      invariant; regressions there are blocking (#3824, #3849).
- [ ] **Adapter-pattern conformance** (see §2.5): bridge → adapters → mappers → providers
      layering respected; adapters return result objects; no new `isSelfCustodial`
      branches at screen/call sites; no parallel `enabled: isSelfCustodial` pathways
      mirroring the custodial flow (#3758, #3761, #3765).
- [ ] Pure/account-agnostic core, account-type routing in the outer layer: parsers and
      shared logic stay wallet-agnostic; self-custodial specifics live in
      `app/self-custodial/` adapters/bridges (#3849).
- [ ] Adapter pattern over forked UI: one presentational component, thin
      custodial/self-custodial containers exposing a uniform result shape (#3868, #3824).
- [ ] Mappers handle every enum case (`satisfies never`) with a crashlytics-recorded
      fallback for unknowns (#3761).
- [ ] SDK calls: bounded waits, distinct not-connected errors, no premature success
      (#3824); concurrency guarded with `useInFlightGuard` (#3868).
- [ ] Fees/limits from the SDK: don't rely on SDK defaults silently (default fee caps bit
      us in #3903); make chosen fee policy explicit and remote-configurable.

### Feature flags / Remote Config

- [ ] New behavior ships behind a Remote Config key with a **registered default that is
      the safe value** (#3903, #3880).
- [ ] Remote values are **shape-validated** before use (`Array.isArray` etc.) — an
      operator typo in the console must not throw mid-render (#3804).
- [ ] Risky rollouts get a kill-switch (#3880).
- [ ] Flag wiring follows `app/config/feature-flags-context.tsx` conventions.

### State / persistence

- [ ] Persistent state (`app/store/persistent-state/`) changes are per-account where
      relevant, and cache reads can't bypass restrictions (#3880, #3847).
- [ ] Migration story stated when a persisted shape changes.

### UI / navigation

- [ ] Screenshots or video in the PR for anything visual; Figma link when there's a design
      source (#3799).
- [ ] All interactive-looking elements actually work — a link styled like other tappable
      links with no `onPress` is a finding (#3899).
- [ ] External links go through `openExternalUrl` (#3899).
- [ ] Route types updated in `app/navigation/stack-param-lists.ts`; watch for Android
      Fabric jank with non-native-stack navigators (#3840).
- [ ] All states of an enum-driven UI rendered deliberately (loading / error / each status
      value) (#3899, #3824).

### Native / dependencies

- [ ] patch-package changes: exact version pin, `--error-on-fail`, upstream issue filed
      and linked in the patch (#3825).
- [ ] Audit fixes via `resolutions` (#3833); run `yarn deps:check` for RN ecosystem
      alignment.
- [ ] New env vars: consider R8 embedding/extractability before adding secrets (#3877).

### Docs

- [ ] New dependency, directory, architecture change, or GraphQL surface → corresponding
      doc update (see `.github/instructions/docs-review.instructions.md`).

---

## 4. Generated files — never hand-edit

| File / dir | Regenerate with |
|------------|-----------------|
| `app/graphql/generated.ts`, `app/graphql/generated.gql` | `yarn dev:codegen` |
| `app/i18n/i18n-types.ts`, `app/i18n/<locale>/` (all non-en), `app/i18n/raw-i18n/` | `yarn update-translations` |
| `supergraph.graphql` | `supergraph.sh` |
| `.github/workflows/vendor/`, `ci/vendor/`, `dev/vendor/` | vendir / shared-CI sync |

A hand edit to any of these is an automatic finding; CI drift checks
(`check:codegen`, `check:translations`) back this up.

---

## 5. Reviewer quick checklist

Copy into your review notes:

```
[ ] Title: conventional commit, correct domain scope (becomes the squash commit)
[ ] Description: Problem/Root cause/Fix, test plan, screenshots for UI,
    Notes entry for every behavior change, prose matches the diff
[ ] Tests: a test exists that fails if the fix is reverted; mocks don't
    neutralize the core assumption; no Tier-2 false-confidence tests
    (would they also pass against the pre-PR code?); all enum states covered
[ ] Fail-closed: money movement and compliance gates stay shut on errors,
    detection failures, and cache races
[ ] No silent failures: bounded waits, distinct errors, logError on fallbacks,
    external data shape-validated
[ ] Reuse: existing utilities/hooks/queries used (openExternalUrl,
    validatePassword, useInFlightGuard, extend homeAuthed, feature-flag conv.)
[ ] Generated files untouched by hand; locales fully regenerated
[ ] Custodial path preserved 1:1 on self-custodial work; no mode branches
    leaking past the adapter/provider layer (uniform port)
[ ] Security: no embedded secrets, keychain not AsyncStorage, no payment retries
[ ] Platform: both iOS and Android considered/tested where relevant
[ ] Review written as numbered, severity-tiered findings with file:line refs
```

And for authors responding to review: reply with one comment mirroring the reviewer's
numbering — "Done + what changed + which test pins it" per item, or reasoned pushback
(optionally resolved by a documented invariant comment in the code).
