import { WalletCurrency } from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import {
  TwoFactorEnforcementRecord,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

type TierThreshold = {
  sats: number
  usdCents: number
}

const NUDGE_THRESHOLD: TierThreshold = { sats: 50_000, usdCents: 5_000 }
const REMINDER_THRESHOLD: TierThreshold = { sats: 500_000, usdCents: 50_000 }
export const HIGH_BALANCE_THRESHOLD: TierThreshold = {
  sats: 5_000_000,
  usdCents: 500_000,
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
const TIER_STEPS: readonly TierStep[] = [
  { tier: TwoFactorTier.HighBalance, threshold: HIGH_BALANCE_THRESHOLD },
  { tier: TwoFactorTier.Reminder, threshold: REMINDER_THRESHOLD },
  { tier: TwoFactorTier.Nudge, threshold: NUDGE_THRESHOLD },
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
): TwoFactorTier => {
  const balances = balancesOf(wallets)
  const reached = TIER_STEPS.find(({ threshold }) =>
    reachesThreshold(balances, threshold),
  )
  return reached?.tier ?? TwoFactorTier.None
}

/** The wallet the high-balance screen names: sats whenever the bitcoin wallet crossed
 *  its threshold, which is also the rule when both did. */
export const resolveHighBalanceCurrency = (
  wallets: readonly WalletBalance[] | undefined,
): WalletCurrency => {
  const { sats, usdCents } = balancesOf(wallets)
  const isOnlyDollarWalletOver =
    usdCents >= HIGH_BALANCE_THRESHOLD.usdCents && sats < HIGH_BALANCE_THRESHOLD.sats
  return isOnlyDollarWalletOver ? WalletCurrency.Usd : WalletCurrency.Btc
}

/** Raises the remembered tier, and with it the wallet that crossed into the
 *  high-balance tier, so the copy still names the right one once the balance moves. */
export const withTierReached = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
  wallets: readonly WalletBalance[] | undefined,
): TwoFactorEnforcementRecord => {
  const raised = { ...record, highestTier: tier }
  if (tier !== TwoFactorTier.HighBalance) return raised
  return { ...raised, highBalanceCurrency: resolveHighBalanceCurrency(wallets) }
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

export const resolveSessionPrompt = ({
  unmetTier,
  record,
}: SessionPromptInputs): TwoFactorSessionPrompt => {
  if (unmetTier === TwoFactorTier.HighBalance) {
    return TwoFactorSessionPrompt.ProtectionRequired
  }
  if (unmetTier !== TwoFactorTier.Reminder) return TwoFactorSessionPrompt.None
  const hasDismissalsLeft = remainingDismissals(record, unmetTier) > 0
  return hasDismissalsLeft
    ? TwoFactorSessionPrompt.SessionModal
    : TwoFactorSessionPrompt.ProtectionRequired
}

export const DEFAULT_TWO_FACTOR_ENFORCEMENT: TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier.None,
  highBalanceCurrency: WalletCurrency.Btc,
  nudgeCardDismissed: false,
  requiredDismissals: 0,
  authenticatorDismissals: 0,
}

const TIERS: readonly TwoFactorTier[] = Object.values(TwoFactorTier)

const isTwoFactorTier = (value: unknown): value is TwoFactorTier =>
  TIERS.some((tier) => tier === value)

const WALLET_CURRENCIES: readonly WalletCurrency[] = Object.values(WalletCurrency)

const isWalletCurrency = (value: unknown): value is WalletCurrency =>
  WALLET_CURRENCIES.some((currency) => currency === value)

const isDismissalCount = (value: unknown): value is number =>
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
  requiredDismissals: isDismissalCount(stored?.requiredDismissals)
    ? stored.requiredDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.requiredDismissals,
  authenticatorDismissals: isDismissalCount(stored?.authenticatorDismissals)
    ? stored.authenticatorDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.authenticatorDismissals,
})
