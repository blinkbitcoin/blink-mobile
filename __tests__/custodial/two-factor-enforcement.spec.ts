import { defaultTwoFactorThresholds } from "@app/config/feature-flags-context"
import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  normalizeStoredRecord,
  remainingDismissals,
  resolveBalanceTier,
  resolveHighBalanceCurrency,
  resolveSessionPrompt,
  resolveUnmetTier,
  withDismissal,
  withTierReached,
} from "@app/custodial/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import {
  TwoFactorEnforcementRecord,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

const walletsWith = (sats: number, usdCents: number) => [
  { id: "btc-wallet", walletCurrency: WalletCurrency.Btc, balance: sats },
  { id: "usd-wallet", walletCurrency: WalletCurrency.Usd, balance: usdCents },
]

const THRESHOLDS = defaultTwoFactorThresholds

const recordWith = (
  overrides: Partial<TwoFactorEnforcementRecord>,
): TwoFactorEnforcementRecord => ({ ...DEFAULT_TWO_FACTOR_ENFORCEMENT, ...overrides })

describe("resolveBalanceTier", () => {
  it("is none without wallets", () => {
    expect(resolveBalanceTier(undefined, THRESHOLDS)).toBe(TwoFactorTier.None)
    expect(resolveBalanceTier([], THRESHOLDS)).toBe(TwoFactorTier.None)
  })

  it("stays none one unit below the first threshold on both wallets", () => {
    expect(resolveBalanceTier(walletsWith(49_999, 4_999), THRESHOLDS)).toBe(
      TwoFactorTier.None,
    )
  })

  it("reaches nudge from the bitcoin wallet alone", () => {
    expect(resolveBalanceTier(walletsWith(50_000, 0), THRESHOLDS)).toBe(
      TwoFactorTier.Nudge,
    )
  })

  it("reaches nudge from the dollar wallet alone", () => {
    expect(resolveBalanceTier(walletsWith(0, 5_000), THRESHOLDS)).toBe(
      TwoFactorTier.Nudge,
    )
  })

  it("never adds the wallets together", () => {
    expect(resolveBalanceTier(walletsWith(499_999, 49_999), THRESHOLDS)).toBe(
      TwoFactorTier.Nudge,
    )
  })

  it("reaches the reminder tier at 500,000 sats or $500", () => {
    expect(resolveBalanceTier(walletsWith(500_000, 0), THRESHOLDS)).toBe(
      TwoFactorTier.Reminder,
    )
    expect(resolveBalanceTier(walletsWith(0, 50_000), THRESHOLDS)).toBe(
      TwoFactorTier.Reminder,
    )
  })

  it("reaches the high-balance tier at 5,000,000 sats or $5,000", () => {
    expect(resolveBalanceTier(walletsWith(5_000_000, 0), THRESHOLDS)).toBe(
      TwoFactorTier.HighBalance,
    )
    expect(resolveBalanceTier(walletsWith(0, 500_000), THRESHOLDS)).toBe(
      TwoFactorTier.HighBalance,
    )
  })

  it("takes the highest tier either wallet reaches", () => {
    expect(resolveBalanceTier(walletsWith(50_000, 500_000), THRESHOLDS)).toBe(
      TwoFactorTier.HighBalance,
    )
  })

  /** The thresholds are configuration: whatever the console sets is where each tier
   *  starts, for both wallets alike. */
  it("starts each tier where the configured thresholds say", () => {
    const lowered = {
      ...THRESHOLDS,
      reminderSats: 400_000,
      highBalanceUsdCents: 300_000,
    }

    expect(resolveBalanceTier(walletsWith(450_000, 0), lowered)).toBe(
      TwoFactorTier.Reminder,
    )
    expect(resolveBalanceTier(walletsWith(0, 300_000), lowered)).toBe(
      TwoFactorTier.HighBalance,
    )
    expect(resolveHighBalanceCurrency(walletsWith(0, 300_000), lowered)).toBe(
      WalletCurrency.Usd,
    )
  })
})

describe("resolveHighBalanceCurrency", () => {
  it("names sats when the bitcoin wallet crossed the threshold", () => {
    expect(resolveHighBalanceCurrency(walletsWith(5_000_000, 0), THRESHOLDS)).toBe(
      WalletCurrency.Btc,
    )
  })

  it("names dollars when only the dollar wallet crossed it", () => {
    expect(resolveHighBalanceCurrency(walletsWith(4_999_999, 500_000), THRESHOLDS)).toBe(
      WalletCurrency.Usd,
    )
  })

  it("names sats when both wallets crossed it", () => {
    expect(resolveHighBalanceCurrency(walletsWith(5_000_000, 500_000), THRESHOLDS)).toBe(
      WalletCurrency.Btc,
    )
  })

  it("falls back to sats when neither has", () => {
    expect(resolveHighBalanceCurrency(walletsWith(0, 0), THRESHOLDS)).toBe(
      WalletCurrency.Btc,
    )
    expect(resolveHighBalanceCurrency(undefined, THRESHOLDS)).toBe(WalletCurrency.Btc)
  })
})

