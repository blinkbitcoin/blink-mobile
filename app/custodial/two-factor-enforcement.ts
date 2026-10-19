import { WalletCurrency } from "@app/graphql/generated"
import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

type TierThreshold = {
  sats: number
  usdCents: number
}

const SUGGESTED_THRESHOLD: TierThreshold = { sats: 50_000, usdCents: 5_000 }
const RECOMMENDED_THRESHOLD: TierThreshold = { sats: 500_000, usdCents: 50_000 }
export const ENFORCED_THRESHOLD: TierThreshold = {
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
  { tier: TwoFactorTier.Enforced, threshold: ENFORCED_THRESHOLD },
  { tier: TwoFactorTier.Recommended, threshold: RECOMMENDED_THRESHOLD },
  { tier: TwoFactorTier.Suggested, threshold: SUGGESTED_THRESHOLD },
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
export const resolveEnforcedCurrency = (
  wallets: readonly WalletBalance[] | undefined,
): WalletCurrency => {
  const { sats, usdCents } = balancesOf(wallets)
  const isOnlyDollarWalletOver =
    usdCents >= ENFORCED_THRESHOLD.usdCents && sats < ENFORCED_THRESHOLD.sats
  return isOnlyDollarWalletOver ? WalletCurrency.Usd : WalletCurrency.Btc
}

/** Raises the remembered tier, and with it the wallet that crossed into the
 *  enforced tier, so the copy still names the right one once the balance moves. */
export const withTierReached = (
  record: TwoFactorEnforcementRecord,
  tier: TwoFactorTier,
  wallets: readonly WalletBalance[] | undefined,
): TwoFactorEnforcementRecord => {
  const raised = { ...record, highestTier: tier }
  if (tier !== TwoFactorTier.Enforced) return raised
  return { ...raised, enforcedCurrency: resolveEnforcedCurrency(wallets) }
}

type TwoFactorFactors = {
  hasPhone: boolean
  hasVerifiedEmail: boolean
  hasAuthenticator: boolean
}

const REQUIRED_FACTOR_COUNT = 2

export const hasTwoFactor = ({
  hasPhone,
  hasVerifiedEmail,
  hasAuthenticator,
}: TwoFactorFactors): boolean =>
  [hasPhone, hasVerifiedEmail, hasAuthenticator].filter(Boolean).length >=
  REQUIRED_FACTOR_COUNT

/** The setup offers the factor the account lacks: a phone when the email is already
 *  verified, otherwise an email, which is also the step an account with nothing takes. */
export const resolveMissingMethod = ({
  hasVerifiedEmail,
}: TwoFactorFactors): TwoFactorMethod =>
  hasVerifiedEmail ? TwoFactorMethod.Phone : TwoFactorMethod.Email

type UnmetTierInputs = {
  tier: TwoFactorTier
  hasTwoFactor: boolean
  hasAuthenticator: boolean
}

/** The highest tier whose condition the account has not met. The enforced tier
 *  asks for an authenticator even from an account that already holds two factors; the
 *  tiers below it ask for two factors of any kind. */
export const resolveUnmetTier = ({
  tier,
  hasTwoFactor: isTwoFactorSet,
  hasAuthenticator,
}: UnmetTierInputs): TwoFactorTier => {
  const isAuthenticatorMissing = tier >= TwoFactorTier.Enforced && !hasAuthenticator
  if (isAuthenticatorMissing) return TwoFactorTier.Enforced
  if (isTwoFactorSet) return TwoFactorTier.None
  if (tier >= TwoFactorTier.Recommended) return TwoFactorTier.Recommended
  if (tier >= TwoFactorTier.Suggested) return TwoFactorTier.Suggested
  return TwoFactorTier.None
}

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

export const resolveSessionPrompt = ({
  unmetTier,
  record,
}: SessionPromptInputs): TwoFactorSessionPrompt => {
  if (unmetTier === TwoFactorTier.Enforced) {
    return TwoFactorSessionPrompt.ProtectionRequired
  }
  if (unmetTier !== TwoFactorTier.Recommended) return TwoFactorSessionPrompt.None
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
