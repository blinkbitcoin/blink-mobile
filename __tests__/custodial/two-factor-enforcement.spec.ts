import {
  ENFORCED_THRESHOLD,
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  hasTwoFactor,
  normalizeStoredRecord,
  remainingDismissals,
  resolveBalanceTier,
  resolveEnforcedCurrency,
  resolveMissingMethod,
  resolveSessionPrompt,
  resolveUnmetTier,
  withDismissal,
  withTierReached,
} from "@app/custodial/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

const walletsWith = (sats: number, usdCents: number) => [
  { id: "btc-wallet", walletCurrency: WalletCurrency.Btc, balance: sats },
  { id: "usd-wallet", walletCurrency: WalletCurrency.Usd, balance: usdCents },
]

const recordWith = (
  overrides: Partial<TwoFactorEnforcementRecord>,
): TwoFactorEnforcementRecord => ({ ...DEFAULT_TWO_FACTOR_ENFORCEMENT, ...overrides })

describe("resolveBalanceTier", () => {
  it("is none without wallets", () => {
    expect(resolveBalanceTier(undefined)).toBe(TwoFactorTier.None)
    expect(resolveBalanceTier([])).toBe(TwoFactorTier.None)
  })

  it("stays none one unit below the first threshold on both wallets", () => {
    expect(resolveBalanceTier(walletsWith(49_999, 4_999))).toBe(TwoFactorTier.None)
  })

  it("reaches nudge from the bitcoin wallet alone", () => {
    expect(resolveBalanceTier(walletsWith(50_000, 0))).toBe(TwoFactorTier.Suggested)
  })

  it("reaches nudge from the dollar wallet alone", () => {
    expect(resolveBalanceTier(walletsWith(0, 5_000))).toBe(TwoFactorTier.Suggested)
  })

  it("never adds the wallets together", () => {
    expect(resolveBalanceTier(walletsWith(499_999, 49_999))).toBe(TwoFactorTier.Suggested)
  })

  it("reaches the recommended tier at 500,000 sats or $500", () => {
    expect(resolveBalanceTier(walletsWith(500_000, 0))).toBe(TwoFactorTier.Recommended)
    expect(resolveBalanceTier(walletsWith(0, 50_000))).toBe(TwoFactorTier.Recommended)
  })

  it("reaches the enforced tier at 5,000,000 sats or $5,000", () => {
    expect(resolveBalanceTier(walletsWith(5_000_000, 0))).toBe(TwoFactorTier.Enforced)
    expect(resolveBalanceTier(walletsWith(0, 500_000))).toBe(TwoFactorTier.Enforced)
  })

  it("takes the highest tier either wallet reaches", () => {
    expect(resolveBalanceTier(walletsWith(50_000, 500_000))).toBe(TwoFactorTier.Enforced)
  })

  it("exposes the enforced threshold the copy quotes", () => {
    expect(ENFORCED_THRESHOLD).toEqual({ sats: 5_000_000, usdCents: 500_000 })
  })
})

describe("resolveEnforcedCurrency", () => {
  it("names sats when the bitcoin wallet crossed the threshold", () => {
    expect(resolveEnforcedCurrency(walletsWith(5_000_000, 0))).toBe(WalletCurrency.Btc)
  })

  it("names dollars when only the dollar wallet crossed it", () => {
    expect(resolveEnforcedCurrency(walletsWith(4_999_999, 500_000))).toBe(
      WalletCurrency.Usd,
    )
  })

  it("names sats when both wallets crossed it", () => {
    expect(resolveEnforcedCurrency(walletsWith(5_000_000, 500_000))).toBe(
      WalletCurrency.Btc,
    )
  })

  it("falls back to sats when neither has", () => {
    expect(resolveEnforcedCurrency(walletsWith(0, 0))).toBe(WalletCurrency.Btc)
    expect(resolveEnforcedCurrency(undefined)).toBe(WalletCurrency.Btc)
  })
})

describe("withTierReached", () => {
  it("raises the tier and leaves the named wallet alone below the enforced tier", () => {
    const record = withTierReached(
      recordWith({ enforcedCurrency: WalletCurrency.Usd }),
      TwoFactorTier.Recommended,
      walletsWith(500_000, 0),
    )

    expect(record.highestTier).toBe(TwoFactorTier.Recommended)
    expect(record.enforcedCurrency).toBe(WalletCurrency.Usd)
  })

  it("remembers the wallet that crossed into the enforced tier", () => {
    const record = withTierReached(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.Enforced,
      walletsWith(0, 500_000),
    )

    expect(record.highestTier).toBe(TwoFactorTier.Enforced)
    expect(record.enforcedCurrency).toBe(WalletCurrency.Usd)
  })
})

describe("hasTwoFactor", () => {
  it("needs two verified factors", () => {
    expect(
      hasTwoFactor({ hasPhone: true, hasVerifiedEmail: false, hasAuthenticator: false }),
    ).toBe(false)
    expect(
      hasTwoFactor({ hasPhone: true, hasVerifiedEmail: true, hasAuthenticator: false }),
    ).toBe(true)
  })

  it("counts the authenticator as a factor", () => {
    expect(
      hasTwoFactor({ hasPhone: false, hasVerifiedEmail: true, hasAuthenticator: true }),
    ).toBe(true)
  })

  it("is false with nothing set", () => {
    expect(
      hasTwoFactor({ hasPhone: false, hasVerifiedEmail: false, hasAuthenticator: false }),
    ).toBe(false)
  })
})