describe("withTierReached", () => {
  it("raises the tier and leaves the named wallet alone below the high-balance tier", () => {
    const record = withTierReached(
      recordWith({ highBalanceCurrency: WalletCurrency.Usd }),
      TwoFactorTier.Reminder,
      WalletCurrency.Btc,
    )

    expect(record.highestTier).toBe(TwoFactorTier.Reminder)
    expect(record.highBalanceCurrency).toBe(WalletCurrency.Usd)
  })

  it("remembers the wallet that crossed into the high-balance tier", () => {
    const record = withTierReached(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.HighBalance,
      WalletCurrency.Usd,
    )

    expect(record.highestTier).toBe(TwoFactorTier.HighBalance)
    expect(record.highBalanceCurrency).toBe(WalletCurrency.Usd)
  })
})

describe("resolveUnmetTier", () => {
  it("is none below the nudge tier", () => {
    expect(resolveUnmetTier({ tier: TwoFactorTier.None, hasAuthenticator: false })).toBe(
      TwoFactorTier.None,
    )
  })

  it("is the reached tier, whichever it is, while the account has no authenticator", () => {
    expect(resolveUnmetTier({ tier: TwoFactorTier.Nudge, hasAuthenticator: false })).toBe(
      TwoFactorTier.Nudge,
    )
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Reminder, hasAuthenticator: false }),
    ).toBe(TwoFactorTier.Reminder)
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.HighBalance, hasAuthenticator: false }),
    ).toBe(TwoFactorTier.HighBalance)
  })

  it("is none at every tier once the account holds an authenticator", () => {
    expect(resolveUnmetTier({ tier: TwoFactorTier.Nudge, hasAuthenticator: true })).toBe(
      TwoFactorTier.None,
    )
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Reminder, hasAuthenticator: true }),
    ).toBe(TwoFactorTier.None)
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.HighBalance, hasAuthenticator: true }),
    ).toBe(TwoFactorTier.None)
  })
})

describe("dismissals", () => {
  it("allows three per tier", () => {
    expect(
      remainingDismissals(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Reminder),
    ).toBe(3)
    expect(
      remainingDismissals(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.HighBalance),
    ).toBe(3)
  })

  it("counts the reminder tier's dismissals on their own counter", () => {
    const record = withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Reminder)

    expect(record.requiredDismissals).toBe(1)
    expect(record.authenticatorDismissals).toBe(0)
    expect(remainingDismissals(record, TwoFactorTier.Reminder)).toBe(2)
    expect(remainingDismissals(record, TwoFactorTier.HighBalance)).toBe(3)
  })

  it("counts the high-balance tier's dismissals on their own counter", () => {
    const record = withDismissal(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.HighBalance,
    )

    expect(record.authenticatorDismissals).toBe(1)
    expect(record.requiredDismissals).toBe(0)
  })

  it("leaves the record untouched for tiers that never prompt at session start", () => {
    expect(withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Nudge)).toBe(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
    expect(withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.None)).toBe(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  it("never reports fewer than zero remaining", () => {
    expect(
      remainingDismissals(recordWith({ requiredDismissals: 5 }), TwoFactorTier.Reminder),
    ).toBe(0)
  })
})

describe("resolveSessionPrompt", () => {
  it("owes nothing below the reminder tier", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Nudge,
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

  it("owes the modal at the reminder tier while dismissals remain", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Reminder,
        record: recordWith({ requiredDismissals: 2 }),
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the protection screen at the reminder tier once dismissals are spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Reminder,
        record: recordWith({ requiredDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.ProtectionRequired)
  })

  it("owes the protection screen at the high-balance tier from the first session", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.HighBalance,
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
      highestTier: TwoFactorTier.HighBalance,
      highBalanceCurrency: WalletCurrency.Usd,
      nudgeCardDismissed: true,
      requiredDismissals: 2,
      authenticatorDismissals: 1,
    }

    expect(normalizeStoredRecord(record)).toEqual(record)
  })

  it("starts the fields a record from before they existed at their defaults", () => {
    expect(
      normalizeStoredRecord({
        highestTier: TwoFactorTier.Reminder,
        nudgeCardDismissed: true,
      }),
    ).toEqual(
      recordWith({ highestTier: TwoFactorTier.Reminder, nudgeCardDismissed: true }),
    )
  })

  it("drops a tier this build does not know", () => {
    expect(normalizeStoredRecord({ highestTier: 7 })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  it("drops a wallet currency this build does not know", () => {
    expect(
      normalizeStoredRecord({ highBalanceCurrency: "EUR" as WalletCurrency }),
    ).toEqual(DEFAULT_TWO_FACTOR_ENFORCEMENT)
  })

  it("drops a counter that is not a whole, non-negative number", () => {
    expect(
      normalizeStoredRecord({ requiredDismissals: -1, authenticatorDismissals: 1.5 }),
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
