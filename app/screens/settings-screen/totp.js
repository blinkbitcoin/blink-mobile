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
import React, { useState } from "react";
import { Alert } from "react-native";
import { gql } from "@apollo/client";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { useSettingsScreenQuery, useUserTotpDeleteMutation } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "./row";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userTotpDelete {\n    userTotpDelete {\n      errors {\n        message\n      }\n      me {\n        id\n        phone\n        totpEnabled\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"], ["\n  mutation userTotpDelete {\n    userTotpDelete {\n      errors {\n        message\n      }\n      me {\n        id\n        phone\n        totpEnabled\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"])));
export var TotpSetting = function () {
    var _a;
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    var _b = useState(false), spinner = _b[0], setSpinner = _b[1];
    var _c = useSettingsScreenQuery({ fetchPolicy: "cache-only" }), data = _c.data, loading = _c.loading, refetchTotpSettings = _c.refetch;
    var totpDeleteMutation = useUserTotpDeleteMutation()[0];
    var totpEnabled = Boolean((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.totpEnabled);
    var totpDelete = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            Alert.alert(LL.AccountScreen.totpDeleteAlertTitle(), LL.AccountScreen.totpDeleteAlertContent(), [
                { text: LL.common.cancel(), onPress: function () { } },
                {
                    text: LL.common.ok(),
                    onPress: function () { return __awaiter(void 0, void 0, void 0, function () {
                        var res, _a;
                        var _b, _c, _d, _e, _f, _g, _h;
                        return __generator(this, function (_j) {
                            switch (_j.label) {
                                case 0:
                                    setSpinner(true);
                                    _j.label = 1;
                                case 1:
                                    _j.trys.push([1, 4, , 5]);
                                    return [4 /*yield*/, totpDeleteMutation()];
                                case 2:
                                    res = _j.sent();
                                    return [4 /*yield*/, refetchTotpSettings()];
                                case 3:
                                    _j.sent();
                                    setSpinner(false);
                                    if (((_d = (_c = (_b = res.data) === null || _b === void 0 ? void 0 : _b.userTotpDelete) === null || _c === void 0 ? void 0 : _c.me) === null || _d === void 0 ? void 0 : _d.totpEnabled) === false) {
                                        Alert.alert(LL.AccountScreen.totpDeactivated());
                                    }
                                    else {
                                        console.log((_e = res.data) === null || _e === void 0 ? void 0 : _e.userTotpDelete.errors);
                                        Alert.alert(LL.common.error(), (_h = (_g = (_f = res.data) === null || _f === void 0 ? void 0 : _f.userTotpDelete) === null || _g === void 0 ? void 0 : _g.errors[0]) === null || _h === void 0 ? void 0 : _h.message);
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    _a = _j.sent();
                                    Alert.alert(LL.common.error());
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); },
                },
            ]);
            return [2 /*return*/];
        });
    }); };
    return (<SettingsRow loading={loading} spinner={spinner} title={LL.AccountScreen.totp()} subtitle={totpEnabled ? LL.common.enabled() : undefined} leftIcon="lock-closed-outline" action={totpEnabled
            ? null
            : function () {
                navigate("totpRegistrationInitiate");
            }} rightIcon={totpEnabled ? (<GaloyIconButton name="close" size="medium" onPress={totpDelete}/>) : undefined}/>);
};
var templateObject_1;
//# sourceMappingURL=totp.js.map