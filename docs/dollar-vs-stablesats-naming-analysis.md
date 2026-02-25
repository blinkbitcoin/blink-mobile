# Dollar vs Stablesats Naming Analysis — Full Comparison Document

**Updated: 2026-02-25**
**PR: blinkbitcoin/blink-mobile#3672** (supersedes #3666)
**Status: Approach C (Hybrid — Dollar account in labels, Stablesats in explanations) implemented**
**Translation policy: Both "Dollar" and "account" are fully localized per language**

---

## Purpose

This document compares two naming approaches for the USD-pegged account in the Blink mobile wallet app. It is self-contained so that another AI agent or human reviewer can evaluate the tradeoffs without additional context.

---

## Background

### What is Blink?
Blink is a Bitcoin Lightning wallet built for circular economies. Originally created as "Bitcoin Beach Wallet" for El Zonte, El Salvador (2019), it was rebranded to Blink. It serves ~30,000 monthly active users with 120,000+ payments/month across 50+ circular economy projects worldwide, primarily in developing economies (El Salvador, Guatemala, Philippines, Nigeria, etc.).

### What is Stablesats?
Stablesats is the technology that powers Blink's dollar-denominated account. It allows users to hold a balance that is **stable in USD terms** without using traditional stablecoins (like USDT/USDC) or the banking system. Instead, it uses Bitcoin derivatives (perpetual inverse swaps) to hedge the BTC/USD price risk.

Key technical facts:
- **Not a stablecoin.** There is no token. The user holds Bitcoin that is hedged to USD value.
- **Not connected to banks.** The traditional banking system is not involved.
- **Users don't "receive USD."** They receive Bitcoin into an account where the USD value is kept stable.
- **"Dollar" is the account name** in the app UI. "USD" refers to the currency unit.
- Website: https://www.stablesats.com
- Terms: https://www.blink.sv/en/terms-conditions

### What is the naming issue?
The app historically used a mix of "USD", "Stablesats", "Dollar", "BTC" and "Bitcoin" inconsistently. PR #3666 is cleaning this up. The core question: **should the account be called "Dollar account" or "Stablesats account"?**

---

## The Two Approaches

### Approach A: "Dollar account"

Replace Stablesats branding with "Dollar" terminology in the UI. The account is called "Dollar account." Stablesats is mentioned only as the underlying technology in explanatory text and external links.

### Approach B: "Stablesats account"

Keep and strengthen the Stablesats brand in the UI. The account is called "Stablesats account." Dollar/USD is used only when referring to the currency value.

### Approach C: Hybrid (currently implemented in PR)

"Dollar account" in all labels, buttons, and navigation. "Stablesats" prominently mentioned in all explanatory text with the phrase "powered by Stablesats." This bridges user clarity with brand preservation and technical transparency.

---

## String-by-String Comparison

For each string: the i18n key, the original text (before PR), Approach A (current PR), and Approach B (alternative).

---

### 1. `common.btcAccount`
- **Original:** "BTC Account"
- **A (Dollar):** "Bitcoin Account"
- **B (Stablesats):** "Bitcoin Account"
- *Both approaches rename BTC → Bitcoin for consistency.*

### 2. `common.usdAccount`
- **Original:** "USD Account"
- **A (Dollar):** "Dollar Account"
- **B (Stablesats):** "Stablesats Account"

### 3. `common.stablesatsUsd`
- **Original:** "Stablesats USD"
- **A (Dollar):** *(deleted — unused in codebase, dead code)*
- **B (Stablesats):** *(deleted — unused in codebase, dead code)*

### 4. `common.dollar`
- **Original:** "Dollar"
- **A (Dollar):** "Dollar" *(unchanged)*
- **B (Stablesats):** "Dollar" *(unchanged — refers to currency)*

### 5. `common.dollarStablesats`
- **Original:** "Dollar (Stablesats)"
- **A (Dollar):** "Dollar (Stablesats)" *(unchanged)*
- **B (Stablesats):** "Stablesats (Dollar)"
- *Used in Settings → Default receive account as the wallet name in a selection list.*

### 6. `ReceiveScreen.usdTitle`
- **Original:** "Receive USD"
- **A (Dollar):** "Receive to Dollar account"
- **B (Stablesats):** "Receive to Stablesats account"

### 7. `RedeemBitcoinScreen.usdTitle`
- **Original:** "Redeem for USD"
- **A (Dollar):** "Redeem to Dollar account"
- **B (Stablesats):** "Redeem to Stablesats account"

