import { defaultTwoFactorThresholds } from "@app/config/feature-flags-context"
import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  isAboveAllTimeHigh,
  isHoldingEnforcedThreshold,
  isSessionStartHighChange,
  isUsableThresholdSet,
  normalizeStoredRecord,
  remainingDismissals,
  resolveBalanceTier,
  resolveEnforcedCrossing,
  resolveReminderReason,
  resolveSessionPrompt,
  resolveUnmetTier,
  thresholdsFromConsole,
  toWalletThresholds,
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
  const isUsable = (thresholds: typeof THRESHOLDS) =>
    isUsableThresholdSet(thresholds, THRESHOLDS)

  it("takes the shipped set", () => {
    expect(isUsable(THRESHOLDS)).toBe(true)
  })

  /** A tier reached never lowers, so a higher tier set below a lower one would keep
   *  accounts escalated after the console is fixed. */
  it("refuses a set whose bitcoin tiers do not rise", () => {
    expect(isUsable({ ...THRESHOLDS, enforcedSats: 400_000 })).toBe(false)
  })

  it("refuses a set whose dollar tiers do not rise", () => {
    expect(isUsable({ ...THRESHOLDS, suggestedUsdCents: 60_000 })).toBe(false)
  })

  /** Equal thresholds leave the lower tier unreachable: the higher one is found first. */
  it("refuses a set where two tiers start at the same balance", () => {
    expect(isUsable({ ...THRESHOLDS, recommendedSats: THRESHOLDS.enforcedSats })).toBe(
      false,
    )
    expect(
      isUsable({ ...THRESHOLDS, recommendedUsdCents: THRESHOLDS.enforcedUsdCents }),
    ).toBe(false)
    expect(isUsable({ ...THRESHOLDS, suggestedSats: THRESHOLDS.recommendedSats })).toBe(
      false,
    )
    expect(
      isUsable({ ...THRESHOLDS, suggestedUsdCents: THRESHOLDS.recommendedUsdCents }),
    ).toBe(false)
  })

  it("takes a set moved within a factor of ten of the shipped one", () => {
    expect(
      isUsable({
        suggestedSats: 5_000,
        suggestedUsdCents: 500,
        recommendedSats: 400_000,
        recommendedUsdCents: 40_000,
        enforcedSats: 50_000_000,
        enforcedUsdCents: 5_000_000,
      }),
    ).toBe(true)
  })

  /** Read as dollars, cents rise tier by tier like any set, and would raise every
   *  account above $50 to the enforced tier for good. */
  it("refuses a set that reads cents as dollars", () => {
    expect(
      isUsable({
        ...THRESHOLDS,
        suggestedUsdCents: 50,
        recommendedUsdCents: 500,
        enforcedUsdCents: 5_000,
      }),
    ).toBe(false)
  })

  it("refuses a threshold below a tenth of its default, or above ten times it", () => {
    expect(isUsable({ ...THRESHOLDS, suggestedSats: 4_999 })).toBe(false)
    expect(isUsable({ ...THRESHOLDS, enforcedSats: 50_000_001 })).toBe(false)
  })

  it("refuses a zero or a negative threshold", () => {
    expect(isUsable({ ...THRESHOLDS, suggestedSats: 0 })).toBe(false)
    expect(isUsable({ ...THRESHOLDS, suggestedUsdCents: -1 })).toBe(false)
  })
})

