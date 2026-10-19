import { WalletCurrency } from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import {
  TwoFactorEnforcementRecord,
  TwoFactorReminderReason,
  TwoFactorSessionPrompt,
  TwoFactorThresholds,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

type TierThreshold = {
  sats: number
  usdCents: number
}

type TierStep = {
  tier: TwoFactorTier
  threshold: TierThreshold
}

/**
 * Highest tier first, so the first threshold a wallet clears is the tier. Each wallet
 * is measured against its own threshold with no conversion between them: a balance
 * split across both can sit below every threshold and still not reach the tier.
 */
const tierStepsOf = (thresholds: TwoFactorThresholds): readonly TierStep[] => [
  {
    tier: TwoFactorTier.Enforced,
    threshold: {
      sats: thresholds.enforcedSats,
      usdCents: thresholds.enforcedUsdCents,
    },
  },
  {
    tier: TwoFactorTier.Recommended,
    threshold: {
      sats: thresholds.recommendedSats,
      usdCents: thresholds.recommendedUsdCents,
    },
  },
  {
    tier: TwoFactorTier.Suggested,
    threshold: { sats: thresholds.suggestedSats, usdCents: thresholds.suggestedUsdCents },
  },
]

/** Whether each wallet's thresholds rise from the nudge to the high balance. */
const isAscending = ({
  suggestedSats,
  suggestedUsdCents,
  recommendedSats,
  recommendedUsdCents,
  enforcedSats,
  enforcedUsdCents,
}: TwoFactorThresholds): boolean => {
  const isSatsAscending =
    suggestedSats < recommendedSats && recommendedSats < enforcedSats
  const isUsdAscending =
    suggestedUsdCents < recommendedUsdCents && recommendedUsdCents < enforcedUsdCents
  return isSatsAscending && isUsdAscending
}

/** Whether every threshold is a whole amount: sats and cents have no fractions, and a
 *  crossed threshold is kept on the device as one. */
const hasWholeAmounts = (thresholds: TwoFactorThresholds): boolean =>
  Object.values(thresholds).every(Number.isInteger)

/**
 * Whether a set of thresholds can drive the tiers: whole amounts that rise tier by tier
 * for both wallets. Anything else is a typo, and a typo here is costly: a tier reached
 * never lowers, so an enforced threshold set below the recommended one would hold
 * accounts at the blocking screen even after the console is fixed.
 */
export const isUsableThresholdSet = (thresholds: TwoFactorThresholds): boolean =>
  hasWholeAmounts(thresholds) && isAscending(thresholds)

type WalletBalances = {
  sats: number
  usdCents: number
}

const balancesOf = (wallets: readonly WalletBalance[] | undefined): WalletBalances => ({
  sats: getBtcWallet(wallets)?.balance ?? 0,
  usdCents: getUsdWallet(wallets)?.balance ?? 0,
})

const reachesThreshold = (
  { sats, usdCents }: WalletBalances,
  threshold: TierThreshold,
): boolean => sats >= threshold.sats || usdCents >= threshold.usdCents

export const resolveBalanceTier = (
  wallets: readonly WalletBalance[] | undefined,
  thresholds: TwoFactorThresholds,
): TwoFactorTier => {
  const balances = balancesOf(wallets)
  const reached = tierStepsOf(thresholds).find(({ threshold }) =>
    reachesThreshold(balances, threshold),
  )
  return reached?.tier ?? TwoFactorTier.None
}

/** The wallet the high-balance screen names and the threshold it crossed, in its own
 *  unit: sats whenever the bitcoin wallet crossed, which is also the rule when both
 *  did. */
export type EnforcedCrossing = {
  currency: WalletCurrency
  threshold: number
}

export const resolveEnforcedCrossing = (
  wallets: readonly WalletBalance[] | undefined,
  thresholds: TwoFactorThresholds,
): EnforcedCrossing => {
  const { sats, usdCents } = balancesOf(wallets)
  const isOnlyDollarWalletOver =
    usdCents >= thresholds.enforcedUsdCents && sats < thresholds.enforcedSats
  return isOnlyDollarWalletOver
    ? { currency: WalletCurrency.Usd, threshold: thresholds.enforcedUsdCents }
    : { currency: WalletCurrency.Btc, threshold: thresholds.enforcedSats }
}

/** Raises the remembered tier, and with it the wallet that crossed into the
 *  enforced tier and the threshold it crossed, so the copy still names them once
 *  the balance or the threshold moves. */
export const withTierReached = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
  crossing: EnforcedCrossing,
): TwoFactorEnforcementRecord => {
  const raised = { ...record, highestTier: tier }
  if (tier !== TwoFactorTier.Enforced) return raised
  return {
    ...raised,
    enforcedCurrency: crossing.currency,
    enforcedThreshold: crossing.threshold,
  }
}

