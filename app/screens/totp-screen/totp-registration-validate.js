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
import React, { useCallback, useState } from "react";
import { Alert } from "react-native";
import { gql } from "@apollo/client";
import { CodeInput } from "@app/components/code-input";
import { SettingsScreenDocument, useUserTotpRegistrationValidateMutation, } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userTotpRegistrationValidate($input: UserTotpRegistrationValidateInput!) {\n    userTotpRegistrationValidate(input: $input) {\n      errors {\n        message\n      }\n      me {\n        id\n        totpEnabled\n        phone\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"], ["\n  mutation userTotpRegistrationValidate($input: UserTotpRegistrationValidateInput!) {\n    userTotpRegistrationValidate(input: $input) {\n      errors {\n        message\n      }\n      me {\n        id\n        totpEnabled\n        phone\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"])));
export var TotpRegistrationValidateScreen = function (_a) {
    var route = _a.route;
    var navigation = useNavigation();
    var totpRegistrationValidate = useUserTotpRegistrationValidateMutation()[0];
    var _b = useState(""), errorMessage = _b[0], setErrorMessage = _b[1];
    var _c = useState(false), loading = _c[0], setLoading = _c[1];
    var totpRegistrationId = route.params.totpRegistrationId;
    var appConfig = useAppConfig().appConfig;
    var authToken = appConfig.token;
    var LL = useI18nContext().LL;
    var send = useCallback(function (code) { return __awaiter(void 0, void 0, void 0, function () {
        var res, error, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, 3, 4]);
                    setLoading(true);
                    return [4 /*yield*/, totpRegistrationValidate({
                            variables: { input: { totpCode: code, totpRegistrationId: totpRegistrationId, authToken: authToken } },
                            refetchQueries: [SettingsScreenDocument],
                        })];
                case 1:
                    res = _e.sent();
                    if ((_a = res.data) === null || _a === void 0 ? void 0 : _a.userTotpRegistrationValidate.errors) {
                        error = (_b = res.data.userTotpRegistrationValidate.errors[0]) === null || _b === void 0 ? void 0 : _b.message;
                        // TODO: manage translation for errors
                        setErrorMessage(error);
                    }
                    if ((_d = (_c = res.data) === null || _c === void 0 ? void 0 : _c.userTotpRegistrationValidate.me) === null || _d === void 0 ? void 0 : _d.totpEnabled) {
                        Alert.alert(LL.common.success(), LL.TotpRegistrationValidateScreen.success(), [
                            {
                                text: LL.common.ok(),
                                onPress: function () {
                                    navigation.reset({
                                        routes: [
                                            {
                                                name: "Primary",
                                            },
                                            { name: "accountScreen" },
                                        ],
                                    });
                                },
                            },
                        ]);
                    }
                    return [3 /*break*/, 4];
                case 2:
                    err_1 = _e.sent();
                    console.error(err_1);
                    Alert.alert(LL.common.error());
                    return [3 /*break*/, 4];
                case 3:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [navigation, LL, totpRegistrationId, authToken, totpRegistrationValidate]);
    var header = LL.TotpRegistrationValidateScreen.enter6digitCode();
    return (<CodeInput send={send} header={header} loading={loading} errorMessage={errorMessage} setErrorMessage={setErrorMessage}/>);
};
var templateObject_1;
//# sourceMappingURL=totp-registration-validate.js.map