### 8. `OnboardingScreen.welcomeLevel1.dailyLimitDescription`
- **Original:** "Send up to $1,000 USD per day"
- **A (Dollar):** "Send up to USD 1,000 per day"
- **B (Stablesats):** "Send up to USD 1,000 per day"
- *Both approaches fix the currency format. No naming difference.*

### 9. `GetStartedScreen.trialAccountLimits.dailyLimit`
- **Original:** "$1000 daily transaction limit"
- **A (Dollar):** "USD 1,000 daily transaction limit"
- **B (Stablesats):** "USD 1,000 daily transaction limit"
- *Both approaches fix the currency format. No naming difference.*

### 10. `SetAccountModal.stablesatsTag`
- **Original:** "Stablesats account for price stability"
- **A (Dollar):** "Dollar account — Bitcoin hedged to USD value"
- **B (Stablesats):** "Stablesats account — Bitcoin hedged to USD value"
- **C (Hybrid, current PR):** "Dollar account — powered by Stablesats"
- *Used in the modal that lets users pick their default receive account during setup. Paired with `bitcoinTag`.*

### 11. `SetAccountModal.bitcoinTag`
- **Original:** "Bitcoin account for maximalists"
- **A (Dollar):** "Bitcoin account for maximalists" *(unchanged)*
- **B (Stablesats):** "Bitcoin account for maximalists" *(unchanged)*

### 12. `AccountScreen.usdBalanceWarning`
- **Original:** "You have a Stablesats balance of {balance}."
- **A (Dollar):** "You have a Dollar account balance of {balance}."
- **B (Stablesats):** "You have a Stablesats account balance of {balance}."
- *Shown on Settings → Account → Delete account confirmation when user has a balance.*

### 13. `DefaultWalletScreen.title`
- **Original:** "Receive currency"
- **A (Dollar):** "Default receive account"
- **B (Stablesats):** "Default receive account"
- *Both approaches fix this — it's about accounts, not currencies.*

### 14. `DefaultWalletScreen.info`
- **Original:** "Use your Stablesats account in Blink to keep the money in your wallet stable in fiat (dollar) terms. Use your Bitcoin account if you're stacking sats and are okay with your fiat balance changing all the time."
- **A (Dollar):** "Your Dollar account holds Bitcoin that is hedged to stay stable in USD terms — you're always holding Bitcoin, but the dollar value doesn't change. Your Bitcoin account is for stacking sats, where the USD value moves with the market."
- **B (Stablesats):** "Your Stablesats account holds Bitcoin that is hedged to stay stable in USD terms — you're always holding Bitcoin, but the dollar value doesn't change. Your Bitcoin account is for stacking sats, where the USD value moves with the market."
- **C (Hybrid, current PR):** "Your Bitcoin account is for stacking sats, where the USD value moves with the market. Your Dollar account is powered by Stablesats — it holds Bitcoin that is hedged to stay stable in USD terms. You're always holding Bitcoin, but the dollar value doesn't change."
- *Used in Settings → Default receive account screen as explanatory text.*

### 15. `StablesatsModal.header`
- **Original:** "With Stablesats, you now have a USD account added to your wallet!"
- **A (Dollar):** "With Dollar account, your Bitcoin doesn't fluctuate in price against USD"
- **B (Stablesats):** "With Stablesats account, your Bitcoin doesn't fluctuate in price against USD"
- **C (Hybrid, current PR):** "Your Dollar account is powered by Stablesats"
- *Pop-up modal shown when user first gets a Dollar/Stablesats account.*

### 16. `StablesatsModal.body`
- **Original:** "You can use it to send and receive Bitcoin, and instantly transfer value between your BTC and USD account. Value in the USD account will not fluctuate with the price of Bitcoin. This feature is not compatible with the traditional banking system."
- **A (Dollar):** "In the Dollar account you can hold Bitcoin but keep it stable to USD price. The Dollar account uses the underlying Stablesats technology. Because the Dollar account is also Bitcoin, you can use it to send and receive Bitcoin as usual, but it is not compatible with the traditional banking system."
- **B (Stablesats):** "In the Stablesats account you can hold Bitcoin but keep it stable to USD price. Because the Stablesats account is also Bitcoin, you can use it to send and receive Bitcoin as usual, but it is not compatible with the traditional banking system."
- **C (Hybrid, current PR):** "The Dollar account uses Stablesats technology to hold Bitcoin stable to USD price. You're always holding Bitcoin — not actual dollars — but the USD value doesn't fluctuate. You can send and receive Bitcoin as usual, but this is not compatible with the traditional banking system."
- *Note: Approach C adds the explicit "not actual dollars" clarification, which neither A nor B had.*

