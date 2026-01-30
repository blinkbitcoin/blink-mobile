var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, Alert, View } from "react-native";
import { Input, Text, makeStyles, useTheme } from "@rn-vui/themed";
import { gql } from "@apollo/client";
import { Screen } from "@app/components/screen";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { OnboardingStatus, useFullOnboardingScreenQuery, useKycFlowStartMutation, } from "@app/graphql/generated";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation kycFlowStart($input: KycFlowStartInput!) {\n    kycFlowStart(input: $input) {\n      workflowRunId\n      tokenWeb\n    }\n  }\n\n  query fullOnboardingScreen {\n    me {\n      id\n      defaultAccount {\n        ... on ConsumerAccount {\n          id\n          onboardingStatus\n        }\n      }\n    }\n  }\n"], ["\n  mutation kycFlowStart($input: KycFlowStartInput!) {\n    kycFlowStart(input: $input) {\n      workflowRunId\n      tokenWeb\n    }\n  }\n\n  query fullOnboardingScreen {\n    me {\n      id\n      defaultAccount {\n        ... on ConsumerAccount {\n          id\n          onboardingStatus\n        }\n      }\n    }\n  }\n"])));
export var FullOnboardingFlowScreen = function () {
    var _a, _b;
    var navigation = useNavigation();
    var navigate = navigation.navigate, goBack = navigation.goBack;
    var _c = useI18nContext(), LL = _c.LL, locale = _c.locale;
    var styles = useStyles();
    var _d = useTheme().theme, colors = _d.colors, mode = _d.mode;
    var _e = useFullOnboardingScreenQuery({ fetchPolicy: "network-only" }), data = _e.data, loading = _e.loading;
    var onboardingStatus = (_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.onboardingStatus;
    var _f = useState(false), loadingKyc = _f[0], setLoadingKyc = _f[1];
    var _g = useState(""), firstName = _g[0], setFirstName = _g[1];
    var _h = useState(""), lastName = _h[0], setLastName = _h[1];
    var kycFlowStart = useKycFlowStartMutation()[0];
    var kycUrl = useAppConfig().appConfig.galoyInstance.kycUrl;
    var confirmNames = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            Alert.alert(LL.FullOnboarding.confirmNameTitle(), LL.FullOnboarding.confirmNameContent({ firstName: firstName, lastName: lastName }), [
                { text: LL.common.cancel(), onPress: function () { } },
                {
                    text: LL.common.yes(),
                    onPress: startKyc,
                },
            ]);
            return [2 /*return*/];
        });
    }); };
    var startKyc = React.useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var res, token, workflowRunId, theme, query, workflowRunIdParam, url, err_1, message;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    setLoadingKyc(true);
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, kycFlowStart({
                            variables: { input: { firstName: firstName, lastName: lastName } },
                        })];
                case 2:
                    res = _g.sent();
                    token = (_c = (_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.kycFlowStart) === null || _b === void 0 ? void 0 : _b.tokenWeb) !== null && _c !== void 0 ? _c : "";
                    workflowRunId = (_f = (_e = (_d = res.data) === null || _d === void 0 ? void 0 : _d.kycFlowStart) === null || _e === void 0 ? void 0 : _e.workflowRunId) !== null && _f !== void 0 ? _f : "";
                    theme = mode === "dark" || mode === "light" ? mode : "";
                    query = new URLSearchParams(__assign(__assign({ token: token }, (locale && { lang: locale })), (theme && { theme: theme }))).toString();
                    workflowRunIdParam = workflowRunId ? "&workflow_run_id=".concat(workflowRunId) : "";
                    url = "".concat(kycUrl, "/webflow?").concat(query).concat(workflowRunIdParam);
                    navigate("webView", {
                        url: url,
                        headerTitle: LL.UpgradeAccountModal.title(),
                    });
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _g.sent();
                    console.error(err_1, "error");
                    message = "";
                    if (err_1 instanceof Error) {
                        message = err_1.message;
                    }
                    if (message.match(/canceled/i)) {
                        goBack();
                        setLoadingKyc(false);
                        return [2 /*return*/];
                    }
                    Alert.alert(LL.FullOnboarding.error(), "".concat(LL.GaloyAddressScreen.somethingWentWrong(), "\n\n").concat(message), [
                        {
                            text: LL.common.ok(),
                            onPress: function () {
                                goBack();
                            },
                        },
                    ]);
                    return [3 /*break*/, 5];
                case 4:
                    setLoadingKyc(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [LL, firstName, lastName, locale, mode, navigate, goBack, kycFlowStart, kycUrl]);
    useEffect(function () {
        if (onboardingStatus === OnboardingStatus.AwaitingInput) {
            startKyc();
        }
    }, [onboardingStatus, startKyc]);
    if (loading) {
        return (<Screen preset="scroll" keyboardShouldPersistTaps="handled" keyboardOffset="navigationHeader" style={styles.screenStyle}>
        <View style={styles.verticalAlignment}>
          <ActivityIndicator animating size="large" color={colors.primary}/>
        </View>
      </Screen>);
    }
    if (onboardingStatus === OnboardingStatus.Abandoned ||
        onboardingStatus === OnboardingStatus.Approved ||
        onboardingStatus === OnboardingStatus.Declined ||
        onboardingStatus === OnboardingStatus.Error ||
        onboardingStatus === OnboardingStatus.Processing ||
        onboardingStatus === OnboardingStatus.Review) {
        return (<Screen preset="scroll" keyboardShouldPersistTaps="handled" keyboardOffset="navigationHeader" style={styles.screenStyle}>
        <Text type="h2" style={styles.textStyle}>{"".concat(LL.FullOnboarding.status()).concat(LL.FullOnboarding[onboardingStatus](), ".")}</Text>
        <ContactSupportButton />
      </Screen>);
    }
    return (<Screen preset="scroll" keyboardShouldPersistTaps="handled" keyboardOffset="navigationHeader" style={styles.screenStyle}>
      <View style={styles.innerView}>
        <Text type="h2" style={styles.textStyle}>
          {LL.FullOnboarding.requirements()}
        </Text>
        <>
          <Input placeholder={LL.FullOnboarding.firstName()} value={firstName} onChangeText={function (text) { return setFirstName(text); }}/>
          <Input placeholder={LL.FullOnboarding.lastName()} value={lastName} onChangeText={function (text) { return setLastName(text); }}/>
        </>
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton onPress={confirmNames} title={LL.common.next()} disabled={!firstName || !lastName} loading={loadingKyc}/>
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    screenStyle: {
        flex: 1,
    },
    innerView: {
        flex: 1,
        padding: 20,
    },
    textStyle: {
        marginBottom: 32,
    },
    buttonContainer: {
        flex: 1,
        justifyContent: "flex-end",
        paddingBottom: 15,
    },
    verticalAlignment: { flex: 1, justifyContent: "center", alignItems: "center" },
}); });
var templateObject_1;
//# sourceMappingURL=full-onboarding-flow.js.map