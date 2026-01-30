import analytics from "@react-native-firebase/analytics";
export var logRequestAuthCode = function (_a) {
    var instance = _a.instance, channel = _a.channel;
    analytics().logEvent("request_auth_code", { instance: instance, channel: channel });
};
export var logCreatedDeviceAccount = function () {
    analytics().logEvent("created_device_account");
};
export var logAttemptCreateDeviceAccount = function () {
    analytics().logEvent("attempt_create_device_account");
};
export var logCreateDeviceAccountFailure = function () {
    analytics().logEvent("create_device_account_failure");
};
export var logGetStartedAction = function (_a) {
    var action = _a.action, createDeviceAccountEnabled = _a.createDeviceAccountEnabled;
    analytics().logEvent("get_started_action", {
        action: action,
        create_device_account_enabled: createDeviceAccountEnabled,
    });
};
export var logValidateAuthCodeFailure = function (_a) {
    var error = _a.error;
    analytics().logEvent("validate_auth_code_failure", {
        error: error,
    });
};
export var logStartCaptcha = function () {
    analytics().logEvent("start_captcha");
};
export var logUpgradeLoginAttempt = function () {
    analytics().logEvent("upgrade_login_attempt");
};
export var logAddPhoneAttempt = function () {
    analytics().logEvent("add_phone_attempt");
};
export var logUpgradeLoginSuccess = function () {
    analytics().logEvent("upgrade_login_success");
};
export var logParseDestinationResult = function (parsedDestination) {
    if (parsedDestination.valid) {
        analytics().logEvent("payment_destination_accepted", {
            paymentType: parsedDestination.validDestination.paymentType,
            direction: parsedDestination.destinationDirection,
        });
    }
    else {
        analytics().logEvent("payment_destination_rejected", {
            reason: parsedDestination.invalidReason,
            paymentType: parsedDestination.invalidPaymentDestination.paymentType,
        });
    }
};
export var logPaymentAttempt = function (params) {
    analytics().logEvent("payment_attempt", {
        payment_type: params.paymentType,
        sending_wallet: params.sendingWallet,
    });
};
export var logPaymentResult = function (params) {
    analytics().logEvent("payment_result", {
        payment_type: params.paymentType,
        sending_wallet: params.sendingWallet,
        payment_status: params.paymentStatus,
    });
};
export var logConversionAttempt = function (params) {
    analytics().logEvent("conversion_attempt", {
        sending_wallet: params.sendingWallet,
        receiving_wallet: params.receivingWallet,
    });
};
export var logConversionResult = function (params) {
    analytics().logEvent("conversion_result", {
        sending_wallet: params.sendingWallet,
        receiving_wallet: params.receivingWallet,
        payment_status: params.paymentStatus,
    });
};
export var logGeneratePaymentRequest = function (params) {
    analytics().logEvent("generate_payment_request", {
        payment_type: params.paymentType.toLowerCase(),
        has_amount: params.hasAmount,
        receiving_wallet: params.receivingWallet,
    });
};
export var logEnterForeground = function () {
    analytics().logEvent("enter_foreground");
};
export var logEnterBackground = function () {
    analytics().logEvent("enter_background");
};
export var logLogout = function () {
    analytics().logEvent("logout");
};
export var logToastShown = function (params) {
    analytics().logEvent("toast_shown", {
        message: params.message,
        type: params.type,
        is_translated: params.isTranslated,
    });
};
export var logAppFeedback = function (params) {
    analytics().logEvent("app_feedback", {
        is_enjoying_app: params.isEnjoingApp,
    });
};
//# sourceMappingURL=analytics.js.map