describe("thresholdsFromConsole", () => {
  const CONSOLE = {
    suggestedSats: 50_000,
    suggestedUsd: 50,
    recommendedSats: 500_000,
    recommendedUsd: 500,
    enforcedSats: 5_000_000,
    enforcedUsd: 5_000,
  }

  it("reads the dollars the console writes as the cents the dollar wallet reports", () => {
    expect(thresholdsFromConsole(CONSOLE)).toEqual(THRESHOLDS)
    expect(toWalletThresholds(CONSOLE)).toEqual(THRESHOLDS)
  })

  /** A set is only usable whole: filling the gap with a default would mix two sets. */
  it("reads nothing from a set with a key missing or misspelled", () => {
    const { enforcedUsd, ...missing } = CONSOLE
    expect(enforcedUsd).toBe(5_000)
    expect(thresholdsFromConsole(missing)).toBeNull()
    expect(thresholdsFromConsole({ ...missing, enforcedUSD: 5_000 })).toBeNull()
  })

  it("reads nothing from a set whose dollars or sats are not whole", () => {
    expect(thresholdsFromConsole({ ...CONSOLE, enforcedUsd: 4_999.5 })).toBeNull()
    expect(thresholdsFromConsole({ ...CONSOLE, suggestedSats: 50_000.5 })).toBeNull()
  })

  it("reads nothing from a set that holds something other than a number", () => {
    expect(thresholdsFromConsole({ ...CONSOLE, recommendedSats: "500000" })).toBeNull()
    expect(thresholdsFromConsole({ ...CONSOLE, recommendedUsd: null })).toBeNull()
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

describe("isHoldingEnforcedThreshold", () => {
  const SATS_CROSSED = recordWith({ enforcedThreshold: 5_000_000 })
  const USD_CROSSED = recordWith({
    enforcedCurrency: WalletCurrency.Usd,
    enforcedThreshold: 500_000,
  })

  it("holds while the wallet that crossed is at or above the threshold it crossed", () => {
    expect(isHoldingEnforcedThreshold(SATS_CROSSED, walletsWith(5_000_000, 0))).toBe(true)
    expect(isHoldingEnforcedThreshold(USD_CROSSED, walletsWith(0, 600_000))).toBe(true)
  })

  /** The tier stays once reached; the balance the copy would state does not. */
  it("no longer holds once that wallet fell below it", () => {
    expect(isHoldingEnforcedThreshold(SATS_CROSSED, walletsWith(4_999_999, 0))).toBe(
      false,
    )
    expect(isHoldingEnforcedThreshold(USD_CROSSED, walletsWith(0, 499_999))).toBe(false)
  })

  /** A record with no crossed threshold kept has no amount to state. */
  it("does not hold a threshold the record never kept", () => {
    expect(isHoldingEnforcedThreshold(recordWith({}), walletsWith(9_000_000, 0))).toBe(
      false,
    )
  })

  it("measures only the wallet that crossed", () => {
    expect(isHoldingEnforcedThreshold(USD_CROSSED, walletsWith(9_000_000, 0))).toBe(false)
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

  /** The close that settles the new high its bulletin was brought back for. */
  it("settles a pending new high with a reminder dismissal, and only with one", () => {
    const pending = recordWith({ recommendedDismissals: 3, isNewHighPending: true })

    expect(withDismissal(pending, TwoFactorTier.Recommended).isNewHighPending).toBe(false)
    expect(withDismissal(pending, TwoFactorTier.Enforced).isNewHighPending).toBe(true)
  })

  it("counts the enforced tier's dismissals on their own counter", () => {
    const record = withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Enforced)

    expect(record.enforcedDismissals).toBe(1)
    expect(record.recommendedDismissals).toBe(0)
  })

  it("leaves the record untouched for the tiers that count no dismissal", () => {
    expect(withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.Suggested)).toBe(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
    expect(withDismissal(DEFAULT_TWO_FACTOR_ENFORCEMENT, TwoFactorTier.None)).toBe(
      DEFAULT_TWO_FACTOR_ENFORCEMENT,
    )
  })

  /** The modal stays dismissible while leaving custody is switched off, past the
   *  allowance: what it counts must not run past it. */
  it("never counts past the tier's allowance, handing the same record back", () => {
    const spent = recordWith({ recommendedDismissals: 3, enforcedDismissals: 3 })

    expect(withDismissal(spent, TwoFactorTier.Enforced)).toBe(spent)
    expect(withDismissal(spent, TwoFactorTier.Recommended)).toBe(spent)
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
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.None,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
  })

  /** The recommended tier reminds on the home and never blocks. */
  it("owes nothing at the recommended tier, with or without dismissals left", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 3 }),
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
  })

  it("owes the modal at the enforced tier while dismissals remain", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ enforcedDismissals: 2 }),
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the modal at the enforced tier however many reminder dismissals were spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ recommendedDismissals: 3 }),
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes the blocking screen at the enforced tier once dismissals are spent", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ enforcedDismissals: 3 }),
        isCustodyExitOffered: true,
      }),
    ).toBe(TwoFactorSessionPrompt.ProtectionRequired)
  })

  /** The blocking screen's other way forward is gone: a wall with one door would hold
   *  an account without an authenticator app. */
  it("keeps the modal once dismissals are spent while leaving custody is not on offer", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Enforced,
        record: recordWith({ enforcedDismissals: 3 }),
        isCustodyExitOffered: false,
      }),
    ).toBe(TwoFactorSessionPrompt.SessionModal)
  })

  it("owes nothing below the enforced tier while leaving custody is not on offer", () => {
    expect(
      resolveSessionPrompt({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 3 }),
        isCustodyExitOffered: false,
      }),
    ).toBe(TwoFactorSessionPrompt.None)
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

  /** A conversion moves funds between the wallets and adds none. */
  it("reads no new high from a rise in one wallet while the other fell since the last session start", () => {
    const lastSession = recordWith({
      highestSats: 800_000,
      highestUsdCents: 0,
      lastSessionSats: 800_000,
      lastSessionUsdCents: 0,
    })

    expect(isAboveAllTimeHigh(lastSession, walletsWith(600_000, 20_000))).toBe(false)
    expect(
      isAboveAllTimeHigh(
        recordWith({
          ...lastSession,
          lastSessionUsdCents: 30_000,
          highestUsdCents: 30_000,
        }),
        walletsWith(900_000, 10_000),
      ),
    ).toBe(false)
  })

  it("reads a new high from a rise in one wallet while the other held or rose", () => {
    const lastSession = recordWith({
      highestSats: 800_000,
      highestUsdCents: 20_000,
      lastSessionSats: 700_000,
      lastSessionUsdCents: 20_000,
    })

    expect(isAboveAllTimeHigh(lastSession, walletsWith(900_000, 20_000))).toBe(true)
    expect(isAboveAllTimeHigh(lastSession, walletsWith(700_000, 30_000))).toBe(true)
  })

  it("raises each high to its wallet's balance only where the balance is above it", () => {
    expect(withAllTimeHigh(highs, walletsWith(900_000, 10_000))).toMatchObject({
      highestSats: 900_000,
      highestUsdCents: 60_000,
    })
  })

  it("leaves a new high pending when a session start owing the recommended tier finds one", () => {
    expect(
      withSessionStartHigh(highs, walletsWith(900_000, 0), TwoFactorTier.Recommended),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: true })
  })

  it("keeps the balances it read for the next session start", () => {
    expect(
      withSessionStartHigh(
        highs,
        walletsWith(700_000, 50_000),
        TwoFactorTier.Recommended,
      ),
    ).toMatchObject({ lastSessionSats: 700_000, lastSessionUsdCents: 50_000 })
  })

  it("raises the high a conversion reached without leaving a new high pending", () => {
    const converted = recordWith({
      highestSats: 800_000,
      highestUsdCents: 0,
      lastSessionSats: 800_000,
      lastSessionUsdCents: 0,
    })

    expect(
      withSessionStartHigh(
        converted,
        walletsWith(600_000, 20_000),
        TwoFactorTier.Recommended,
      ),
    ).toMatchObject({
      highestSats: 800_000,
      highestUsdCents: 20_000,
      lastSessionSats: 600_000,
      lastSessionUsdCents: 20_000,
      isNewHighPending: false,
    })
  })

  it("keeps a new high pending from an earlier session while the recommended tier is owed", () => {
    const pending = recordWith({ highestSats: 900_000, isNewHighPending: true })

    expect(
      withSessionStartHigh(pending, walletsWith(800_000, 0), TwoFactorTier.Recommended),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: true })
  })

  /** An authenticator added from the bulletin's setup counts no dismissal, so the
   *  pending high would otherwise outlive it. */
  it("settles a pending new high once the account owes the recommended tier no longer", () => {
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
        TwoFactorTier.Recommended,
      ),
    ).toMatchObject({
      highestSats: 600_000,
      highestUsdCents: 40_000,
      isNewHighPending: false,
    })
  })

  /** Below the tier, or with an authenticator, there is no bulletin to remind of it. */
  it("only raises the highs when the recommended tier is not owed", () => {
    expect(
      withSessionStartHigh(highs, walletsWith(900_000, 0), TwoFactorTier.Suggested),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: false })
    expect(
      withSessionStartHigh(highs, walletsWith(900_000, 0), TwoFactorTier.None),
    ).toMatchObject({ highestSats: 900_000, isNewHighPending: false })
  })
})

