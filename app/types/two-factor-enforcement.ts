import { WalletCurrency } from "@app/graphql/generated"

/** The balance tiers, named after what each asks of an account without an
 *  authenticator: a nudge, then reminders, then a high balance that requires one. The
 *  values are what the record stores and the events report. */
export const TwoFactorTier = {
  None: 0,
  Nudge: 1,
  Reminder: 2,
  HighBalance: 3,
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

/** What a session start owes the account: the countdown modal while the reminder tier
 *  still has dismissals left, the full-screen prompt once it has none or the account is
 *  at the high-balance tier, or nothing. */
export const TwoFactorSessionPrompt = {
  None: "none",
  SessionModal: "session_modal",
  ProtectionRequired: "protection_required",
} as const
export type TwoFactorSessionPrompt =
  (typeof TwoFactorSessionPrompt)[keyof typeof TwoFactorSessionPrompt]

/** What the device remembers per account. The field names are the stored keys, kept as
 *  first written: renaming one would read every record already on a device as unset. */
export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  /** The wallet that carried the account over the high-balance threshold, for the copy
   *  that names it after the balance may have moved on. */
  highBalanceCurrency: WalletCurrency
  nudgeCardDismissed: boolean
  /** Dismissals counted at the reminder tier. */
  requiredDismissals: number
  /** Dismissals counted at the high-balance tier. */
  authenticatorDismissals: number
}
