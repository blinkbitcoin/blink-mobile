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
import { useCallback, useState, useEffect } from "react";
import { View, Keyboard, Modal } from "react-native";
import { Text, makeStyles } from "@rn-vui/themed";
import { gql } from "@apollo/client";
import { CodeInput } from "@app/components/code-input";
import { useUserEmailRegistrationValidateMutation } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { SuccessIconAnimation } from "@app/components/success-animation";
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userEmailRegistrationValidate($input: UserEmailRegistrationValidateInput!) {\n    userEmailRegistrationValidate(input: $input) {\n      errors {\n        message\n      }\n      me {\n        id\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"], ["\n  mutation userEmailRegistrationValidate($input: UserEmailRegistrationValidateInput!) {\n    userEmailRegistrationValidate(input: $input) {\n      errors {\n        message\n      }\n      me {\n        id\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"])));
var SUCCESS_DELAY = 2000;
export var EmailRegistrationValidateScreen = function (_a) {
    var route = _a.route;
    var navigation = useNavigation();
    var styles = useStyles();
    var _b = React.useState(""), errorMessage = _b[0], setErrorMessage = _b[1];
    var LL = useI18nContext().LL;
    var updateCurrentProfile = useSaveSessionProfile().updateCurrentProfile;
    var emailVerify = useUserEmailRegistrationValidateMutation()[0];
    var _c = useState(false), loading = _c[0], setLoading = _c[1];
    var _d = useState(false), showSuccess = _d[0], setShowSuccess = _d[1];
    var _e = route.params, emailRegistrationId = _e.emailRegistrationId, email = _e.email, onboarding = _e.onboarding, _f = _e.hasUsername, hasUsername = _f === void 0 ? false : _f;
    var onboardingNavigate = useCallback(function () {
        if (hasUsername) {
            navigation.replace("onboarding", {
                screen: "supportScreen",
                params: { canGoBack: false },
            });
            return;
        }
        navigation.replace("onboarding", {
            screen: "lightningBenefits",
            params: { onboarding: onboarding, canGoBack: false },
        });
    }, [navigation, onboarding, hasUsername]);
    var send = useCallback(function (code) { return __awaiter(void 0, void 0, void 0, function () {
        var res, error, err_1;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 5, 6, 7]);
                    setLoading(true);
                    return [4 /*yield*/, emailVerify({
                            variables: { input: { code: code, emailRegistrationId: emailRegistrationId } },
                        })];
                case 1:
                    res = _f.sent();
                    if ((_a = res.data) === null || _a === void 0 ? void 0 : _a.userEmailRegistrationValidate.errors) {
                        error = (_b = res.data.userEmailRegistrationValidate.errors[0]) === null || _b === void 0 ? void 0 : _b.message;
                        // TODO: manage translation for errors
                        setErrorMessage(error);
                    }
                    if (!((_e = (_d = (_c = res.data) === null || _c === void 0 ? void 0 : _c.userEmailRegistrationValidate.me) === null || _d === void 0 ? void 0 : _d.email) === null || _e === void 0 ? void 0 : _e.verified)) return [3 /*break*/, 3];
                    return [4 /*yield*/, updateCurrentProfile()];
                case 2:
                    _f.sent();
                    Keyboard.dismiss();
                    setShowSuccess(true);
                    return [3 /*break*/, 4];
                case 3: throw new Error(LL.common.errorAuthToken());
                case 4: return [3 /*break*/, 7];
                case 5:
                    err_1 = _f.sent();
                    console.error(err_1);
                    return [3 /*break*/, 7];
                case 6:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [emailVerify, emailRegistrationId, LL.common, updateCurrentProfile]);
    useEffect(function () {
        if (!showSuccess)
            return;
        var t = setTimeout(function () {
            if (onboarding) {
                onboardingNavigate();
                return;
            }
            navigation.navigate("settings");
        }, SUCCESS_DELAY);
        return function () { return clearTimeout(t); };
    }, [
        showSuccess,
        onboarding,
        onboardingNavigate,
        LL.common,
        LL.EmailRegistrationValidateScreen,
        email,
        navigation,
    ]);
    var header = LL.EmailRegistrationValidateScreen.header({ email: email });
    return (<>
      <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={function () { return setShowSuccess(false); }}>
        <View style={styles.successAnimationContainer}>
          <SuccessIconAnimation>
            <GaloyIcon name="email-add" size={110}/>
            <Text type="h2" style={styles.successText}>
              {LL.common.success()}
            </Text>
          </SuccessIconAnimation>
        </View>
      </Modal>

      <CodeInput send={send} header={header} loading={loading} errorMessage={errorMessage} setErrorMessage={setErrorMessage}/>
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        successText: {
            marginTop: 20,
            textAlign: "center",
            alignSelf: "center",
        },
        successAnimationContainer: {
            flex: 1,
            backgroundColor: colors.white,
            justifyContent: "center",
            alignItems: "center",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=email-registration-validate.js.map