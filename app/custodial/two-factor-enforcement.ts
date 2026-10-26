import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

type TierThreshold = {
  tier: TwoFactorTier
  sats: number
  usdCents: number
}

/**
 * Highest tier first, so the first threshold a wallet clears is the tier. Each wallet
 * is measured against its own threshold with no conversion between them: a balance
 * split across both can sit below every threshold and still not reach the tier.
 */
const TIER_THRESHOLDS: readonly TierThreshold[] = [
  { tier: TwoFactorTier.Enforced, sats: 5_000_000, usdCents: 500_000 },
  { tier: TwoFactorTier.Recommended, sats: 500_000, usdCents: 50_000 },
  { tier: TwoFactorTier.Suggested, sats: 50_000, usdCents: 5_000 },
]

export const resolveBalanceTier = (
  wallets: readonly WalletBalance[] | undefined,
): TwoFactorTier => {
  const satsBalance = getBtcWallet(wallets)?.balance ?? 0
  const usdCentsBalance = getUsdWallet(wallets)?.balance ?? 0

  const reached = TIER_THRESHOLDS.find(
    ({ sats, usdCents }) => satsBalance >= sats || usdCentsBalance >= usdCents,
  )
  return reached?.tier ?? TwoFactorTier.None
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

export const DEFAULT_TWO_FACTOR_ENFORCEMENT: TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier.None,
  nudgeCardDismissed: false,
}

const TIERS: readonly TwoFactorTier[] = Object.values(TwoFactorTier)

const isTwoFactorTier = (value: unknown): value is TwoFactorTier =>
  TIERS.some((tier) => tier === value)

/** What the storage hands back: the record's fields, each as whatever was stored. */
type StoredRecord = { [Field in keyof TwoFactorEnforcementRecord]?: unknown }

/** A stored record is trusted field by field: a value this build cannot read falls back
 *  to the default rather than carrying a tier the rules do not know. */
export const normalizeStoredRecord = (
  stored: StoredRecord | null,
): TwoFactorEnforcementRecord => ({
  highestTier: isTwoFactorTier(stored?.highestTier)
    ? stored.highestTier
    : DEFAULT_TWO_FACTOR_ENFORCEMENT.highestTier,
  nudgeCardDismissed: stored?.nudgeCardDismissed === true,
})
