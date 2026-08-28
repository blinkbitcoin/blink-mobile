export const AuthenticationScreenPurpose = {
  Authenticate: "Authenticate",
  TurnOnAuthentication: "TurnOnAuthentication",
} as const

export const PinScreenPurpose = {
  AuthenticatePin: "AuthenticatePin",
  SetPin: "SetPin",
  /** Verify the pin for the calling screen and report back — never unlocks the app. */
  ChallengePin: "ChallengePin",
} as const

export type AuthenticationScreenPurpose =
  (typeof AuthenticationScreenPurpose)[keyof typeof AuthenticationScreenPurpose]
export type PinScreenPurpose = (typeof PinScreenPurpose)[keyof typeof PinScreenPurpose]
