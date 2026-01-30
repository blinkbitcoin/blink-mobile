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
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import axios from "axios";
import analytics from "@react-native-firebase/analytics";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { BLINK_DEEP_LINK_PREFIX, TELEGRAM_CALLBACK_PATH } from "@app/config";
import { formatPublicKey } from "@app/utils/format-public-key";
import { useAppConfig, useSaveSessionProfile } from "@app/hooks";
import { gql } from "@apollo/client";
import { AccountLevel, useLevel } from "@app/graphql/level-context";
import { useUserLoginUpgradeTelegramMutation } from "@app/graphql/generated";
export var ErrorType = {
    FetchParamsError: "FetchParamsError",
    FetchLoginError: "FetchLoginError",
    TimeoutError: "TimeoutError",
    OpenAppError: "OpenAppError",
};
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userLoginUpgradeTelegram($input: UserLoginUpgradeTelegramInput!) {\n    userLoginUpgradeTelegram(input: $input) {\n      errors {\n        message\n        code\n      }\n      success\n    }\n  }\n"], ["\n  mutation userLoginUpgradeTelegram($input: UserLoginUpgradeTelegramInput!) {\n    userLoginUpgradeTelegram(input: $input) {\n      errors {\n        message\n        code\n      }\n      success\n    }\n  }\n"])));
export var useTelegramLogin = function (phone, onboarding) {
    if (onboarding === void 0) { onboarding = false; }
    var navigation = useNavigation();
    var _a = useSaveSessionProfile(), saveProfile = _a.saveProfile, updateCurrentProfile = _a.updateCurrentProfile;
    var _b = useState(false), loading = _b[0], setLoading = _b[1];
    var _c = useState(null), error = _c[0], setError = _c[1];
    var _d = useState(null), authData = _d[0], setAuthData = _d[1];
    var _e = useState(false), isPollingForAuth = _e[0], setIsPollingForAuth = _e[1];
    var pollingIntervalRef = useRef(null);
    var pollingAttemptsRef = useRef(0);
    var hasLoggedInRef = useRef(false);
    var MAX_POLLING_ATTEMPTS = 3;
    var POLLING_INTERVAL_MS = 5000;
    var TELEGRAM_CALLBACK = encodeURIComponent("".concat(BLINK_DEEP_LINK_PREFIX, "/").concat(TELEGRAM_CALLBACK_PATH));
    var authUrl = useAppConfig().appConfig.galoyInstance.authUrl;
    var currentLevel = useLevel().currentLevel;
    var isUpgradeFlow = onboarding || currentLevel === AccountLevel.Zero;
    var userLoginUpgradeTelegramMutation = useUserLoginUpgradeTelegramMutation({
        fetchPolicy: "no-cache",
    })[0];
    var clearPolling = function () {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            pollingAttemptsRef.current = 0;
            setIsPollingForAuth(false);
        }
    };
    var getTelegramPassportRequestParams = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var url, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    url = "".concat(authUrl, "/auth/telegram-passport/request-params");
                    return [4 /*yield*/, axios.post(url, { phone: phone })];
                case 1:
                    data = (_a.sent()).data;
                    return [2 /*return*/, {
                            botId: data.bot_id,
                            scope: encodeURIComponent(JSON.stringify(data.scope)),
                            publicKey: encodeURIComponent(formatPublicKey(data.public_key)),
                            nonce: data.nonce,
                        }];
                case 2:
                    err_1 = _a.sent();
                    throw new Error(ErrorType.FetchParamsError);
                case 3: return [2 /*return*/];
            }
        });
    }); }, [authUrl, phone]);
    var loginWithTelegramPassport = useCallback(function (nonce) { return __awaiter(void 0, void 0, void 0, function () {
        var url, data, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    url = "".concat(authUrl, "/auth/telegram-passport/login");
                    return [4 /*yield*/, axios.post(url, { phone: phone, nonce: nonce })];
                case 1:
                    data = (_a.sent()).data;
                    return [2 /*return*/, data];
                case 2:
                    err_2 = _a.sent();
                    throw new Error(ErrorType.FetchLoginError);
                case 3: return [2 /*return*/];
            }
        });
    }); }, [authUrl, phone]);
    var setHasLoggedInTrue = function () {
        hasLoggedInRef.current = true;
    };
    var navigateAfterAuth = useCallback(function (authToken) {
        var createOrUpdateProfile = authToken
            ? function () { return saveProfile(authToken); }
            : updateCurrentProfile;
        createOrUpdateProfile();
        if (onboarding) {
            navigation.replace("onboarding", {
                screen: "welcomeLevel1",
                params: { onboarding: onboarding },
            });
            return;
        }
        navigation.replace("Primary");
    }, [navigation, onboarding, saveProfile, updateCurrentProfile]);
    var upgradeLoginWithTelegram = useCallback(function (nonce) { return __awaiter(void 0, void 0, void 0, function () {
        var data, success, message;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, userLoginUpgradeTelegramMutation({
                        variables: { input: { phone: phone, nonce: nonce } },
                    })];
                case 1:
                    data = (_e.sent()).data;
                    success = (_a = data === null || data === void 0 ? void 0 : data.userLoginUpgradeTelegram) === null || _a === void 0 ? void 0 : _a.success;
                    if (success)
                        return [2 /*return*/, success];
                    message = ((_d = (_c = (_b = data === null || data === void 0 ? void 0 : data.userLoginUpgradeTelegram) === null || _b === void 0 ? void 0 : _b.errors) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) || ErrorType.FetchLoginError;
                    throw new Error(message);
            }
        });
    }); }, [userLoginUpgradeTelegramMutation, phone]);
    var checkIfAuthorized = useCallback(function (nonce) { return __awaiter(void 0, void 0, void 0, function () {
        var success, result, e_1, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (hasLoggedInRef.current)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    if (!isUpgradeFlow) return [3 /*break*/, 3];
                    return [4 /*yield*/, upgradeLoginWithTelegram(nonce)];
                case 2:
                    success = _a.sent();
                    if (!success)
                        return [2 /*return*/];
                    setHasLoggedInTrue();
                    clearPolling();
                    navigateAfterAuth();
                    return [2 /*return*/];
                case 3: return [4 /*yield*/, loginWithTelegramPassport(nonce)];
                case 4:
                    result = _a.sent();
                    if (!(result === null || result === void 0 ? void 0 : result.authToken) || hasLoggedInRef.current)
                        return [2 /*return*/];
                    setHasLoggedInTrue();
                    clearPolling();
                    analytics().logLogin({ method: "telegram" });
                    if (result.totpRequired) {
                        navigation.navigate("totpLoginValidate", { authToken: result.authToken });
                        return [2 /*return*/];
                    }
                    navigateAfterAuth(result.authToken);
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _a.sent();
                    message = e_1.message;
                    if (message.includes("Authorization data from Telegram is still pending"))
                        return [2 /*return*/];
                    clearPolling();
                    setError(message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [
        navigateAfterAuth,
        loginWithTelegramPassport,
        isUpgradeFlow,
        upgradeLoginWithTelegram,
        navigation,
    ]);
    useFocusEffect(useCallback(function () {
        if (!(authData === null || authData === void 0 ? void 0 : authData.nonce))
            return;
        var handleDeepLink = function (_a) {
            var url = _a.url;
            var cleanUrl = url.replace("".concat(BLINK_DEEP_LINK_PREFIX, "/"), "");
            var _b = cleanUrl.split("&"), path = _b[0], query = _b[1];
            if (!path.includes(TELEGRAM_CALLBACK_PATH))
                return;
            var params = new URLSearchParams(query);
            if (params.get("tg_passport") === "success") {
                clearPolling();
                setIsPollingForAuth(true);
                pollingIntervalRef.current = setInterval(function () {
                    pollingAttemptsRef.current += 1;
                    if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
                        clearPolling();
                        setError(ErrorType.TimeoutError);
                        return;
                    }
                    checkIfAuthorized(authData.nonce);
                }, POLLING_INTERVAL_MS);
            }
        };
        var sub = Linking.addEventListener("url", handleDeepLink);
        return function () {
            sub.remove();
        };
    }, [authData, checkIfAuthorized]));
    useEffect(function () {
        return function () {
            clearPolling();
        };
    }, []);
    var handleTelegramLogin = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var data, deepLink, fallbackLink, canOpen, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, 5, 6]);
                    setError(null);
                    setLoading(true);
                    return [4 /*yield*/, getTelegramPassportRequestParams()];
                case 1:
                    data = _a.sent();
                    setAuthData(data);
                    deepLink = "tg://passport?bot_id=".concat(data.botId, "&scope=").concat(data.scope, "&public_key=").concat(data.publicKey, "&nonce=").concat(data.nonce, "&callback_url=").concat(TELEGRAM_CALLBACK);
                    fallbackLink = "https://telegram.me/telegrampassport?bot_id=".concat(data.botId, "&scope=").concat(data.scope, "&public_key=").concat(data.publicKey, "&nonce=").concat(data.nonce, "&callback_url=").concat(TELEGRAM_CALLBACK);
                    clearPolling();
                    return [4 /*yield*/, Linking.canOpenURL(deepLink)];
                case 2:
                    canOpen = _a.sent();
                    return [4 /*yield*/, Linking.openURL(canOpen ? deepLink : fallbackLink).catch(function () {
                            setError(ErrorType.OpenAppError);
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_3 = _a.sent();
                    setError(err_3.message || "Unexpected error occurred");
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [TELEGRAM_CALLBACK, getTelegramPassportRequestParams]);
    return {
        loading: loading,
        error: error,
        isPollingForAuth: isPollingForAuth,
        handleTelegramLogin: handleTelegramLogin,
    };
};
var templateObject_1;
//# sourceMappingURL=telegram-auth.js.map