describe("isSessionStartHighChange", () => {
  const read = recordWith({
    highestSats: 800_000,
    highestUsdCents: 60_000,
    lastSessionSats: 700_000,
    lastSessionUsdCents: 60_000,
  })

  it("changes nothing when the balances are the ones the last session start kept", () => {
    expect(
      isSessionStartHighChange(
        read,
        walletsWith(700_000, 60_000),
        TwoFactorTier.Recommended,
      ),
    ).toBe(false)
  })

  it("changes the record for a wallet above its high, whatever moved it", () => {
    expect(
      isSessionStartHighChange(read, walletsWith(900_000, 0), TwoFactorTier.Recommended),
    ).toBe(true)
  })

  it("changes the record when the balances moved below the highs", () => {
    expect(
      isSessionStartHighChange(
        read,
        walletsWith(600_000, 60_000),
        TwoFactorTier.Recommended,
      ),
    ).toBe(true)
  })

  it("changes the record to settle a pending new high the account no longer owes", () => {
    const pending = recordWith({ ...read, isNewHighPending: true })

    expect(
      isSessionStartHighChange(pending, walletsWith(700_000, 60_000), TwoFactorTier.None),
    ).toBe(true)
    expect(
      isSessionStartHighChange(
        pending,
        walletsWith(700_000, 60_000),
        TwoFactorTier.Recommended,
      ),
    ).toBe(false)
  })
})