describe("resolveMissingMethod", () => {
  it("offers a phone once the email is verified", () => {
    expect(
      resolveMissingMethod({
        hasPhone: false,
        hasVerifiedEmail: true,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorMethod.Phone)
  })

  it("offers an email when only a phone is set", () => {
    expect(
      resolveMissingMethod({
        hasPhone: true,
        hasVerifiedEmail: false,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorMethod.Email)
  })

  it("offers an email when nothing is set", () => {
    expect(
      resolveMissingMethod({
        hasPhone: false,
        hasVerifiedEmail: false,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorMethod.Email)
  })
})

describe("resolveUnmetTier", () => {
  it("is none below the suggested tier", () => {
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.None,
        hasTwoFactor: false,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorTier.None)
  })

  it("is the reached tier while the account has no two factors", () => {
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.Suggested,
        hasTwoFactor: false,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorTier.Suggested)
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.Recommended,
        hasTwoFactor: false,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorTier.Recommended)
  })

  it("is none once two factors satisfy the suggested and recommended tiers", () => {
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.Recommended,
        hasTwoFactor: true,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorTier.None)
  })

  it("asks for an authenticator at the enforced tier even with two factors", () => {
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.Enforced,
        hasTwoFactor: true,
        hasAuthenticator: false,
      }),
    ).toBe(TwoFactorTier.Enforced)
  })

  it("is none at the enforced tier once an authenticator joins a second factor", () => {
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.Enforced,
        hasTwoFactor: true,
        hasAuthenticator: true,
      }),
    ).toBe(TwoFactorTier.None)
  })

  it("still asks for a second factor when the authenticator is the only one", () => {
    expect(
      resolveUnmetTier({
        tier: TwoFactorTier.Enforced,
        hasTwoFactor: false,
        hasAuthenticator: true,
      }),
    ).toBe(TwoFactorTier.Recommended)
  })
})

describe("dismissals", () => {
  it("allows three per tier", () => {
    expect(
      remainingDismissals(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Recommended),
    ).toBe(3)
    expect(
      remainingDismissals(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Enforced),
    ).toBe(3)
  })

  it("counts the recommended tier's dismissals on their own counter", () => {
    const record = withDismissal(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.Recommended,
    )

    expect(record.recommendedDismissals).toBe(1)
    expect(record.enforcedDismissals).toBe(0)
    expect(remainingDismissals(record, TwoFactorTier.Recommended)).toBe(2)
    expect(remainingDismissals(record, TwoFactorTier.Enforced)).toBe(3)
  })

  it("counts the enforced tier's dismissals on their own counter", () => {
    const record = withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Enforced)

    expect(record.enforcedDismissals).toBe(1)
    expect(record.recommendedDismissals).toBe(0)
  })

  it("leaves the record untouched for tiers that never prompt at session start", () => {
    expect(withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Suggested)).toBe(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
    expect(withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.None)).toBe(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  it("never reports fewer than zero remaining", () => {
    expect(
      remainingDismissals(
        recordWith({ recommendedDismissals: 5 }),
        TwoFactorTier.Recommended,
      ),
    ).toBe(0)
  })
})

describe("resolveSessionPrompt", () => {
  it("owes nothing below the recommended tier", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Suggested,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.None,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
  })

  it("owes the modal at the recommended tier while dismissals remain", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 2 }),
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the protection screen at the recommended tier once dismissals are spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.ProtectionRequired)
  })

  it("owes the protection screen at the enforced tier from the first session", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
      }),
    ).toBe(TwoFactorSessionPrompt.ProtectionRequired)
  })
})

describe("normalizeStoredRecord", () => {
  it("falls back to the default without a stored record", () => {
    expect(normalizeStoredRecord(null)).toEqual(DEFAULT_TWO_FACTOR_ENFORCEMENT)
  })

  it("keeps a valid stored record", () => {
    const record = {
      highestTier: TwoFactorTier.Enforced,
      enforcedCurrency: WalletCurrency.Usd,
      nudgeCardDismissed: true,
      recommendedDismissals: 2,
      enforcedDismissals: 1,
    }

    expect(normalizeStoredRecord(record)).toEqual(record)
  })

  it("starts the fields a record from before they existed at their defaults", () => {
    expect(
      normalizeStoredRecord({
        highestTier: TwoFactorTier.Recommended,
        nudgeCardDismissed: true,
      }),
    ).toEqual(
      recordWith({ highestTier: TwoFactorTier.Recommended, nudgeCardDismissed: true }),
    )
  })

  it("drops a tier this build does not know", () => {
    expect(normalizeStoredRecord({ highestTier: 7 })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  it("drops a wallet currency this build does not know", () => {
    expect(normalizeStoredRecord({ enforcedCurrency: "EUR" as WalletCurrency })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  it("drops a counter that is not a whole, non-negative number", () => {
    expect(
      normalizeStoredRecord({ recommendedDismissals: -1, enforcedDismissals: 1.5 }),
    ).toEqual(DEFAULT_TWO_FACTOR_ENFORCEMENT)
  })

  it("only reads a dismissal that is exactly true", () => {
    expect(
      normalizeStoredRecord({ nudgeCardDismissed: undefined }).nudgeCardDismissed,
    ).toBe(false)
  })

  /** What a hand-edited or foreign record can hold: truthy values that are not the
   *  boolean this build writes. */
  it("does not read a dismissal from the string true", () => {
    expect(normalizeStoredRecord({ nudgeCardDismissed: "true" }).nudgeCardDismissed).toBe(
      false,
    )
  })

  it("does not read a dismissal from the number one", () => {
    expect(normalizeStoredRecord({ nudgeCardDismissed: 1 }).nudgeCardDismissed).toBe(
      false,
    )
  })
})
