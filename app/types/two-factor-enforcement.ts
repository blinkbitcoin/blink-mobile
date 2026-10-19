import { WalletCurrency } from "@app/graphql/generated"

/** The balance tiers, named after how hard each pushes an account without an
 *  authenticator to set one: suggested, then recommended, then enforced, the only one
 *  that can block. The values are what the record stores and the events report. */
export const TwoFactorTier = {
  None: 0,
  Suggested: 1,
  Recommended: 2,
  Enforced: 3,
} as const
export type TwoFactorTier = (typeof TwoFactorTier)[keyof typeof TwoFactorTier]

/** The factor a setup started from a two-factor prompt adds: the authenticator, the
 *  only one the prompts ask for. Reported with the setup's start. */
export const TwoFactorMethod = {
  Authenticator: "authenticator",
} as const
export type TwoFactorMethod = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod]

export const TwoFactorPrompt = {
  HomeCard: "home_card",
  SettingsBanner: "settings_banner",
  SessionModal: "session_modal",
  ProtectionRequiredScreen: "protection_required_screen",
  NonCustodialScreen: "non_custodial_screen",
} as const
export type TwoFactorPrompt = (typeof TwoFactorPrompt)[keyof typeof TwoFactorPrompt]

/** What a session start owes the account: the countdown modal while the recommended tier
 *  still has dismissals left, the full-screen prompt once it has none or the account is
 *  at the enforced tier, or nothing. */
export const TwoFactorSessionPrompt = {
  None: "none",
  SessionModal: "session_modal",
  ProtectionRequired: "protection_required",
} as const
export type TwoFactorSessionPrompt =
  (typeof TwoFactorSessionPrompt)[keyof typeof TwoFactorSessionPrompt]

/** The balance each tier starts at, per wallet in its own unit and never converted:
 *  configuration, so the tiers can follow the bitcoin price without a release. */
export type TwoFactorThresholds = {
  suggestedSats: number
  suggestedUsdCents: number
  recommendedSats: number
  recommendedUsdCents: number
  enforcedSats: number
  enforcedUsdCents: number
}

/** What the device remembers per account. The field names are the stored keys, kept as
 *  first written: renaming one would read every record already on a device as unset. */
export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  /** The wallet that carried the account over the enforced threshold, for the copy
   *  that names it after the balance may have moved on. */
  enforcedCurrency: WalletCurrency
  nudgeCardDismissed: boolean
  /** Dismissals counted at the recommended tier. */
  recommendedDismissals: number
  /** Dismissals counted at the enforced tier. */
  enforcedDismissals: number
}
