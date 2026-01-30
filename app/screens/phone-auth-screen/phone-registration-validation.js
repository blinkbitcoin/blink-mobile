var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { gql } from "@apollo/client";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { PhoneCodeChannelType, useUserPhoneRegistrationValidateMutation, } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { logAddPhoneAttempt, logValidateAuthCodeFailure } from "@app/utils/analytics";
import crashlytics from "@react-native-firebase/crashlytics";
import { useNavigation } from "@react-navigation/native";
import { Input, Text, makeStyles, useTheme } from "@rn-vui/themed";
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile";
import { Screen } from "../../components/screen";
import { parseTimer } from "../../utils/timer";
import { PhoneCodeChannelToFriendlyName } from "./request-phone-code-login";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userPhoneRegistrationValidate($input: UserPhoneRegistrationValidateInput!) {\n    userPhoneRegistrationValidate(input: $input) {\n      errors {\n        message\n        code\n      }\n      me {\n        id\n        phone\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"], ["\n  mutation userPhoneRegistrationValidate($input: UserPhoneRegistrationValidateInput!) {\n    userPhoneRegistrationValidate(input: $input) {\n      errors {\n        message\n        code\n      }\n      me {\n        id\n        phone\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"])));
var ValidatePhoneCodeStatus = {
    WaitingForCode: "WaitingForCode",
    LoadingAuthResult: "LoadingAuthResult",
    ReadyToRegenerate: "ReadyToRegenerate",
    Success: "Success",
};
var ValidatePhoneCodeErrors = {
    InvalidCode: "InvalidCode",
    TooManyAttempts: "TooManyAttempts",
    CannotUpgradeToExistingAccount: "CannotUpgradeToExistingAccount",
    IpNotAllowed: "IpNotAllowed",
    PhoneNotAllowed: "PhoneNotAllowed",
    UnknownError: "UnknownError",
};
var mapGqlErrorsToValidatePhoneCodeErrors = function (errors) {
    if (errors.some(function (error) { return error.code === "PHONE_CODE_ERROR"; })) {
        return {
            type: ValidatePhoneCodeErrors.InvalidCode,
        };
    }
    if (errors.some(function (error) { return error.code === "TOO_MANY_REQUEST"; })) {
        return {
            type: ValidatePhoneCodeErrors.TooManyAttempts,
        };
    }
    if (errors.some(function (error) { return error.code === "PHONE_NOT_ALLOWED_TO_ONBOARD_ERROR"; })) {
        return {
            type: ValidatePhoneCodeErrors.PhoneNotAllowed,
        };
    }
    if (errors.some(function (error) { return error.code === "IP_NOT_ALLOWED_TO_ONBOARD_ERROR"; })) {
        return {
            type: ValidatePhoneCodeErrors.IpNotAllowed,
        };
    }
    if (errors.some(function (error) {
        return error.code === "PHONE_ACCOUNT_ALREADY_EXISTS_ERROR" ||
            error.code === "PHONE_ACCOUNT_ALREADY_EXISTS_NEED_TO_SWEEP_FUNDS_ERROR";
    })) {
        return {
            type: ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount,
        };
    }
    if (errors.length > 0) {
        return {
            type: ValidatePhoneCodeErrors.UnknownError,
            msg: errors[0].message,
        };
    }
    return undefined;
};
var mapValidatePhoneCodeErrorsToMessage = function (error, LL) {
    switch (error.type) {
        case ValidatePhoneCodeErrors.InvalidCode:
            return LL.PhoneLoginValidationScreen.errorLoggingIn();
        case ValidatePhoneCodeErrors.TooManyAttempts:
            return LL.PhoneLoginValidationScreen.errorTooManyAttempts();
        case ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount:
            return LL.PhoneLoginValidationScreen.errorCannotUpgradeToExistingAccount();
        case ValidatePhoneCodeErrors.IpNotAllowed:
            return LL.PhoneLoginValidationScreen.errorIpNotAllowed();
        case ValidatePhoneCodeErrors.PhoneNotAllowed:
            return LL.PhoneLoginValidationScreen.errorPhoneNotAllowed();
        case ValidatePhoneCodeErrors.UnknownError:
        default:
            return LL.errors.generic() + (error.msg ? ": ".concat(error.msg) : "");
    }
};
export var PhoneRegistrationValidateScreen = function (_a) {
    var route = _a.route;
    var styles = useStyles();
    var navigation = useNavigation();
    var _b = useState(ValidatePhoneCodeStatus.WaitingForCode), status = _b[0], setStatus = _b[1];
    var _c = useState(), error = _c[0], setError = _c[1];
    var LL = useI18nContext().LL;
    var updateCurrentProfile = useSaveSessionProfile().updateCurrentProfile;
    var phoneValidate = useUserPhoneRegistrationValidateMutation()[0];
    var _d = useState(""), code = _d[0], _setCode = _d[1];
    // Wait 2.5 minutes before allowing another code request
    var _e = useState(150), secondsRemaining = _e[0], setSecondsRemaining = _e[1];
    var _f = route.params, phone = _f.phone, channel = _f.channel;
    var colors = useTheme().theme.colors;
    var send = useCallback(function (code) { return __awaiter(void 0, void 0, void 0, function () {
        var data, errors, error_1, err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (status === ValidatePhoneCodeStatus.LoadingAuthResult) {
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, , 7]);
                    setStatus(ValidatePhoneCodeStatus.LoadingAuthResult);
                    logAddPhoneAttempt();
                    return [4 /*yield*/, phoneValidate({
                            variables: { input: { phone: phone, code: code } },
                        })];
                case 2:
                    data = (_b.sent()).data;
                    errors = ((_a = data === null || data === void 0 ? void 0 : data.userPhoneRegistrationValidate) === null || _a === void 0 ? void 0 : _a.errors) || [];
                    error_1 = mapGqlErrorsToValidatePhoneCodeErrors(errors);
                    if (!error_1) return [3 /*break*/, 3];
                    console.error(error_1, "error validating phone code");
                    logValidateAuthCodeFailure({
                        error: error_1.type,
                    });
                    setError(error_1);
                    _setCode("");
                    setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate);
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, updateCurrentProfile()];
                case 4:
                    _b.sent();
                    setStatus(ValidatePhoneCodeStatus.Success);
                    Alert.alert(LL.PhoneRegistrationValidateScreen.successTitle(), undefined, [
                        {
                            text: LL.common.ok(),
                            onPress: function () { return navigation.pop(2); },
                        },
                    ]);
                    _b.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    err_1 = _b.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                        console.debug({ err: err_1 });
                    }
                    setError({ type: ValidatePhoneCodeErrors.UnknownError });
                    _setCode("");
                    setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [status, phoneValidate, phone, _setCode, navigation, LL, updateCurrentProfile]);
    var setCode = function (code) {
        if (code.length > 6) {
            return;
        }
        setError(undefined);
        _setCode(code);
        if (code.length === 6) {
            send(code);
        }
    };
    useEffect(function () {
        var timerId = setTimeout(function () {
            if (secondsRemaining > 0) {
                setSecondsRemaining(secondsRemaining - 1);
            }
            else if (status === ValidatePhoneCodeStatus.WaitingForCode) {
                setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate);
            }
        }, 1000);
        return function () { return clearTimeout(timerId); };
    }, [secondsRemaining, status]);
    var errorMessage = error && mapValidatePhoneCodeErrorsToMessage(error, LL);
    var extraInfoContent = undefined;
    switch (status) {
        case ValidatePhoneCodeStatus.ReadyToRegenerate:
            extraInfoContent = (<>
          {errorMessage && (<View style={styles.marginBottom}>
              <GaloyErrorBox errorMessage={errorMessage}/>
            </View>)}
          <View style={styles.marginBottom}>
            <GaloyInfo>
              {LL.PhoneLoginValidationScreen.sendViaOtherChannel({
                    channel: PhoneCodeChannelToFriendlyName[channel],
                    other: PhoneCodeChannelToFriendlyName[channel === PhoneCodeChannelType.Sms
                        ? PhoneCodeChannelType.Whatsapp
                        : PhoneCodeChannelType.Sms],
                })}
            </GaloyInfo>
          </View>
          <GaloySecondaryButton title={LL.PhoneLoginValidationScreen.sendAgain()} onPress={function () { return navigation.goBack(); }}/>
        </>);
            break;
        case ValidatePhoneCodeStatus.LoadingAuthResult:
            extraInfoContent = (<ActivityIndicator style={styles.activityIndicator} size="large" color={colors.primary}/>);
            break;
        case ValidatePhoneCodeStatus.WaitingForCode:
            extraInfoContent = (<View style={styles.timerRow}>
          <Text type="p3" color={colors.grey3}>
            {LL.PhoneLoginValidationScreen.sendAgain()} {parseTimer(secondsRemaining)}
          </Text>
        </View>);
            break;
    }
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type="h2">
            {LL.PhoneLoginValidationScreen.header({
            channel: PhoneCodeChannelToFriendlyName[channel],
            phoneNumber: phone,
        })}
          </Text>
        </View>

        <Input placeholder="000000" containerStyle={styles.inputComponentContainerStyle} inputContainerStyle={styles.inputContainerStyle} inputStyle={styles.inputStyle} value={code} onChangeText={setCode} renderErrorMessage={false} autoFocus={true} textContentType={"oneTimeCode"} keyboardType="numeric"/>

        <View style={styles.extraInfoContainer}>{extraInfoContent}</View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        flex: { flex: 1 },
        flexAndMinHeight: { flex: 1, minHeight: 16 },
        viewWrapper: { flex: 1 },
        activityIndicator: { marginTop: 12 },
        extraInfoContainer: {
            marginBottom: 20,
            flex: 1,
        },
        sendAgainButtonRow: {
            flexDirection: "row",
            justifyContent: "center",
            paddingHorizontal: 25,
            textAlign: "center",
        },
        textContainer: {
            marginBottom: 20,
        },
        timerRow: {
            flexDirection: "row",
            justifyContent: "center",
            textAlign: "center",
        },
        marginBottom: {
            marginBottom: 10,
        },
        inputComponentContainerStyle: {
            flexDirection: "row",
            marginBottom: 20,
            paddingLeft: 0,
            paddingRight: 0,
            justifyContent: "center",
        },
        inputContainerStyle: {
            minWidth: 160,
            minHeight: 60,
            borderWidth: 2,
            borderBottomWidth: 2,
            paddingHorizontal: 10,
            borderColor: colors.primary5,
            borderRadius: 8,
            marginRight: 0,
        },
        inputStyle: {
            fontSize: 24,
            textAlign: "center",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=phone-registration-validation.js.map