### 17. `StablesatsModal.termsAndConditions`
- **Original:** "Read the Terms & Conditions."
- **A (Dollar):** "Read the Terms & Conditions." *(unchanged)*
- **B (Stablesats):** "Read the Terms & Conditions." *(unchanged)*

### 18. `StablesatsModal.learnMore`
- **Original:** "Learn more about Stablesats"
- **A (Dollar):** "Learn more about Stablesats" *(unchanged)*
- **B (Stablesats):** "Learn more about Stablesats" *(unchanged)*

### 19. `TransactionLimitsScreen.stablesatTransfers`
- **Original:** "Stablesats transfers"
- **A (Dollar):** "Dollar account transfers"
- **B (Stablesats):** "Stablesats transfers" *(unchanged from original)*
- *Section header in Settings → Transaction Limits.*

### 20. `ConversionConfirmationScreen.infoDollar`
- **Original:** "Dollar amount is only approximate. It can vary by a small amount."
- **A (Dollar):** *(unchanged — refers to currency amount)*
- **B (Stablesats):** *(unchanged — refers to currency amount)*

---

## Analysis

### A) User Perspective

#### Approach A: "Dollar account" — Pros
1. **Immediately understandable.** A user in El Salvador, Guatemala, or the Philippines instantly knows what "Dollar account" means — it holds dollar value. Zero learning curve.
2. **Reduces jargon.** "Stablesats" is a technical/brand term requiring explanation. "Dollar" is universal.
3. **Aligns with user mental model.** Users think "I have dollars" and "I have Bitcoin." They don't think "I have Stablesats."
4. **Better onboarding.** New users see "Bitcoin Account" and "Dollar Account" — the choice is self-explanatory.
5. **Consistent with competitor wallets.** Other multi-currency wallets (Strike, Muun, etc.) use currency names, not technology names.
6. **"Hedged Bitcoin" clarification built in.** The updated body texts now explain clearly that the Dollar account holds Bitcoin hedged to USD — users get both the simplicity of "Dollar" and the transparency of "it's still Bitcoin."

#### Approach A: "Dollar account" — Cons
1. **Potentially misleading.** Users might think they hold actual USD or that it's connected to the banking system. It's not — it's hedged Bitcoin.
2. **Regulatory risk.** Calling it a "Dollar account" could attract scrutiny from regulators who may interpret this as offering USD deposit accounts (which require banking licenses).
3. **Loss of brand identity.** Stablesats has its own website, brand, and community. Removing it from the UI erases that.
4. **Confusion if Stablesats is referenced elsewhere.** The "Learn more about Stablesats" link and stablesats.com still exist. Users may wonder what "Stablesats" is if it's never mentioned in the main UI.

#### Approach B: "Stablesats account" — Pros
1. **Honest about what it is.** It's not a real dollar account — it's a Bitcoin-based hedging product called Stablesats. The name signals this clearly.
2. **Regulatory safety.** Using a distinct product name avoids implying it's a traditional USD account. Regulators are less likely to classify "Stablesats" as a deposit product.
3. **Brand building.** Reinforces the Stablesats brand, which has its own marketing, website, and technical identity.
4. **Differentiation.** Makes Blink's offering distinct from traditional fintech "dollar wallets" — positions it as a Bitcoin-native innovation.
5. **Consistent with existing marketing.** stablesats.com, blog posts, and PR materials already use this term.
6. **No confusing gap.** "Learn more about Stablesats" makes immediate sense when the account is already called "Stablesats."

#### Approach B: "Stablesats account" — Cons
1. **Learning curve.** New users must learn what "Stablesats" means. It's not self-explanatory.
2. **Friction in developing markets.** Blink's target users (unbanked, developing economies) want simplicity. A made-up word adds cognitive load.
3. **Name doesn't convey function.** "Dollar" instantly communicates "stable USD value." "Stablesats" communicates nothing to a first-time user.
4. **Inconsistent pair.** "Bitcoin Account" + "Stablesats Account" is asymmetric — one is the asset name, the other is a technology brand. "Bitcoin Account" + "Dollar Account" is a clean pair.
5. **May feel "crypto jargon."** For mainstream users, "Stablesats" sounds like insider terminology.

