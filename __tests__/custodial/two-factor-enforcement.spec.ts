import { defaultTwoFactorThresholds } from "@app/config/feature-flags-context"
import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  isAboveAllTimeHigh,
  isUsableThresholdSet,
  normalizeStoredRecord,
  quotedHighBalanceThreshold,
  remainingDismissals,
  resolveBalanceTier,
  resolveHighBalanceCrossing,
  resolveReminderReason,
  resolveSessionPrompt,
  resolveUnmetTier,
  withAllTimeHigh,
  withDismissal,
  withSessionStartHigh,
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

describe("isUsableThresholdSet", () => {
  it("takes the shipped set", () => {
    expect(isUsableThresholdSet(THRESHOLDS)).toBe(true)
  })

  /** A tier reached never lowers, so a higher tier set below a lower one would keep
   *  accounts escalated after the console is fixed. */
  it("refuses a set whose bitcoin tiers do not rise", () => {
    expect(isUsableThresholdSet({ ...THRESHOLDS, highBalanceSats: 400_000 })).toBe(false)
  })

  it("refuses a set whose dollar tiers do not rise", () => {
    expect(isUsableThresholdSet({ ...THRESHOLDS, nudgeUsdCents: 60_000 })).toBe(false)
  })

  /** Sats and cents have no fractions, and a crossed threshold is kept as one. */
  it("refuses a set that holds a fraction of a sat or a cent", () => {
    expect(isUsableThresholdSet({ ...THRESHOLDS, highBalanceUsdCents: 250_000.5 })).toBe(
      false,
    )
  })
})

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
    expect(resolveHighBalanceCrossing(walletsWith(0, 300_000), lowered)).toEqual({
      currency: WalletCurrency.Usd,
      threshold: 300_000,
    })
  })
})

describe("resolveHighBalanceCrossing", () => {
  const SATS_CROSSING = {
    currency: WalletCurrency.Btc,
    threshold: THRESHOLDS.highBalanceSats,
  }

  it("names sats and their threshold when the bitcoin wallet crossed it", () => {
    expect(resolveHighBalanceCrossing(walletsWith(5_000_000, 0), THRESHOLDS)).toEqual(
      SATS_CROSSING,
    )
  })

  it("names dollars and their threshold when only the dollar wallet crossed it", () => {
    expect(
      resolveHighBalanceCrossing(walletsWith(4_999_999, 500_000), THRESHOLDS),
    ).toEqual({ currency: WalletCurrency.Usd, threshold: THRESHOLDS.highBalanceUsdCents })
  })

  it("names sats when both wallets crossed it", () => {
    expect(
      resolveHighBalanceCrossing(walletsWith(5_000_000, 500_000), THRESHOLDS),
    ).toEqual(SATS_CROSSING)
  })

  it("falls back to sats when neither has", () => {
    expect(resolveHighBalanceCrossing(walletsWith(0, 0), THRESHOLDS)).toEqual(
      SATS_CROSSING,
    )
    expect(resolveHighBalanceCrossing(undefined, THRESHOLDS)).toEqual(SATS_CROSSING)
  })
})

describe("withTierReached", () => {
  const USD_CROSSING = { currency: WalletCurrency.Usd, threshold: 500_000 }

  it("raises the tier and leaves the crossing alone below the high-balance tier", () => {
    const record = withTierReached(
      recordWith({ highBalanceCurrency: WalletCurrency.Usd, highBalanceThreshold: 0 }),
      TwoFactorTier.Reminder,
      { currency: WalletCurrency.Btc, threshold: 5_000_000 },
    )

    expect(record.highestTier).toBe(TwoFactorTier.Reminder)
    expect(record.highBalanceCurrency).toBe(WalletCurrency.Usd)
    expect(record.highBalanceThreshold).toBe(0)
  })

  it("remembers the wallet that crossed into the high-balance tier and its threshold", () => {
    const record = withTierReached(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.HighBalance,
      USD_CROSSING,
    )

    expect(record.highestTier).toBe(TwoFactorTier.HighBalance)
    expect(record.highBalanceCurrency).toBe(WalletCurrency.Usd)
    expect(record.highBalanceThreshold).toBe(500_000)
  })
})

