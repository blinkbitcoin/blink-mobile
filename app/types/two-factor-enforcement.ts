export const TwoFactorTier = {
  None: 0,
  Nudge: 1,
  Required: 2,
  Authenticator: 3,
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
} as const
export type TwoFactorPrompt = (typeof TwoFactorPrompt)[keyof typeof TwoFactorPrompt]

export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  nudgeCardDismissed: boolean
}
