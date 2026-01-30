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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useCallback } from "react";
import { gql, useApolloClient } from "@apollo/client";
import crashlytics from "@react-native-firebase/crashlytics";
import { updateDeviceSessionCount } from "@app/graphql/client-only-query";
import { useGetUsernamesLazyQuery } from "@app/graphql/generated";
import KeyStoreWrapper from "@app/utils/storage/secureStorage";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useAppConfig } from "./use-app-config";
import { useAutoShowUpgradeModal } from "./use-show-upgrade-modal";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query getUsernames {\n    me {\n      id\n      phone\n      username\n      defaultAccount {\n        id\n      }\n      email {\n        address\n      }\n    }\n  }\n"], ["\n  query getUsernames {\n    me {\n      id\n      phone\n      username\n      defaultAccount {\n        id\n      }\n      email {\n        address\n      }\n    }\n  }\n"])));
export var useSaveSessionProfile = function () {
    var LL = useI18nContext().LL;
    var client = useApolloClient();
    var _a = useAppConfig(), saveToken = _a.saveToken, _b = _a.appConfig, currentToken = _b.token, lnAddressHostname = _b.galoyInstance.lnAddressHostname;
    var resetUpgradeModal = useAutoShowUpgradeModal().resetUpgradeModal;
    var fetchUsername = useGetUsernamesLazyQuery({ fetchPolicy: "no-cache" })[0];
    var blinkUserText = LL.common.blinkUser();
    var hostName = lnAddressHostname;
    var tryFetchUserProps = useCallback(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var data, me, id, username, phone, email, defaultAccount, identifier, err_1;
        var token = _b.token, fetchUsername = _b.fetchUsername;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchUsername({
                            context: { headers: { authorization: "Bearer ".concat(token) } },
                        })];
                case 1:
                    data = (_c.sent()).data;
                    me = data === null || data === void 0 ? void 0 : data.me;
                    if (!me)
                        return [2 /*return*/];
                    id = me.id, username = me.username, phone = me.phone, email = me.email, defaultAccount = me.defaultAccount;
                    identifier = username ||
                        phone ||
                        (email === null || email === void 0 ? void 0 : email.address) ||
                        "".concat(blinkUserText, " - ").concat(defaultAccount.id.slice(-6));
                    return [2 /*return*/, {
                            userId: id,
                            identifier: identifier,
                            token: token,
                            selected: true,
                            phone: phone,
                            email: email === null || email === void 0 ? void 0 : email.address,
                            accountId: defaultAccount === null || defaultAccount === void 0 ? void 0 : defaultAccount.id,
                            hasUsername: Boolean(username),
                            lnAddressHostname: hostName,
                        }];
                case 2:
                    err_1 = _c.sent();
                    if (err_1 instanceof Error)
                        crashlytics().recordError(err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [blinkUserText, hostName]);
    var saveProfile = useCallback(function (token) { return __awaiter(void 0, void 0, void 0, function () {
        var profiles, alreadyStored, profile, exists, cleaned, updatedProfiles;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token)
                        return [2 /*return*/];
                    return [4 /*yield*/, saveToken(token)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, KeyStoreWrapper.getSessionProfiles()];
                case 2:
                    profiles = _a.sent();
                    alreadyStored = profiles.find(function (p) { return p.token === token; });
                    if (alreadyStored)
                        return [2 /*return*/];
                    return [4 /*yield*/, tryFetchUserProps({ token: token, fetchUsername: fetchUsername })];
                case 3:
                    profile = _a.sent();
                    if (!profile)
                        return [2 /*return*/];
                    resetUpgradeModal();
                    updateDeviceSessionCount(client, { reset: true });
                    exists = profiles.some(function (p) { return p.accountId === profile.accountId; });
                    cleaned = profiles.map(function (p) { return (__assign(__assign({}, p), { selected: false })); });
                    if (!!exists) return [3 /*break*/, 5];
                    return [4 /*yield*/, KeyStoreWrapper.saveSessionProfiles(__spreadArray([__assign({}, profile)], cleaned, true))];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5:
                    updatedProfiles = cleaned.map(function (p) {
                        return p.accountId === profile.accountId ? __assign(__assign({}, profile), { selected: true }) : p;
                    });
                    return [4 /*yield*/, KeyStoreWrapper.saveSessionProfiles(updatedProfiles)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [saveToken, tryFetchUserProps, fetchUsername, resetUpgradeModal, client]);
    var updateCurrentProfile = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var profiles, currentProfile, updatedProfiles;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, KeyStoreWrapper.getSessionProfiles()];
                case 1:
                    profiles = _a.sent();
                    return [4 /*yield*/, tryFetchUserProps({ token: currentToken, fetchUsername: fetchUsername })];
                case 2:
                    currentProfile = _a.sent();
                    if (!currentProfile)
                        return [2 /*return*/];
                    updatedProfiles = profiles.map(function (p) {
                        return p.accountId === currentProfile.accountId ? currentProfile : p;
                    });
                    return [4 /*yield*/, KeyStoreWrapper.saveSessionProfiles(updatedProfiles)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [fetchUsername, tryFetchUserProps, currentToken]);
    return {
        saveProfile: saveProfile,
        updateCurrentProfile: updateCurrentProfile,
    };
};
var templateObject_1;
//# sourceMappingURL=use-save-session-profile.js.map