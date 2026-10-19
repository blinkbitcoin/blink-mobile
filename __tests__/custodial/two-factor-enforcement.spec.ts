import { defaultTwoFactorThresholds } from "@app/config/feature-flags-context"
import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  isAboveAllTimeHigh,
  normalizeStoredRecord,
  quotedEnforcedThreshold,
  remainingDismissals,
  resolveBalanceTier,
  resolveEnforcedCrossing,
  resolveReminderReason,
  resolveSessionPrompt,
  resolveUnmetTier,
  withAllTimeHigh,
  withDismissal,
  withTierReached,
} from "@app/custodial/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import {
  TwoFactorEnforcementRecord,
  TwoFactorReminderReason,
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
      TwoFactorTier.Suggested,
    )
  })

  it("reaches nudge from the dollar wallet alone", () => {
    expect(resolveBalanceTier(walletsWith(0, 5_000), THRESHOLDS)).toBe(
      TwoFactorTier.Suggested,
    )
  })

  it("never adds the wallets together", () => {
    expect(resolveBalanceTier(walletsWith(499_999, 49_999), THRESHOLDS)).toBe(
      TwoFactorTier.Suggested,
    )
  })

  it("reaches the recommended tier at 500,000 sats or $500", () => {
    expect(resolveBalanceTier(walletsWith(500_000, 0), THRESHOLDS)).toBe(
      TwoFactorTier.Recommended,
    )
    expect(resolveBalanceTier(walletsWith(0, 50_000), THRESHOLDS)).toBe(
      TwoFactorTier.Recommended,
    )
  })

  it("reaches the enforced tier at 5,000,000 sats or $5,000", () => {
    expect(resolveBalanceTier(walletsWith(5_000_000, 0), THRESHOLDS)).toBe(
      TwoFactorTier.Enforced,
    )
    expect(resolveBalanceTier(walletsWith(0, 500_000), THRESHOLDS)).toBe(
      TwoFactorTier.Enforced,
    )
  })

  it("takes the highest tier either wallet reaches", () => {
    expect(resolveBalanceTier(walletsWith(50_000, 500_000), THRESHOLDS)).toBe(
      TwoFactorTier.Enforced,
    )
  })

  /** The thresholds are configuration: whatever the console sets is where each tier
   *  starts, for both wallets alike. */
  it("starts each tier where the configured thresholds say", () => {
    const lowered = {
      ...THRESHOLDS,
      recommendedSats: 400_000,
      enforcedUsdCents: 300_000,
    }

    expect(resolveBalanceTier(walletsWith(450_000, 0), lowered)).toBe(
      TwoFactorTier.Recommended,
    )
    expect(resolveBalanceTier(walletsWith(0, 300_000), lowered)).toBe(
      TwoFactorTier.Enforced,
    )
    expect(resolveEnforcedCrossing(walletsWith(0, 300_000), lowered)).toEqual({
      currency: WalletCurrency.Usd,
      threshold: 300_000,
    })
  })
})

describe("resolveEnforcedCrossing", () => {
  const SATS_CROSSING = {
    currency: WalletCurrency.Btc,
    threshold: THRESHOLDS.enforcedSats,
  }

  it("names sats and their threshold when the bitcoin wallet crossed it", () => {
    expect(resolveEnforcedCrossing(walletsWith(5_000_000, 0), THRESHOLDS)).toEqual(
      SATS_CROSSING,
    )
  })

  it("names dollars and their threshold when only the dollar wallet crossed it", () => {
    expect(resolveEnforcedCrossing(walletsWith(4_999_999, 500_000), THRESHOLDS)).toEqual({
      currency: WalletCurrency.Usd,
      threshold: THRESHOLDS.enforcedUsdCents,
    })
  })

  it("names sats when both wallets crossed it", () => {
    expect(resolveEnforcedCrossing(walletsWith(5_000_000, 500_000), THRESHOLDS)).toEqual(
      SATS_CROSSING,
    )
  })

  it("falls back to sats when neither has", () => {
    expect(resolveEnforcedCrossing(walletsWith(0, 0), THRESHOLDS)).toEqual(SATS_CROSSING)
    expect(resolveEnforcedCrossing(undefined, THRESHOLDS)).toEqual(SATS_CROSSING)
  })
})

describe("withTierReached", () => {
  const USD_CROSSING = { currency: WalletCurrency.Usd, threshold: 500_000 }

  it("raises the tier and leaves the crossing alone below the enforced tier", () => {
    const record = withTierReached(
      recordWith({ enforcedCurrency: WalletCurrency.Usd, enforcedThreshold: 0 }),
      TwoFactorTier.Recommended,
      { currency: WalletCurrency.Btc, threshold: 5_000_000 },
    )

    expect(record.highestTier).toBe(TwoFactorTier.Recommended)
    expect(record.enforcedCurrency).toBe(WalletCurrency.Usd)
    expect(record.enforcedThreshold).toBe(0)
  })

  it("remembers the wallet that crossed into the enforced tier and its threshold", () => {
    const record = withTierReached(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.Enforced,
      USD_CROSSING,
    )

    expect(record.highestTier).toBe(TwoFactorTier.Enforced)
    expect(record.enforcedCurrency).toBe(WalletCurrency.Usd)
    expect(record.enforcedThreshold).toBe(500_000)
  })
})

