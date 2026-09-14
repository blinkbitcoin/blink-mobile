// Kept in its own module so that consumers (and tests) can reach the wire values
// without importing the phone-auth screens, which pull in firebase app-check.
export const PhoneLoginInitiateType = {
  Login: "Login",
  CreateAccount: "CreateAccount",
} as const

export type PhoneLoginInitiateType =
  (typeof PhoneLoginInitiateType)[keyof typeof PhoneLoginInitiateType]
