import { WalletCurrency } from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import {
  TwoFactorEnforcementRecord,
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
export const resolveEnforcedCurrency = (
  wallets: readonly WalletBalance[] | undefined,
  thresholds: TwoFactorThresholds,
): WalletCurrency => {
  const { sats, usdCents } = balancesOf(wallets)
  const isOnlyDollarWalletOver =
    usdCents >= thresholds.enforcedUsdCents && sats < thresholds.enforcedSats
  return isOnlyDollarWalletOver ? WalletCurrency.Usd : WalletCurrency.Btc
}

/** Raises the remembered tier, and with it the wallet that crossed into the
 *  enforced tier, so the copy still names the right one once the balance moves. */
export const withTierReached = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
  enforcedCurrency: WalletCurrency,
): TwoFactorEnforcementRecord => {
  const raised = { ...record, highestTier: tier }
  if (tier !== TwoFactorTier.Enforced) return raised
  return { ...raised, enforcedCurrency }
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
 *  many times the recommended tier's prompt was waved away. Tiers that never prompt at
 *  session start leave the record untouched. */
export const withDismissal = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
): TwoFactorEnforcementRecord => {
  if (tier === TwoFactorTier.Enforced) {
    return { ...record, enforcedDismissals: record.enforcedDismissals + 1 }
  }
  if (tier === TwoFactorTier.Recommended) {
    return { ...record, recommendedDismissals: record.recommendedDismissals + 1 }
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

export const DEFAULT_TWO_FACTOR_ENFORCEMENT: TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier.None,
  enforcedCurrency: WalletCurrency.Btc,
  nudgeCardDismissed: false,
  recommendedDismissals: 0,
  enforcedDismissals: 0,
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
  enforcedCurrency: isWalletCurrency(stored?.enforcedCurrency)
    ? stored.enforcedCurrency
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.enforcedCurrency,
  nudgeCardDismissed: stored?.nudgeCardDismissed === true,
  recommendedDismissals: isDismissalCount(stored?.recommendedDismissals)
    ? stored.recommendedDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.recommendedDismissals,
  enforcedDismissals: isDismissalCount(stored?.enforcedDismissals)
    ? stored.enforcedDismissals
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.enforcedDismissals,
})
