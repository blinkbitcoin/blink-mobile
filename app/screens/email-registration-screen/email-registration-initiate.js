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
import { Alert, View } from "react-native";
import validator from "validator";
import { gql } from "@apollo/client";
import { useNavigation } from "@react-navigation/native";
import { Input, Text, makeStyles } from "@rn-vui/themed";
import { testProps } from "@app/utils/testProps";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Screen } from "@app/components/screen";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { useUserEmailRegistrationInitiateMutation } from "@app/graphql/generated";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        buttonsContainer: {
            flex: 1,
            justifyContent: "flex-end",
            marginBottom: 10,
        },
        secondaryButtonContainer: {
            marginTop: 15,
            marginBottom: -15,
        },
        inputContainer: {
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "stretch",
            minHeight: 48,
        },
        textContainer: {
            marginBottom: 25,
        },
        viewWrapper: { flex: 1 },
        inputContainerStyle: {
            flex: 1,
            borderWidth: 2,
            borderBottomWidth: 2,
            paddingHorizontal: 10,
            borderColor: colors.primary5,
            borderRadius: 8,
        },
        errorContainer: {
            marginBottom: 20,
        },
    });
});
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {\n    userEmailRegistrationInitiate(input: $input) {\n      errors {\n        message\n      }\n      emailRegistrationId\n      me {\n        id\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"], ["\n  mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {\n    userEmailRegistrationInitiate(input: $input) {\n      errors {\n        message\n      }\n      emailRegistrationId\n      me {\n        id\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"])));
export var EmailRegistrationInitiateScreen = function (_a) {
    var _b;
    var route = _a.route;
    var styles = useStyles();
    var navigation = useNavigation();
    var _c = React.useState(""), emailInput = _c[0], setEmailInput = _c[1];
    var _d = React.useState(""), errorMessage = _d[0], setErrorMessage = _d[1];
    var _e = React.useState(false), loading = _e[0], setLoading = _e[1];
    var _f = (_b = route.params) !== null && _b !== void 0 ? _b : {}, _g = _f.onboarding, onboarding = _g === void 0 ? false : _g, _h = _f.hasUsername, hasUsername = _h === void 0 ? false : _h;
    var LL = useI18nContext().LL;
    var setEmailMutation = useUserEmailRegistrationInitiateMutation()[0];
    var submit = function () { return __awaiter(void 0, void 0, void 0, function () {
        var data, errors, emailRegistrationId, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!validator.isEmail(emailInput)) {
                        setErrorMessage(LL.EmailRegistrationInitiateScreen.invalidEmail());
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, setEmailMutation({
                            variables: { input: { email: emailInput } },
                        })];
                case 2:
                    data = (_a.sent()).data;
                    errors = data === null || data === void 0 ? void 0 : data.userEmailRegistrationInitiate.errors;
                    if (errors && errors.length > 0) {
                        console.log(errors, "errors");
                        setErrorMessage(errors[0].message);
                        return [2 /*return*/];
                    }
                    emailRegistrationId = data === null || data === void 0 ? void 0 : data.userEmailRegistrationInitiate.emailRegistrationId;
                    if (emailRegistrationId) {
                        navigation.navigate("emailRegistrationValidate", {
                            emailRegistrationId: emailRegistrationId,
                            email: emailInput,
                            onboarding: onboarding,
                            hasUsername: hasUsername,
                        });
                    }
                    else {
                        setErrorMessage(LL.EmailRegistrationInitiateScreen.missingEmailRegistrationId());
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    if (err_1 instanceof Error) {
                        Alert.alert(LL.common.error(), err_1.message);
                    }
                    console.error(err_1, "error in setEmailMutation");
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var onboardingNavigate = function () {
        if (hasUsername) {
            navigation.navigate("onboarding", {
                screen: "supportScreen",
            });
            return;
        }
        navigation.navigate("onboarding", {
            screen: "lightningBenefits",
            params: { onboarding: onboarding },
        });
    };
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"h2"}>{LL.EmailRegistrationInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Input {...testProps(LL.EmailRegistrationInitiateScreen.placeholder())} placeholder={LL.EmailRegistrationInitiateScreen.placeholder()} autoCapitalize="none" inputContainerStyle={styles.inputContainerStyle} renderErrorMessage={false} textContentType="emailAddress" keyboardType="email-address" value={emailInput} onChangeText={setEmailInput} autoFocus={true}/>
        </View>
        {errorMessage && (<View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage}/>
          </View>)}

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton title={LL.EmailRegistrationInitiateScreen.send()} loading={loading} disabled={!validator.isEmail(emailInput)} onPress={submit}/>
          {onboarding && (<GaloySecondaryButton title={LL.UpgradeAccountModal.notNow()} onPress={onboardingNavigate} containerStyle={styles.secondaryButtonContainer}/>)}
        </View>
      </View>
    </Screen>);
};
var templateObject_1;
//# sourceMappingURL=email-registration-initiate.js.map