### B) Regulatory Perspective

#### Approach A: "Dollar account" — Regulatory Risk
- **Higher risk in regulated jurisdictions (US, EU, UK).** Calling something a "Dollar account" may be interpreted as offering a deposit account, which typically requires a banking or e-money license.
- **Money transmitter concerns.** If users perceive they're "holding dollars," regulators may classify Blink in additional MSB categories.
- **Advertising standards.** Consumer protection regulators may view "Dollar account" as misleading if the underlying mechanism is Bitcoin derivatives, not actual USD.
- **Mitigating factor — disclaimers.** The updated modal body now explicitly states: "The Dollar account uses the underlying Stablesats technology" and "it is not compatible with the traditional banking system." This helps.
- **Mitigating factor — hedging explanation.** The new `DefaultWalletScreen.info` text explains "holds Bitcoin that is hedged to stay stable in USD terms" and "you're always holding Bitcoin." This is transparent.
- **El Salvador context.** Bitcoin is legal tender there, and the dollar is also legal tender. Blink El Salvador S.A. de C.V. is regulated locally. A "Dollar account" backed by Bitcoin sits in interesting territory but within a favorable regulatory environment.

#### Approach B: "Stablesats account" — Regulatory Risk
- **Lower risk.** A unique product name clearly signals "this is something different from a bank account." It's a branded financial product, not a deposit.
- **Easier to disclaim.** Terms can state: "Stablesats is not a deposit, not insured, not connected to the banking system." A unique name creates distance.
- **Precedent.** Other crypto products use distinct names to avoid regulatory classification (e.g., "Vault" instead of "savings account," "Earn" instead of "interest").
- **Still requires disclaimers.** Even with a unique name, regulators can look through to the substance. But the naming helps.
- **Reduced advertising risk.** No one can claim "Stablesats account" sounds like a bank product.

### Summary Matrix

| Criterion | Dollar (A) | Stablesats (B) | Hybrid (C, current PR) |
|-----------|-----------|----------------|----------------------|
| User clarity | ✅ High | ⚠️ Medium | ✅ High |
| Onboarding friction | ✅ Low | ⚠️ Higher | ✅ Low |
| Regulatory risk | ⚠️ Higher | ✅ Lower | ✅ Low — "not actual dollars" explicit |
| Brand building | ❌ Erases brand | ✅ Reinforces | ✅ "Powered by" preserves brand |
| Accuracy | ⚠️ Implies real USD | ✅ Signals unique product | ✅ Explicit about what it is and isn't |
| Developing market fit | ✅ Universal | ⚠️ Jargon barrier | ✅ Universal labels + clear explanations |
| Consistency with marketing | ⚠️ Diverges | ✅ Aligned | ✅ Bridges both — links to stablesats.com make sense |
| Competitor alignment | ✅ Standard | ❌ Unfamiliar | ✅ Standard labels, unique explanations |
| Account pair symmetry | ✅ Clean | ⚠️ Asymmetric | ✅ Clean |
| Hedging transparency | ✅ In body text | ✅ Inherent | ✅ In body text + "not actual dollars" |
| Future sub-accounts | ✅ Natural umbrella | ❌ Forced rename | ✅ Natural umbrella |
| Self-custody (Spark) | ✅ Works for both | ❌ Breaks | ✅ Works for both |
| Forward compatibility | ✅ No rename needed | ❌ Likely rename | ✅ No rename needed |

---

## Future Account Architecture: Sub-Accounts and Self-Custody

*Section added per I Am Me's product vision (2026-02-22).*

### Planned Architecture

In the future, Bitcoin and Dollar accounts will become **expandable top-level categories** with various sub-account types underneath:

**Bitcoin account sub-accounts:**
- Savings
- Node Yield
- *(other future categories)*

**Dollar account sub-accounts:**
- Stablesats (custodial, Bitcoin-hedged)
- USDT
- USDC
- *(other stablecoins as needed)*

### Why This Favors "Dollar Account" Naming

1. **Easy stablecoin expansion.** With "Dollar account" as the umbrella term, adding USDT, USDC, or other dollar-denominated assets later is seamless. They all naturally live under "Dollar account." If the account were named "Stablesats account," adding USDT/USDC underneath would be confusing — those aren't Stablesats.