/** The threshold the high-balance copy quotes: the one the account crossed, or, for a
 *  record from before that was kept, the one configured now for the wallet it names. */
export const quotedEnforcedThreshold = (
  record: TwoFactorEnforcementRecord,
  thresholds: TwoFactorThresholds,
): number => {
  if (record.enforcedThreshold > 0) return record.enforcedThreshold
  return record.enforcedCurrency === WalletCurrency.Usd
    ? thresholds.enforcedUsdCents
    : thresholds.enforcedSats
}

type UnmetTierInputs = {
  tier: TwoFactorTier
  hasAuthenticator: boolean
}

/** The tier the account still owes, None once it complies. Two-factor authentication
 *  is an authenticator: an attacker who takes an account over can change its email and
 *  its phone, so those two together protect nothing, and every tier asks for the
 *  authenticator alone. */
export const resolveUnmetTier = ({
  tier,
  hasAuthenticator,
}: UnmetTierInputs): TwoFactorTier => (hasAuthenticator ? TwoFactorTier.None : tier)

const MAX_DISMISSALS_PER_TIER = 3

const dismissalsOf = (record: TwoFactorEnforcementRecord, tier: TwoFactorTier): number =>
  tier === TwoFactorTier.Enforced
    ? record.enforcedDismissals
    : record.recommendedDismissals

export const remainingDismissals = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
): number => Math.max(0, MAX_DISMISSALS_PER_TIER - dismissalsOf(record, tier))

/** Each tier counts its own dismissals: the enforced tier starts from zero however
 *  many times the recommended tier's bulletin was waved away. The suggested tier's card
 *  is closed for good instead, so a dismissal of it leaves the counts untouched. A
 *  reminder dismissal is also the close that settles a pending new high. */
export const withDismissal = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
): TwoFactorEnforcementRecord => {
  if (tier === TwoFactorTier.Enforced) {
    return { ...record, enforcedDismissals: record.enforcedDismissals + 1 }
  }
  if (tier === TwoFactorTier.Recommended) {
    return {
      ...record,
      recommendedDismissals: record.recommendedDismissals + 1,
      isNewHighPending: false,
    }
  }
  return record
}

type SessionPromptInputs = {
  unmetTier: TwoFactorTier
  record: TwoFactorEnforcementRecord
}

/** Only the enforced tier asks at the session start: its modal while dismissals
 *  remain, then the blocking screen. The recommended tier reminds on the home and never
 *  blocks, and the suggested tier only nudges. */
export const resolveSessionPrompt = ({
  unmetTier,
  record,
}: SessionPromptInputs): TwoFactorSessionPrompt => {
  if (unmetTier !== TwoFactorTier.Enforced) return TwoFactorSessionPrompt.None
  const hasDismissalsLeft = remainingDismissals(record, unmetTier) > 0
  return hasDismissalsLeft
    ? TwoFactorSessionPrompt.SessionModal
    : TwoFactorSessionPrompt.ProtectionRequired
}

/** Whether either wallet now holds more than its all-time high. Each wallet is measured
 *  in its own unit, so a move in the bitcoin price never reads as a new high. */
export const isAboveAllTimeHigh = (
  record: TwoFactorEnforcementRecord,
  wallets: readonly WalletBalance[] | undefined,
): boolean => {
  const { sats, usdCents } = balancesOf(wallets)
  return sats > record.highestSats || usdCents > record.highestUsdCents
}

/** Raises each wallet's all-time high to its balance where the balance is above it. */
export const withAllTimeHigh = (
  record: TwoFactorEnforcementRecord,
  wallets: readonly WalletBalance[] | undefined,
): TwoFactorEnforcementRecord => {
  const { sats, usdCents } = balancesOf(wallets)
  return {
    ...record,
    highestSats: Math.max(record.highestSats, sats),
    highestUsdCents: Math.max(record.highestUsdCents, usdCents),
  }
}

