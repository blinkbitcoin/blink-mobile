export const AuthenticationScreenPurpose = {
  Authenticate: "Authenticate",
  TurnOnAuthentication: "TurnOnAuthentication",
} as const

export const PinScreenPurpose = {
  AuthenticatePin: "AuthenticatePin",
  SetPin: "SetPin",
} as const

export type AuthenticationScreenPurpose =
  (typeof AuthenticationScreenPurpose)[keyof typeof AuthenticationScreenPurpose]
export type PinScreenPurpose = (typeof PinScreenPurpose)[keyof typeof PinScreenPurpose]