2. **Self-custodial Blink wallets (Spark).** When Blink implements self-custodial wallets via Spark, custodial Stablesats **cannot be offered** to self-custodial users (Stablesats requires Blink to manage the hedge). Self-custodial users will need stablecoins (USDT, USDC) instead. If the top-level account is called "Dollar account," this transition is invisible to the user — their "Dollar account" simply uses a different backing mechanism. If it were called "Stablesats account," the self-custodial version would need a different name entirely.

3. **Avoiding a forced rename.** If "Stablesats" is used as the account name now, it will almost certainly need to change when sub-accounts and self-custody arrive. That means:
   - Another round of string changes across all translation files
   - User confusion ("Where did my Stablesats account go?")
   - Inconsistency between old and new app versions during the transition
   - Risk of translation errors and misalignment

4. **Unified UX across custodial and self-custodial.** Using "Dollar account" for both custodial (Stablesats-backed) and self-custodial (stablecoin-backed) wallets means the UI stays consistent regardless of custody model. Users don't need to know or care whether their dollar balance is hedged Bitcoin or USDT — they see "Dollar account" and know it holds dollar value.

5. **Stablesats becomes what it is: a technology, not a product name.** Under this architecture, Stablesats is correctly positioned as one of several mechanisms for maintaining dollar value — alongside USDT, USDC, etc. The "Dollar account" is the user-facing product; Stablesats is the implementation detail shown in sub-account selection and explanatory text.

### Architecture Diagram

```
┌─────────────────────────┐    ┌─────────────────────────┐
│     Bitcoin Account      │    │     Dollar Account       │
├─────────────────────────┤    ├─────────────────────────┤
│ • Savings               │    │ • Stablesats (custodial) │
│ • Node Yield            │    │ • USDT                   │
│ • (future categories)   │    │ • USDC                   │
│                         │    │ • (future stablecoins)   │
└─────────────────────────┘    └─────────────────────────┘
         ▲                              ▲
         │                              │
    Self-custodial                 Self-custodial
    (same name,                   (same name,
     same UX)                      USDT/USDC instead
                                   of Stablesats)
```

### Impact on Approach B (Stablesats Account)

This future architecture is a **strong argument against Approach B.** If the account is named "Stablesats" today, the team would face:
- A forced rename when sub-accounts launch (confusing for users, expensive in dev/translation work)
- OR maintaining separate naming for custodial ("Stablesats account") vs self-custodial ("Dollar account" or something else) — which creates inconsistency and translation complexity that the team explicitly wants to avoid
- Neither option is acceptable, making "Dollar account" the more future-proof choice

---

## Approach C: Hybrid (Currently Implemented in PR)

**"Dollar account" in the UI labels, "powered by Stablesats" in all explanatory text.**

This is what the PR currently implements. The pattern:
- **Labels, buttons, navigation:** Always "Dollar account" — simple, clear, no jargon
- **Explanatory text:** Always mentions "Stablesats" with "powered by" phrasing — preserves brand, explains technology
- **Modal body:** Adds explicit "not actual dollars" clarification — addresses regulatory concern head-on
- **"Learn more about Stablesats"** link unchanged — bridges to stablesats.com naturally

### Why Approach C is the Best of Both Worlds

1. **User clarity (from A):** Labels say "Dollar account" — instantly understood worldwide
2. **Brand preservation (from B):** Every explanation mentions Stablesats — users learn the brand through context
3. **Regulatory safety (unique to C):** "Powered by Stablesats" + "not actual dollars" makes the nature of the product unmistakable
4. **Future-proof:** "Dollar account" as umbrella works for sub-accounts (Stablesats, USDT, USDC) and self-custodial Spark wallets
5. **No forced rename:** When sub-accounts arrive, "Stablesats" becomes a sub-account name under "Dollar account" — the "powered by" language already set that expectation
6. **Marketing bridge:** "Learn more about Stablesats" link makes sense because the user just read "powered by Stablesats" — there's no naming gap

### Approach C String Summary

