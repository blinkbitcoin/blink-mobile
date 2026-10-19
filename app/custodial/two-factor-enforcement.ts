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
    tier: TwoFactorTier.HighBalance,
    threshold: {
      sats: thresholds.highBalanceSats,
      usdCents: thresholds.highBalanceUsdCents,
    },
  },
  {
    tier: TwoFactorTier.Reminder,
    threshold: { sats: thresholds.reminderSats, usdCents: thresholds.reminderUsdCents },
  },
  {
    tier: TwoFactorTier.Nudge,
    threshold: { sats: thresholds.nudgeSats, usdCents: thresholds.nudgeUsdCents },
  },
]

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

/** The wallet the high-balance screen names: sats whenever the bitcoin wallet crossed
 *  its threshold, which is also the rule when both did. */
export const resolveHighBalanceCurrency = (
  wallets: readonly WalletBalance[] | undefined,
  thresholds: TwoFactorThresholds,
): WalletCurrency => {
  const { sats, usdCents } = balancesOf(wallets)
  const isOnlyDollarWalletOver =
    usdCents >= thresholds.highBalanceUsdCents && sats < thresholds.highBalanceSats
  return isOnlyDollarWalletOver ? WalletCurrency.Usd : WalletCurrency.Btc
}

/** Raises the remembered tier, and with it the wallet that crossed into the
 *  high-balance tier, so the copy still names the right one once the balance moves. */
export const withTierReached = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
  highBalanceCurrency: WalletCurrency,
): TwoFactorEnforcementRecord => {
  const raised = { ...record, highestTier: tier }
  if (tier !== TwoFactorTier.HighBalance) return raised
  return { ...raised, highBalanceCurrency }
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
  tier === TwoFactorTier.HighBalance
    ? record.authenticatorDismissals
    : record.requiredDismissals

export const remainingDismissals = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
): number => Math.max(0, MAX_DISMISSALS_PER_TIER - dismissalsOf(record, tier))

/** Each tier counts its own dismissals: the high-balance tier starts from zero however
 *  many times the reminder tier's prompt was waved away. Tiers that never prompt at
 *  session start leave the record untouched. */
export const withDismissal = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
): TwoFactorEnforcementRecord => {
  if (tier === TwoFactorTier.HighBalance) {
    return { ...record, authenticatorDismissals: record.authenticatorDismissals + 1 }
  }
  if (tier === TwoFactorTier.Reminder) {
    return { ...record, requiredDismissals: record.requiredDismissals + 1 }
  }
  return record
}

type SessionPromptInputs = {
  unmetTier: TwoFactorTier
  record: TwoFactorEnforcementRecord
}

/** Only the high-balance tier asks at the session start: its modal while dismissals
 *  remain, then the blocking screen. The reminder tier reminds on the home and never
 *  blocks, and the nudge tier only nudges. */
export const resolveSessionPrompt = ({
  unmetTier,
  record,
}: SessionPromptInputs): TwoFactorSessionPrompt => {
  if (unmetTier !== TwoFactorTier.HighBalance) return TwoFactorSessionPrompt.None
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

type ReminderInputs = {
  unmetTier: TwoFactorTier
  record: TwoFactorEnforcementRecord
  /** Whether this session started with a wallet above its all-time high. */
  hasNewAllTimeHigh: boolean
}

/** Why the reminder bulletin is due, or null when it is not. It belongs to the reminder
 *  tier alone and never blocks: it comes back at every session start while the tier's
 *  dismissals last, and after that only at a session start that found a wallet above
 *  its all-time high, as many times as that happens. */
export const resolveReminderReason = ({
  unmetTier,
  record,
  hasNewAllTimeHigh,
}: ReminderInputs): TwoFactorReminderReason | null => {
  if (unmetTier !== TwoFactorTier.Reminder) return null
  const hasDismissalsLeft = remainingDismissals(record, unmetTier) > 0
  if (hasDismissalsLeft) return TwoFactorReminderReason.FirstSessions
  return hasNewAllTimeHigh ? TwoFactorReminderReason.NewAllTimeHigh : null
}

export const DEFAULT_TWO_FACTOR_ENFORCEMENT: TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier.None,
  highBalanceCurrency: WalletCurrency.Btc,
  nudgeCardDismissed: false,
  requiredDismissals: 0,
  authenticatorDismissals: 0,
  highestSats: 0,
  highestUsdCents: 0,
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
  highBalanceCurrency: isWalletCurrency(stored?.highBalanceCurrency)
    ? stored.highBalanceCurrency
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highBalanceCurrency,
  nudgeCardDismissed: stored?.nudgeCardDismissed === true,
  requiredDismissals: isWholeCount(stored?.requiredDismissals)
    ? stored.requiredDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.requiredDismissals,
  authenticatorDismissals: isWholeCount(stored?.authenticatorDismissals)
    ? stored.authenticatorDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.authenticatorDismissals,
  highestSats: isWholeCount(stored?.highestSats)
    ? stored.highestSats
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highestSats,
  highestUsdCents: isWholeCount(stored?.highestUsdCents)
    ? stored.highestUsdCents
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highestUsdCents,
})