/** What a session start's read of the highs leaves: the highs raised to any balance
 *  above them, and a new high pending for the reminder bulletin while the recommended
 *  tier is owed, whether found now or still unclosed from an earlier session. An account
 *  that owes it no longer, with an authenticator, settles it. A record with no highs yet
 *  has nothing to measure against: its first read seeds them, and finds no new high. */
export const withSessionStartHigh = (
  record: TwoFactorEnforcementRecord,
  wallets: readonly WalletBalance[] | undefined,
  unmetTier: TwoFactorTier,
): TwoFactorEnforcementRecord => {
  const hasHighs = record.highestSats > 0 || record.highestUsdCents > 0
  const isNewHigh = hasHighs && isAboveAllTimeHigh(record, wallets)
  const isReminderOwed = unmetTier === TwoFactorTier.Recommended
  const isPending = record.isNewHighPending || isNewHigh
  return {
    ...withAllTimeHigh(record, wallets),
    isNewHighPending: isReminderOwed && isPending,
  }
}

type ReminderInputs = {
  unmetTier: TwoFactorTier
  record: TwoFactorEnforcementRecord
}

/** Why the reminder bulletin is due, or null when it is not. It belongs to the
 *  recommended tier alone and never blocks: it comes back at every session start while
 *  the tier's dismissals last, and after that whenever a session start found a wallet
 *  above its all-time high, until it is closed. */
export const resolveReminderReason = ({
  unmetTier,
  record,
}: ReminderInputs): TwoFactorReminderReason | null => {
  if (unmetTier !== TwoFactorTier.Recommended) return null
  const hasDismissalsLeft = remainingDismissals(record, unmetTier) > 0
  if (hasDismissalsLeft) return TwoFactorReminderReason.FirstSessions
  return record.isNewHighPending ? TwoFactorReminderReason.NewAllTimeHigh : null
}

export const DEFAULT_TWO_FACTOR_ENFORCEMENT: TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier.None,
  enforcedCurrency: WalletCurrency.Btc,
  enforcedThreshold: 0,
  nudgeCardDismissed: false,
  recommendedDismissals: 0,
  enforcedDismissals: 0,
  highestSats: 0,
  highestUsdCents: 0,
  isNewHighPending: false,
}

const TIERS: readonly TwoFactorTier[] = Object.values(TwoFactorTier)

const isTwoFactorTier = (value: unknown): value is TwoFactorTier =>
  TIERS.some((tier) => tier === value)

const WALLET_CURRENCIES: readonly WalletCurrency[] = Object.values(WalletCurrency)

const isWalletCurrency = (value: unknown): value is WalletCurrency =>
  WALLET_CURRENCIES.some((currency) => currency === value)

/** A dismissal count or a balance: a whole number, never below zero. */
const isWholeCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

/** What the storage hands back: the record's fields, each as whatever was stored. */
type StoredRecord = { [Field in keyof TwoFactorEnforcementRecord]?: unknown }

/** A stored record is trusted field by field: a value this build cannot read falls back
 *  to the default rather than carrying a tier or a count the rules do not know. */
export const normalizeStoredRecord = (
  stored: StoredRecord | null,
): TwoFactorEnforcementRecord => ({
  highestTier: isTwoFactorTier(stored?.highestTier)
    ? stored.highestTier
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highestTier,
  enforcedCurrency: isWalletCurrency(stored?.enforcedCurrency)
    ? stored.enforcedCurrency
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.enforcedCurrency,
  enforcedThreshold: isWholeCount(stored?.enforcedThreshold)
    ? stored.enforcedThreshold
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.enforcedThreshold,
  nudgeCardDismissed: stored?.nudgeCardDismissed === true,
  recommendedDismissals: isWholeCount(stored?.recommendedDismissals)
    ? stored.recommendedDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.recommendedDismissals,
  enforcedDismissals: isWholeCount(stored?.enforcedDismissals)
    ? stored.enforcedDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.enforcedDismissals,
  highestSats: isWholeCount(stored?.highestSats)
    ? stored.highestSats
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highestSats,
  highestUsdCents: isWholeCount(stored?.highestUsdCents)
    ? stored.highestUsdCents
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highestUsdCents,
  isNewHighPending: stored?.isNewHighPending === true,
})
