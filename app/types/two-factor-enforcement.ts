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
 *  only one the prompts ask for. Reported with the setup's start, where it has a single
 *  value now: the parameter stays so the setup events read the same on the dashboards
 *  as they did when an email and a phone were offered too. */
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

/** The prompt a dismissal answers, and why it was up: a flow the prompt opened and the
 *  user left unfinished is that prompt's dismissal, and is reported as such. */
export type TwoFactorPromptOrigin = {
  prompt: TwoFactorPrompt
  reason?: TwoFactorReminderReason
}

/** The route params of a screen in the two-factor flow. */
export type TwoFactorFlowParams = {
  /** The prompt that opened the flow, such as the home card or the session modal. */
  origin?: TwoFactorPromptOrigin
  /** True when the setup screen opened this one and is still behind it. */
  isOpenedFromSetupScreen?: boolean
  /** True when the authenticator registration could not start, so the user had
   *  nothing to answer and leaving is not a skip. */
  hasRegistrationFailedToStart?: boolean
}

/** What the server answers a change that needs the authenticator's code with, when it
 *  refuses it. */
export const TotpStepUpErrorCode = {
  CodeInvalid: "TOTP_CODE_INVALID",
  RemovalBalanceTooHigh: "TOTP_REMOVAL_BALANCE_TOO_HIGH",
  TooManyAttempts: "TOO_MANY_REQUEST",
} as const
export type TotpStepUpErrorCode =
  (typeof TotpStepUpErrorCode)[keyof typeof TotpStepUpErrorCode]

/** The code screen says while a code is checked, so that what reads the stack knows
 *  the setup key is at stake. */
export type TotpCodeCheckParams = {
  isChecking?: boolean
}

/** The authenticator apps the onboarding recommends, as its events report them. */
export const AuthenticatorApp = {
  GoogleAuthenticator: "google_authenticator",
  ProtonAuthenticator: "proton_authenticator",
  TwoFasAuth: "2fas_auth",
} as const
export type AuthenticatorApp = (typeof AuthenticatorApp)[keyof typeof AuthenticatorApp]

/** Where a new authenticator's setup key was saved for safekeeping, as its event
 *  reports it. */
export const SetupKeyBackupOption = {
  PasswordManager: "password_manager",
  ManualCopy: "manual_copy",
} as const
export type SetupKeyBackupOption =
  (typeof SetupKeyBackupOption)[keyof typeof SetupKeyBackupOption]

/** What a session start owes the account: at the enforced tier, the countdown
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
 *  configuration, so the tiers can follow the bitcoin price without a release. The
 *  dollar amounts are in cents, the unit the dollar wallet reports its balance in. */
export type TwoFactorThresholds = {
  suggestedSats: number
  suggestedUsdCents: number
  recommendedSats: number
  recommendedUsdCents: number
  enforcedSats: number
  enforcedUsdCents: number
}

/** The thresholds as the console writes them: sats for the bitcoin wallet and whole
 *  dollars for the dollar wallet, the units a person reads them in. Cents there read as
 *  dollars to whoever edits them, and a slip of a factor of a hundred is what that
 *  costs. */
export type TwoFactorConsoleThresholds = {
  suggestedSats: number
  suggestedUsd: number
  recommendedSats: number
  recommendedUsd: number
  enforcedSats: number
  enforcedUsd: number
}

/** What the device remembers per account; the field names are the stored keys. */
export type TwoFactorEnforcementRecord = {
  highestTier: TwoFactorTier
  /** The wallet that carried the account over the enforced threshold, for the copy
   *  that names it after the balance may have moved on. */
  enforcedCurrency: WalletCurrency
  /** The threshold that wallet crossed, in its own unit, for the same copy: the tier
   *  stays once reached, so the copy quotes what was crossed, not what the threshold
   *  has since been set to. Zero below the enforced tier. */
  enforcedThreshold: number
  nudgeCardDismissed: boolean
  recommendedDismissals: number
  enforcedDismissals: number
  /** The bitcoin wallet's all-time high, in sats: the highest balance seen at a session
   *  start at the suggested or recommended tier, or when the balance raised the tier. */
  highestSats: number
  /** The dollar wallet's all-time high, in cents, kept the same way. */
  highestUsdCents: number
  /** The bitcoin wallet's balance when the highs were last read, at a session start or
   *  a tier raise, in sats: what tells a transfer between the wallets from new funds. */
  lastSessionSats: number
  /** The dollar wallet's balance then, in cents. */
  lastSessionUsdCents: number
  /** A session start owing the recommended tier found a wallet above its all-time high,
   *  and the bulletin that brought back has not been closed since: it comes back at every
   *  session start until it is. */
  isNewHighPending: boolean
}
