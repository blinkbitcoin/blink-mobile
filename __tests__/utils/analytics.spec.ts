/* eslint-disable camelcase */
import {
  logAddPhoneAttempt,
  logAppFeedback,
  logAttemptCreateDeviceAccount,
  logConversionAttempt,
  logConversionResult,
  logCreateDeviceAccountFailure,
  logCreatedDeviceAccount,
  logEnterBackground,
  logEnterForeground,
  logGeneratePaymentRequest,
  logGetStartedAction,
  logLogout,
  logParseDestinationResult,
  logPaymentAttempt,
  logPaymentResult,
  logRequestAuthCode,
  logStartCaptcha,
  logToastShown,
  logUpgradeLoginAttempt,
  logUpgradeLoginSuccess,
  logValidateAuthCodeFailure,
} from "@app/utils/analytics"

const mockLogEvent = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

describe("analytics helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("logRequestAuthCode", () => {
    it("emits 'request_auth_code' with instance and channel", () => {
      logRequestAuthCode({
        instance: "Main" as never,
        channel: "SMS" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("request_auth_code", {
        instance: "Main",
        channel: "SMS",
      })
    })
  })

  describe("device-account events", () => {
    const cases: ReadonlyArray<readonly [() => void, string]> = [
      [logCreatedDeviceAccount, "created_device_account"],
      [logAttemptCreateDeviceAccount, "attempt_create_device_account"],
      [logCreateDeviceAccountFailure, "create_device_account_failure"],
    ]
    cases.forEach(([fn, eventName]) => {
      it(`emits '${eventName}' with no payload`, () => {
        fn()
        expect(mockLogEvent).toHaveBeenCalledWith(eventName)
      })
    })
  })

  describe("logGetStartedAction", () => {
    it("renames createDeviceAccountEnabled to create_device_account_enabled", () => {
      logGetStartedAction({ action: "log_in", createDeviceAccountEnabled: true })

      expect(mockLogEvent).toHaveBeenCalledWith("get_started_action", {
        action: "log_in",
        create_device_account_enabled: true,
      })
    })

    it("preserves false booleans", () => {
      logGetStartedAction({
        action: "create_device_account",
        createDeviceAccountEnabled: false,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("get_started_action", {
        action: "create_device_account",
        create_device_account_enabled: false,
      })
    })
  })

  describe("logValidateAuthCodeFailure", () => {
    it("forwards the error payload verbatim", () => {
      logValidateAuthCodeFailure({ error: "IncorrectCodeError" as never })

      expect(mockLogEvent).toHaveBeenCalledWith("validate_auth_code_failure", {
        error: "IncorrectCodeError",
      })
    })
  })

  describe("trivial no-payload wrappers", () => {
    const cases: ReadonlyArray<readonly [() => void, string]> = [
      [logStartCaptcha, "start_captcha"],
      [logUpgradeLoginAttempt, "upgrade_login_attempt"],
      [logAddPhoneAttempt, "add_phone_attempt"],
      [logUpgradeLoginSuccess, "upgrade_login_success"],
      [logEnterForeground, "enter_foreground"],
      [logEnterBackground, "enter_background"],
      [logLogout, "logout"],
    ]
    cases.forEach(([fn, eventName]) => {
      it(`emits '${eventName}' with no payload`, () => {
        fn()
        expect(mockLogEvent).toHaveBeenCalledWith(eventName)
      })
    })
  })

  describe("logParseDestinationResult", () => {
    it("emits 'payment_destination_accepted' with paymentType and direction on valid result", () => {
      logParseDestinationResult({
        valid: true,
        validDestination: { paymentType: "lightning" },
        destinationDirection: "send",
      } as never)

      expect(mockLogEvent).toHaveBeenCalledWith("payment_destination_accepted", {
        paymentType: "lightning",
        direction: "send",
      })
    })

    it("emits 'payment_destination_rejected' with reason and paymentType on invalid result", () => {
      logParseDestinationResult({
        valid: false,
        invalidReason: "InvalidDestination",
        invalidPaymentDestination: { paymentType: "onchain" },
      } as never)

      expect(mockLogEvent).toHaveBeenCalledWith("payment_destination_rejected", {
        reason: "InvalidDestination",
        paymentType: "onchain",
      })
    })
  })

  describe("logPaymentAttempt", () => {
    it("renames camelCase params to snake_case", () => {
      logPaymentAttempt({
        paymentType: "lightning" as never,
        sendingWallet: "BTC" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("payment_attempt", {
        payment_type: "lightning",
        sending_wallet: "BTC",
      })
    })
  })

  describe("logPaymentResult", () => {
    it("renames camelCase params to snake_case", () => {
      logPaymentResult({
        paymentType: "lightning" as never,
        sendingWallet: "USD" as never,
        paymentStatus: "SUCCESS" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("payment_result", {
        payment_type: "lightning",
        sending_wallet: "USD",
        payment_status: "SUCCESS",
      })
    })

    it("preserves null paymentStatus", () => {
      logPaymentResult({
        paymentType: "onchain" as never,
        sendingWallet: "BTC" as never,
        paymentStatus: null,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("payment_result", {
        payment_type: "onchain",
        sending_wallet: "BTC",
        payment_status: null,
      })
    })
  })

  describe("logConversionAttempt", () => {
    it("renames camelCase wallet params to snake_case", () => {
      logConversionAttempt({
        sendingWallet: "BTC" as never,
        receivingWallet: "USD" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("conversion_attempt", {
        sending_wallet: "BTC",
        receiving_wallet: "USD",
      })
    })
  })

  describe("logConversionResult", () => {
    it("renames camelCase params to snake_case", () => {
      logConversionResult({
        sendingWallet: "USD" as never,
        receivingWallet: "BTC" as never,
        paymentStatus: "SUCCESS" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("conversion_result", {
        sending_wallet: "USD",
        receiving_wallet: "BTC",
        payment_status: "SUCCESS",
      })
    })
  })

  describe("logGeneratePaymentRequest", () => {
    it("lowercases paymentType and renames camelCase params", () => {
      logGeneratePaymentRequest({
        paymentType: "LIGHTNING" as never,
        hasAmount: true,
        receivingWallet: "BTC" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("generate_payment_request", {
        payment_type: "lightning",
        has_amount: true,
        receiving_wallet: "BTC",
      })
    })

    it("preserves hasAmount=false", () => {
      logGeneratePaymentRequest({
        paymentType: "Onchain" as never,
        hasAmount: false,
        receivingWallet: "USD" as never,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("generate_payment_request", {
        payment_type: "onchain",
        has_amount: false,
        receiving_wallet: "USD",
      })
    })
  })

  describe("logToastShown", () => {
    it("renames isTranslated to is_translated", () => {
      logToastShown({
        message: "Something happened",
        type: "error",
        isTranslated: true,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("toast_shown", {
        message: "Something happened",
        type: "error",
        is_translated: true,
      })
    })

    it("preserves isTranslated=false", () => {
      logToastShown({
        message: "raw string",
        type: "warning",
        isTranslated: false,
      })

      expect(mockLogEvent).toHaveBeenCalledWith("toast_shown", {
        message: "raw string",
        type: "warning",
        is_translated: false,
      })
    })
  })

  describe("logAppFeedback", () => {
    it("maps isEnjoingApp to is_enjoying_app", () => {
      logAppFeedback({ isEnjoingApp: true })

      expect(mockLogEvent).toHaveBeenCalledWith("app_feedback", {
        is_enjoying_app: true,
      })
    })

    it("preserves false", () => {
      logAppFeedback({ isEnjoingApp: false })

      expect(mockLogEvent).toHaveBeenCalledWith("app_feedback", {
        is_enjoying_app: false,
      })
    })
  })
})
