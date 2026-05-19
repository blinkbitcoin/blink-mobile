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

type LogAppFeedbackParams = {
  isEnjoingApp: boolean
}

export const logAppFeedback = (params: LogAppFeedbackParams) => {
  analytics().logEvent("app_feedback", {
    is_enjoying_app: params.isEnjoingApp,
  })
}