| Key | Text |
|-----|------|
| `SetAccountModal.stablesatsTag` | Dollar account — powered by Stablesats |
| `DefaultWalletScreen.info` | Your Bitcoin account is for stacking sats, where the USD value moves with the market. Your Dollar account is powered by Stablesats — it holds Bitcoin that is hedged to stay stable in USD terms. You're always holding Bitcoin, but the dollar value doesn't change. |
| `StablesatsModal.header` | Your Dollar account is powered by Stablesats |
| `StablesatsModal.body` | The Dollar account uses Stablesats technology to hold Bitcoin stable to USD price. You're always holding Bitcoin — not actual dollars — but the USD value doesn't fluctuate. You can send and receive Bitcoin as usual, but this is not compatible with the traditional banking system. |

All other strings are identical to Approach A (see string-by-string comparison above).

---

## Current PR State

PR #3672 (supersedes #3666) implements **Approach C (Hybrid)** with the following commits:
1. Rename "BTC Account" → "Bitcoin Account", "USD Account" → "Dollar Account"
2. "Receive USD" → "Receive to Dollar account", "Redeem for USD" → "Redeem to Dollar account"
3. "$1,000 USD" / "$1000" → "USD 1,000" formatting
4. Replace Stablesats UI references with Dollar account terminology in labels
5. "Receive currency" → "Default receive account", modal copy updates
6. Added "hedged Bitcoin" clarification to body texts
7. Switched to Approach C: "powered by Stablesats" in explanatory texts, "not actual dollars" clarification
8. Localized "account" in all sentence-level strings across 28 languages
9. Fully localized "Dollar" in all languages (xh: "Idola", hy: "Դodelays", etc.)

### Translation Policy (updated 2026-02-25)
**Both "Dollar" and "account" are fully translated** in each language. This is a change from the earlier spec which treated "Dollar account" as an untranslated product name. The updated decision (confirmed by I Am Me):
- "Dollar" → localized per language (e.g., "Dólar", "Dollár", "Dolar", "ドル", "Idola", "Δολάριο", etc.)
- "account" → localized per language (e.g., "cuenta", "Konto", "rekening", "ウォレット", etc.)
- "Bitcoin" → stays as "Bitcoin" in Latin-script languages; transliterated in non-Latin scripts (ビットコイン, Բdelays delays delays, etc.)
- "Stablesats" → always stays as "Stablesats" (technology brand name)
- "USD" → always stays as "USD" (international currency code)

All 28 translation files are now fully localized, including Armenian and Xhosa which previously had English fallbacks.

---

## Instructions for Follow-Up Agent

If you are an AI agent tasked with elaborating on this analysis:

1. **You have the full picture.** All 20 relevant strings, both approaches, and the analysis are above.
2. **The PR:** `blinkbitcoin/blink-mobile#3672` — currently implements Approach C (Hybrid).
3. **The repo:** `blinkbitcoin/blink-mobile` (React Native app, TypeScript).
4. **Translation files:** `app/i18n/raw-i18n/source/en.json` (English source) and `app/i18n/raw-i18n/translations/<lang>.json` (28 languages: af, ar, ca, cs, da, de, el, es, fr, hr, hu, hy, id, it, ja, lg, ms, nl, pt, qu, ro, sk, sr, sw, th, tr, vi, xh).
5. **The decision-maker** is "I Am Me" (GitHub: ihaveadifferentname).
6. **Blink's target market:** developing economies — El Salvador, Guatemala, Philippines, Nigeria, etc. Users are often unbanked with limited technical literacy.
7. **Stablesats website:** https://www.stablesats.com — has its own branding and explanation.
8. **Regulatory context:** Blink's El Salvador operation is via Blink El Salvador S.A. de C.V. (regulated in El Salvador). Blink's worldwide operation is via Blink LLC (regulated in Próspera ZEDE, Honduras). Galoy Inc. is a shareholder and technology provider, not the developer or operator of Blink. Bitcoin is legal tender in El Salvador.
9. **If asked to implement Approach B,** revert the Stablesats→Dollar changes and replace "Dollar account" with "Stablesats account" per the string-by-string comparison above.
10. **Translation policy:** Both "Dollar" and "account" are fully localized in each language. Only "Stablesats" and "USD" remain untranslated across all languages.
11. **Key naming principle established:** "Dollar" = account name (fully localized), "USD" = currency unit (kept as international code), "Stablesats" = underlying technology brand (never translated). This principle would flip in Approach B: "Stablesats" = account name, "Dollar/USD" = currency reference only.
12. **The "hedged Bitcoin" explanation** is now embedded in Approach A's body texts. If switching to Approach B, this explanation still applies but the wording shifts naturally (e.g., "Your Stablesats account holds Bitcoin that is hedged...").
