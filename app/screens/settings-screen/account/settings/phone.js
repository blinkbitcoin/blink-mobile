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
import React from "react";
import { Alert } from "react-native";
import { gql } from "@apollo/client";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useUserPhoneDeleteMutation } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../../row";
import { useLoginMethods } from "../login-methods-hook";
import { useTheme } from "@rn-vui/themed";
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userPhoneDelete {\n    userPhoneDelete {\n      errors {\n        message\n      }\n      me {\n        id\n        phone\n        totpEnabled\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"], ["\n  mutation userPhoneDelete {\n    userPhoneDelete {\n      errors {\n        message\n      }\n      me {\n        id\n        phone\n        totpEnabled\n        email {\n          address\n          verified\n        }\n      }\n    }\n  }\n"])));
export var PhoneSetting = function () {
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var navigate = useNavigation().navigate;
    var _a = useLoginMethods(), loading = _a.loading, phone = _a.phone, emailVerified = _a.emailVerified, phoneVerified = _a.phoneVerified;
    var updateCurrentProfile = useSaveSessionProfile().updateCurrentProfile;
    var _b = useUserPhoneDeleteMutation(), phoneDeleteMutation = _b[0], phoneDeleteLoading = _b[1].loading;
    var deletePhone = function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, phoneDeleteMutation()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, updateCurrentProfile()];
                case 2:
                    _a.sent();
                    toastShow({
                        message: LL.AccountScreen.phoneDeletedSuccessfully(),
                        LL: LL,
                        type: "success",
                    });
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    Alert.alert(LL.common.error(), err_1 instanceof Error ? err_1.message : "");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var deletePhonePrompt = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            Alert.alert(LL.AccountScreen.deletePhonePromptTitle(), LL.AccountScreen.deletePhonePromptContent(), [
                { text: LL.common.cancel(), onPress: function () { } },
                {
                    text: LL.common.yes(),
                    onPress: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            deletePhone();
                            return [2 /*return*/];
                        });
                    }); },
                },
            ]);
            return [2 /*return*/];
        });
    }); };
    return (<SettingsRow loading={loading} title={phoneVerified ? phone || "" : LL.AccountScreen.tapToAddPhoneNumber()} leftIcon="call-outline" action={phoneVerified ? null : function () { return navigate("phoneRegistrationInitiate"); }} spinner={phoneDeleteLoading} rightIcon={phoneVerified ? (emailVerified ? (<GaloyIcon name="close" size={20} color={colors.red}/>) : null) : ("chevron-forward")} rightIconAction={phoneVerified && emailVerified ? deletePhonePrompt : undefined}/>);
};
var templateObject_1;
//# sourceMappingURL=phone.js.map