describe("quotedHighBalanceThreshold", () => {
  /** The console can move the threshold after the account crossed it; the tier stays,
   *  so the copy keeps quoting the amount that raised it. */
  it("quotes the threshold the account crossed, not the one configured now", () => {
    const raised = { ...THRESHOLDS, highBalanceSats: 8_000_000 }

    expect(
      quotedHighBalanceThreshold(recordWith({ highBalanceThreshold: 5_000_000 }), raised),
    ).toBe(5_000_000)
  })

  it("quotes the configured sats for a record from before the crossing was kept", () => {
    expect(quotedHighBalanceThreshold(DEFAULT_TWO_FACTOR_ENFORCEMENT, THRESHOLDS)).toBe(
      THRESHOLDS.highBalanceSats,
    )
  })

  it("quotes the configured dollars when such a record names the dollar wallet", () => {
    expect(
      quotedHighBalanceThreshold(
        recordWith({ highBalanceCurrency: WalletCurrency.Usd }),
        THRESHOLDS,
      ),
    ).toBe(THRESHOLDS.highBalanceUsdCents)
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

  /** The close that settles the new high its bulletin was brought back for. */
  it("settles a pending new high with a reminder dismissal, and only with one", () => {
    const pending = recordWith({ requiredDismissals: 3, isNewHighPending: true })

    expect(withDismissal(pending, TwoFactorTier.Reminder).isNewHighPending).toBe(false)
    expect(withDismissal(pending, TwoFactorTier.HighBalance).isNewHighPending).toBe(true)
  })

  it("counts the high-balance tier's dismissals on their own counter", () => {
    const record = withDismissal(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
      TwoFactorTier.HighBalance,
    )

    expect(record.authenticatorDismissals).toBe(1)
    expect(record.requiredDismissals).toBe(0)
  })

  it("leaves the record untouched for the tiers that count no dismissal", () => {
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

  /** The reminder tier reminds on the home and never blocks. */
  it("owes nothing at the reminder tier, with or without dismissals left", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Reminder,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Reminder,
        record: recordWith({ requiredDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.None)
  })

  it("owes the modal at the high-balance tier while dismissals remain", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.HighBalance,
        record: recordWith({ authenticatorDismissals: 2 }),
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the modal at the high-balance tier however many reminder dismissals were spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.HighBalance,
        record: recordWith({ requiredDismissals: 3 }),
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the blocking screen at the high-balance tier once dismissals are spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.HighBalance,
        record: recordWith({ authenticatorDismissals: 3 }),
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

  it("leaves a new high pending when a session start owing the reminder tier finds one", () => {
    expect(
      withSessionStartHigh(highs, walletsWith(900_000, 0), TwoFactorTier.Reminder),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: true })
  })

  it("keeps a new high pending from an earlier session while the reminder tier is owed", () => {
    const pending = recordWith({ highestSats: 900_000, isNewHighPending: true })

    expect(
      withSessionStartHigh(pending, walletsWith(800_000, 0), TwoFactorTier.Reminder),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: true })
  })

  /** An authenticator added from the bulletin's setup counts no dismissal, so the
   *  pending high would otherwise outlive it. */
  it("settles a pending new high once the account owes the reminder tier no longer", () => {
    const pending = recordWith({ highestSats: 900_000, isNewHighPending: true })

    expect(
      withSessionStartHigh(pending, walletsWith(900_000, 0), TwoFactorTier.None),
    ).toMatchObject({ isNewHighPending: false })
  })

  /** A record from before the highs were kept has nothing to measure against. */
  it("seeds a record with no highs yet, finding no new high in it", () => {
    expect(
      withSessionStartHigh(
        DEFAULT_TWO_FACTOR_ENFORCEMENT,
        walletsWith(600_000, 40_000),
        TwoFactorTier.Reminder,
      ),
    ).toMatchObject({
      highestSats: 600_000,
      highestUsdCents: 40_000,
      isNewHighPending: false,
    })
  })

  /** Below the tier, or with an authenticator, there is no bulletin to remind of it. */
  it("only raises the highs when the reminder tier is not owed", () => {
    expect(
      withSessionStartHigh(highs, walletsWith(900_000, 0), TwoFactorTier.Nudge),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: false })
    expect(
      withSessionStartHigh(highs, walletsWith(900_000, 0), TwoFactorTier.None),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: false })
  })
})

describe("resolveReminderReason", () => {
  it("is due for the first sessions at the reminder tier while its dismissals last", () => {
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Reminder,
        record: recordWith({ requiredDismissals: 2 }),
      }),
    ).toBe(TwoFactorReminderReason.FirstSessions)
  })

  it("is due again only while a new all-time high is pending once its dismissals are spent", () => {
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Reminder,
        record: recordWith({ requiredDismissals: 3, isNewHighPending: true }),
      }),
    ).toBe(TwoFactorReminderReason.NewAllTimeHigh)
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Reminder,
        record: recordWith({ requiredDismissals: 3 }),
      }),
    ).toBeNull()
  })

  it("is never due away from the reminder tier", () => {
    const pending = recordWith({ isNewHighPending: true })

    expect(
      resolveReminderReason({ unmetTier: TwoFactorTier.Nudge, record: pending }),
    ).toBeNull()
    expect(
      resolveReminderReason({ unmetTier: TwoFactorTier.HighBalance, record: pending }),
    ).toBeNull()
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
      highestSats: 800_000,
      highestUsdCents: 60_000,
      highBalanceThreshold: 500_000,
      isNewHighPending: true,
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

  /** A record from before the highs were kept starts them at zero, so the first
   *  session start at the reminder tier reads every wallet as a new high. */
  it("drops an all-time high that is not a whole, non-negative balance", () => {
    expect(normalizeStoredRecord({ highestSats: -5, highestUsdCents: "60" })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  /** Dropped, the copy quotes the threshold configured now instead. */
  it("drops a crossed threshold that is not a whole, non-negative amount", () => {
    expect(normalizeStoredRecord({ highBalanceThreshold: 2.5 })).toEqual(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  it("only reads a pending new high that is exactly true", () => {
    expect(normalizeStoredRecord({ isNewHighPending: "true" }).isNewHighPending).toBe(
      false,
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
