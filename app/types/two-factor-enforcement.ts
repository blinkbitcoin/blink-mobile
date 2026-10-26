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
} as const
export type TwoFactorPrompt = (typeof TwoFactorPrompt)[keyof typeof TwoFactorPrompt]

export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  nudgeCardDismissed: boolean
}
