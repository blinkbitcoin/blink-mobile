import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  hasTwoFactor,
  normalizeStoredRecord,
  resolveBalanceTier,
  resolveMissingMethod,
} from "@app/custodial/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"

const walletsWith = (sats: number, usdCents: number) => [
  { id: "btc-wallet", walletCurrency: WalletCurrency.Btc, balance: sats },
  { id: "usd-wallet", walletCurrency: WalletCurrency.Usd, balance: usdCents },
]

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

describe("normalizeStoredRecord", () => {
  it("falls back to the default without a stored record", () => {
    expect(normalizeStoredRecord(null)).toEqual(DEFAULT_TWO_FACTOR_ENFORCEMENT)
  })

  it("keeps a valid stored record", () => {
    expect(
      normalizeStoredRecord({
        highestTier: TwoFactorTier.Recommended,
        nudgeCardDismissed: true,
      }),
    ).toEqual({ highestTier: TwoFactorTier.Recommended, nudgeCardDismissed: true })
  })

  it("drops a tier this build does not know", () => {
    expect(normalizeStoredRecord({ highestTier: 7 })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
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
