/* eslint-disable camelcase */
import { GaloyInstanceName } from "@app/config/galoy-instances"
import {
  PaymentSendResult,
  PhoneCodeChannelType,
  WalletCurrency,
} from "@app/graphql/generated"
import { ValidatePhoneCodeErrorsType } from "@app/screens/phone-auth-screen"
import { InvoiceType } from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { ParseDestinationResult } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import {
  AuthenticatorApp,
  ContactField,
  SetupKeyBackupOption,
  TwoFactorMethod,
  TwoFactorPrompt,
  TwoFactorReminderReason,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
import { PaymentType as ParsedPaymentType } from "@blinkbitcoin/blink-client"
import analytics from "@react-native-firebase/analytics"

export const logRequestAuthCode = ({
  instance,
  channel,
}: {
  instance: GaloyInstanceName
  channel: PhoneCodeChannelType
}) => {
  analytics().logEvent("request_auth_code", { instance, channel })
}

export const logCreatedDeviceAccount = () => {
  analytics().logEvent("created_device_account")
}

export const logAttemptCreateDeviceAccount = () => {
  analytics().logEvent("attempt_create_device_account")
}

export const logCreateDeviceAccountFailure = () => {
  analytics().logEvent("create_device_account_failure")
}

export const logGetStartedAction = ({
  action,
  createDeviceAccountEnabled,
}: {
  action: "log_in" | "create_device_account" | "explore_wallet" | "login_with_email"
  createDeviceAccountEnabled: boolean
}) => {
  analytics().logEvent("get_started_action", {
    action,
    create_device_account_enabled: createDeviceAccountEnabled,
  })
}

export const logValidateAuthCodeFailure = ({
  error,
}: {
  error: ValidatePhoneCodeErrorsType
}) => {
  analytics().logEvent("validate_auth_code_failure", {
    error,
  })
}

export const logStartCaptcha = () => {
  analytics().logEvent("start_captcha")
}

export const logUpgradeLoginAttempt = () => {
  analytics().logEvent("upgrade_login_attempt")
}

export const logAddPhoneAttempt = () => {
  analytics().logEvent("add_phone_attempt")
}

export const logUpgradeLoginSuccess = () => {
  analytics().logEvent("upgrade_login_success")
}

export const logParseDestinationResult = (parsedDestination: ParseDestinationResult) => {
  if (parsedDestination.valid) {
    analytics().logEvent("payment_destination_accepted", {
      paymentType: parsedDestination.validDestination.paymentType,
      direction: parsedDestination.destinationDirection,
    })
  } else {
    analytics().logEvent("payment_destination_rejected", {
      reason: parsedDestination.invalidReason,
      paymentType: parsedDestination.invalidPaymentDestination.paymentType,
    })
  }
}

type LogPaymentAttemptParams = {
  paymentType: ParsedPaymentType
  sendingWallet: WalletCurrency
}

export const logPaymentAttempt = (params: LogPaymentAttemptParams) => {
  analytics().logEvent("payment_attempt", {
    payment_type: params.paymentType,
    sending_wallet: params.sendingWallet,
  })
}

type LogPaymentResultParams = {
  paymentType: ParsedPaymentType
  sendingWallet: WalletCurrency
  paymentStatus: PaymentSendResult | null | undefined
}

export const logPaymentResult = (params: LogPaymentResultParams) => {
  analytics().logEvent("payment_result", {
    payment_type: params.paymentType,
    sending_wallet: params.sendingWallet,
    payment_status: params.paymentStatus,
  })
}

type LogConversionAttemptParams = {
  sendingWallet: WalletCurrency
  receivingWallet: WalletCurrency
}

export const logConversionAttempt = (params: LogConversionAttemptParams) => {
  analytics().logEvent("conversion_attempt", {
    sending_wallet: params.sendingWallet,
    receiving_wallet: params.receivingWallet,
  })
}

type LogConversionResultParams = {
  sendingWallet: WalletCurrency
  receivingWallet: WalletCurrency
  paymentStatus: PaymentSendResult
}
export const logConversionResult = (params: LogConversionResultParams) => {
  analytics().logEvent("conversion_result", {
    sending_wallet: params.sendingWallet,
    receiving_wallet: params.receivingWallet,
    payment_status: params.paymentStatus,
  })
}

type LogGeneratePaymentRequestParams = {
  paymentType: InvoiceType
  hasAmount: boolean
  receivingWallet: WalletCurrency
}

export const logGeneratePaymentRequest = (params: LogGeneratePaymentRequestParams) => {
  analytics().logEvent("generate_payment_request", {
    payment_type: params.paymentType.toLowerCase(),
    has_amount: params.hasAmount,
    receiving_wallet: params.receivingWallet,
  })
}

export const logEnterForeground = () => {
  analytics().logEvent("enter_foreground")
}

export const logEnterBackground = () => {
  analytics().logEvent("enter_background")
}

export const logLogout = () => {
  analytics().logEvent("logout")
}

type LogToastShownParams = {
  message: string
  type: "error" | "success" | "warning"
  isTranslated: boolean
}

export const logToastShown = (params: LogToastShownParams) => {
  analytics().logEvent("toast_shown", {
    message: params.message,
    type: params.type,
    is_translated: params.isTranslated,
  })
}

type LogTwoFactorPromptParams = {
  tier: TwoFactorTier
  prompt: TwoFactorPrompt
  /** Why the reminder bulletin was shown; the other prompts have no reason to report. */
  reason?: TwoFactorReminderReason
}

/** The prompt's event parameters, with the reason only where there is one. */
const twoFactorPromptEventParams = ({
  tier,
  prompt,
  reason,
}: LogTwoFactorPromptParams) =>
  reason === undefined ? { tier, prompt } : { tier, prompt, reason }

export const logTwoFactorPromptShown = (params: LogTwoFactorPromptParams) => {
  analytics().logEvent("two_factor_prompt_shown", twoFactorPromptEventParams(params))
}

export const logTwoFactorPromptDismissed = (params: LogTwoFactorPromptParams) => {
  analytics().logEvent("two_factor_prompt_dismissed", twoFactorPromptEventParams(params))
}

type LogTwoFactorSetupStartedParams = {
  tier: TwoFactorTier
  method: TwoFactorMethod
}

export const logTwoFactorSetupStarted = (params: LogTwoFactorSetupStartedParams) => {
  analytics().logEvent("two_factor_setup_started", {
    tier: params.tier,
    method: params.method,
  })
}

type LogTwoFactorNonCustodialChosenParams = {
  tier: TwoFactorTier
}

export const logTwoFactorNonCustodialChosen = (
  params: LogTwoFactorNonCustodialChosenParams,
) => {
  analytics().logEvent("two_factor_non_custodial_chosen", {
    tier: params.tier,
  })
}

type LogTwoFactorSetupCompletedParams = {
  tier: TwoFactorTier
  /** Whether the prompts applied to the account: off, its tier says nothing about a
   *  balance, since nothing was asked of it. */
  isEnforced: boolean
  /** The prompt that led to the setup, none when it was started from the settings. */
  prompt?: TwoFactorPrompt
}

/** An authenticator added to the account, from a prompt or from the settings alike: the
 *  adoption the prompts are measured by, joinable to the prompt that led to it. */
export const logTwoFactorSetupCompleted = (params: LogTwoFactorSetupCompletedParams) => {
  const promptParams = params.prompt === undefined ? {} : { prompt: params.prompt }
  analytics().logEvent("two_factor_setup_completed", {
    tier: params.tier,
    is_enforced: params.isEnforced,
    ...promptParams,
  })
}

type LogAuthenticatorAppSelectedParams = {
  app: AuthenticatorApp
}

/** A recommended authenticator app opened in its store. */
export const logAuthenticatorAppSelected = (
  params: LogAuthenticatorAppSelectedParams,
) => {
  analytics().logEvent("two_factor_education_app_selected", { app: params.app })
}

/** The onboarding left for the setup itself, with an app at hand, once per
 *  registration. */
export const logAuthenticatorEducationCompleted = () => {
  analytics().logEvent("two_factor_education_completed")
}

type LogSetupKeyBackupOptionSelectedParams = {
  option: SetupKeyBackupOption
}

/** A backup option used for a new authenticator's setup key. Never the key itself. */
export const logSetupKeyBackupOptionSelected = (
  params: LogSetupKeyBackupOptionSelectedParams,
) => {
  analytics().logEvent("two_factor_key_backup_option_selected", {
    option: params.option,
  })
}

type LogTwoFactorTurnOffParams = {
  tier: TwoFactorTier
}

/** Turning the authenticator off was asked for from the settings, at the tier the
 *  account reached. */
export const logTwoFactorDisableAttempted = (params: LogTwoFactorTurnOffParams) => {
  analytics().logEvent("two_factor_disable_attempted", { tier: params.tier })
}

/** Turning the authenticator off was refused: the account reached the high-balance
 *  tier, or the server found a balance that high. */
export const logTwoFactorDisableBlocked = (params: LogTwoFactorTurnOffParams) => {
  analytics().logEvent("two_factor_disable_blocked", { tier: params.tier })
}

type LogContactChangeStartedParams = {
  field: ContactField
  hasAuthenticator: boolean
}

/** A change of the email or the phone number asked for from the settings. */
export const logContactChangeStarted = (params: LogContactChangeStartedParams) => {
  analytics().logEvent("contact_change_started", {
    field: params.field,
    has_authenticator: params.hasAuthenticator,
  })
}

type LogContactChangeFieldParams = {
  field: ContactField
}

/** A change asked for without an authenticator, told it needs one first. */
export const logContactChangeNeeds2faShown = (params: LogContactChangeFieldParams) => {
  analytics().logEvent("contact_change_needs_2fa_shown", { field: params.field })
}

/** The authenticator's code for a change refused as wrong. */
export const logContactChangeCodeFailed = (params: LogContactChangeFieldParams) => {
  analytics().logEvent("contact_change_code_failed", { field: params.field })
}