describe("quotedEnforcedThreshold", () => {
  /** The console can move the threshold after the account crossed it; the tier stays,
   *  so the copy keeps quoting the amount that raised it. */
  it("quotes the threshold the account crossed, not the one configured now", () => {
    const raised = { ...THRESHOLDS, enforcedSats: 8_000_000 }

    expect(
      quotedEnforcedThreshold(recordWith({ enforcedThreshold: 5_000_000 }), raised),
    ).toBe(5_000_000)
  })

  it("quotes the configured sats for a record from before the crossing was kept", () => {
    expect(quotedEnforcedThreshold(DEFAULT_TWO_FACTOR_ENFORCEMENT, THRESHOLDS)).toBe(
      THRESHOLDS.enforcedSats,
    )
  })

  it("quotes the configured dollars when such a record names the dollar wallet", () => {
    expect(
      quotedEnforcedThreshold(
        recordWith({ enforcedCurrency: WalletCurrency.Usd }),
        THRESHOLDS,
      ),
    ).toBe(THRESHOLDS.enforcedUsdCents)
  })
})

describe("resolveUnmetTier", () => {
  it("is none below the suggested tier", () => {
    expect(resolveUnmetTier({ tier: TwoFactorTier.None, hasAuthenticator: false })).toBe(
      TwoFactorTier.None,
    )
  })

  it("is the reached tier, whichever it is, while the account has no authenticator", () => {
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Suggested, hasAuthenticator: false }),
    ).toBe(TwoFactorTier.Suggested)
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Recommended, hasAuthenticator: false }),
    ).toBe(TwoFactorTier.Recommended)
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Enforced, hasAuthenticator: false }),
    ).toBe(TwoFactorTier.Enforced)
  })

  it("is none at every tier once the account holds an authenticator", () => {
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Suggested, hasAuthenticator: true }),
    ).toBe(TwoFactorTier.None)
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Recommended, hasAuthenticator: true }),
    ).toBe(TwoFactorTier.None)
    expect(
      resolveUnmetTier({ tier: TwoFactorTier.Enforced, hasAuthenticator: true }),
    ).toBe(TwoFactorTier.None)
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

  /** The recommended tier reminds on the home and never blocks. */
  it("owes nothing at the recommended tier, with or without dismissals left", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.None)
  })

  it("owes the modal at the enforced tier while dismissals remain", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ enforcedDismissals: 2 }),
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the modal at the enforced tier however many reminder dismissals were spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ recommendedDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the blocking screen at the enforced tier once dismissals are spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ enforcedDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.ProtectionRequired)
  })
})

describe("all-time highs", () => {
  const highs = recordWith({ highestSats: 800_000, highestUsdCents: 60_000 })

  it("finds a wallet above its all-time high, each in its own unit", () => {
    expect(isAboveAllTimeHigh(highs, walletsWith(800_001, 0))).toBe(true)
    expect(isAboveAllTimeHigh(highs, walletsWith(0, 60_001))).toBe(true)
  })

  it("finds nothing above a high that was only reached, or not at all", () => {
    expect(isAboveAllTimeHigh(highs, walletsWith(800_000, 60_000))).toBe(false)
    expect(isAboveAllTimeHigh(highs, walletsWith(100, 100))).toBe(false)
    expect(isAboveAllTimeHigh(highs, undefined)).toBe(false)
  })

  it("raises each high to its wallet's balance only where the balance is above it", () => {
    expect(withAllTimeHigh(highs, walletsWith(900_000, 10_000))).toMatchObject({
      highestSats: 900_000,
      highestUsdCents: 60_000,
    })
  })
})

describe("resolveReminderReason", () => {
  it("is due for the first sessions at the recommended tier while its dismissals last", () => {
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 2 }),
        hasNewAllTimeHigh: false,
      }),
    ).toBe(TwoFactorReminderReason.FirstSessions)
  })

  it("is due again only at a new all-time high once its dismissals are spent", () => {
    const spent = recordWith({ recommendedDismissals: 3 })

    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Recommended,
        record: spent,
        hasNewAllTimeHigh: true,
      }),
    ).toBe(TwoFactorReminderReason.NewAllTimeHigh)
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Recommended,
        record: spent,
        hasNewAllTimeHigh: false,
      }),
    ).toBeNull()
  })

  it("is never due away from the recommended tier", () => {
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Suggested,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
        hasNewAllTimeHigh: true,
      }),
    ).toBeNull()
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Enforced,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
        hasNewAllTimeHigh: true,
      }),
    ).toBeNull()
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
      highestSats: 800_000,
      highestUsdCents: 60_000,
      enforcedThreshold: 500_000,
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

  /** A record from before the highs were kept starts them at zero, so the first
   *  session start at the recommended tier reads every wallet as a new high. */
  it("drops an all-time high that is not a whole, non-negative balance", () => {
    expect(normalizeStoredRecord({ highestSats: -5, highestUsdCents: "60" })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  /** Dropped, the copy quotes the threshold configured now instead. */
  it("drops a crossed threshold that is not a whole, non-negative amount", () => {
    expect(normalizeStoredRecord({ enforcedThreshold: 2.5 })).toEqual(
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