describe("resolveReminderReason", () => {
  it("is due for the first sessions at the recommended tier while its dismissals last", () => {
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 2 }),
      }),
    ).toBe(TwoFactorReminderReason.FirstSessions)
  })

  it("is due again only while a new all-time high is pending once its dismissals are spent", () => {
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 3, isNewHighPending: true }),
      }),
    ).toBe(TwoFactorReminderReason.NewAllTimeHigh)
    expect(
      resolveReminderReason({
        unmetTier: TwoFactorTier.Recommended,
        record: recordWith({ recommendedDismissals: 3 }),
      }),
    ).toBeNull()
  })

  it("is never due away from the recommended tier", () => {
    const pending = recordWith({ isNewHighPending: true })

    expect(
      resolveReminderReason({ unmetTier: TwoFactorTier.Suggested, record: pending }),
    ).toBeNull()
    expect(
      resolveReminderReason({ unmetTier: TwoFactorTier.Enforced, record: pending }),
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
      lastSessionSats: 700_000,
      lastSessionUsdCents: 50_000,
      isNewHighPending: true,
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

  it("drops a balance kept for the next session start that is not a whole, non-negative one", () => {
    expect(
      normalizeStoredRecord({ lastSessionSats: -1, lastSessionUsdCents: "50" }),
    ).toEqual(DEFAULT_TWO_FACTOR_ENFORCEMENT)
  })

  it("drops a crossed threshold that is not a whole, non-negative amount", () => {
    expect(normalizeStoredRecord({ enforcedThreshold: 2.5 })).toEqual(
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
