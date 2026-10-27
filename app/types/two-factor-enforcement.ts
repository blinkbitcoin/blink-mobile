import { WalletCurrency } from "@app/graphql/generated"

export const TwoFactorTier = {
  None: 0,
  Suggested: 1,
  Recommended: 2,
  Enforced: 3,
} as const
export type TwoFactorTier = (typeof TwoFactorTier)[keyof typeof TwoFactorTier]

export const TwoFactorMethod = {
  Email: "email",
  Phone: "phone",
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
  RequiredModal: "required_modal",
  ProtectionRequired: "protection_required",
} as const
export type TwoFactorSessionPrompt =
  (typeof TwoFactorSessionPrompt)[keyof typeof TwoFactorSessionPrompt]

export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  /** The wallet that carried the account over the enforced threshold, for the
   *  copy that names it after the balance may have moved on. */
  enforcedCurrency: WalletCurrency
  nudgeCardDismissed: boolean
  recommendedDismissals: number
  enforcedDismissals: number
}
