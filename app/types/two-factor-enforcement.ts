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
  ReminderBulletin: "tier2_bulletin",
  SessionModal: "session_modal",
  ProtectionRequiredScreen: "protection_required_screen",
  NonCustodialScreen: "non_custodial_screen",
} as const
export type TwoFactorPrompt = (typeof TwoFactorPrompt)[keyof typeof TwoFactorPrompt]

/** Why the reminder bulletin is on the home: one of the first sessions at the tier,
 *  while its dismissals last, or a wallet that has risen above its all-time high since
 *  they ran out. Reported with the bulletin's events; the bulletin itself never says. */
export const TwoFactorReminderReason = {
  FirstSessions: "first_sessions",
  NewAllTimeHigh: "new_ath",
} as const
export type TwoFactorReminderReason =
  (typeof TwoFactorReminderReason)[keyof typeof TwoFactorReminderReason]

/** What a session start owes the account: at the high-balance tier, the countdown
 *  modal while dismissals remain and the blocking screen once they are spent; below it,
 *  nothing. */
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
  nudgeSats: number
  nudgeUsdCents: number
  reminderSats: number
  reminderUsdCents: number
  highBalanceSats: number
  highBalanceUsdCents: number
}

/** What the device remembers per account. The field names are the stored keys, kept as
 *  first written: renaming one would read every record already on a device as unset. */
export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  /** The wallet that carried the account over the high-balance threshold, for the copy
   *  that names it after the balance may have moved on. */
  highBalanceCurrency: WalletCurrency
  /** The threshold that wallet crossed, in its own unit, for the same copy: the tier
   *  stays once reached, so the copy quotes what was crossed, not what the threshold
   *  has since been set to. Zero for a record from before it was kept. */
  highBalanceThreshold: number
  nudgeCardDismissed: boolean
  /** Dismissals counted at the reminder tier. */
  requiredDismissals: number
  /** Dismissals counted at the high-balance tier. */
  authenticatorDismissals: number
  /** The bitcoin wallet's all-time high, in sats: the highest balance seen at a session
   *  start while the account was at the reminder tier. */
  highestSats: number
  /** The dollar wallet's all-time high, in cents, kept the same way. */
  highestUsdCents: number
}
