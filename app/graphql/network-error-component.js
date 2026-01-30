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
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import useLogout from "@app/hooks/use-logout";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useAppConfig } from "@app/hooks";
import { toastShow } from "@app/utils/toast";
import { useNavigation } from "@react-navigation/native";
import { useSwitchToNextProfile } from "@app/hooks/use-switch-to-next-profile";
import { NetworkErrorCode } from "./error-code";
import { useNetworkError } from "./network-error-context";
export var NetworkErrorComponent = function () {
    var navigation = useNavigation();
    var _a = useNetworkError(), networkError = _a.networkError, clearNetworkError = _a.clearNetworkError, networkErrorToken = _a.token;
    var LL = useI18nContext().LL;
    var logout = useLogout().logout;
    var appConfig = useAppConfig().appConfig;
    var switchToNextProfile = useSwitchToNextProfile().switchToNextProfile;
    var _b = useState(false), showedAlert = _b[0], setShowedAlert = _b[1];
    var isHandlingTokenExpiry = useRef(false);
    var handleTokenExpiry = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var resetSyncFlag, currentToken, nextProfile, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isHandlingTokenExpiry.current) {
                        console.debug("Already handling token expiry, skipping");
                        return [2 /*return*/];
                    }
                    isHandlingTokenExpiry.current = true;
                    resetSyncFlag = function () {
                        isHandlingTokenExpiry.current = false;
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, 9, 10]);
                    currentToken = appConfig.token;
                    if (!!currentToken) return [3 /*break*/, 3];
                    return [4 /*yield*/, logout()];
                case 2:
                    _a.sent();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "getStarted" }],
                    });
                    return [2 /*return*/];
                case 3:
                    if (networkErrorToken !== currentToken) {
                        console.debug("Ignoring 401 for non-active token", {
                            networkErrorToken: networkErrorToken,
                            currentToken: currentToken,
                        });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, switchToNextProfile(networkErrorToken)];
                case 4:
                    nextProfile = _a.sent();
                    if (nextProfile) {
                        return [2 /*return*/];
                    }
                    if (!!showedAlert) return [3 /*break*/, 6];
                    setShowedAlert(true);
                    return [4 /*yield*/, logout()];
                case 5:
                    _a.sent();
                    Alert.alert(LL.common.reauth(), "", [
                        {
                            text: LL.common.ok(),
                            onPress: function () {
                                setShowedAlert(false);
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: "getStarted" }],
                                });
                            },
                        },
                    ]);
                    _a.label = 6;
                case 6: return [3 /*break*/, 10];
                case 7:
                    error_1 = _a.sent();
                    console.error("Error handling token expiry:", error_1);
                    return [4 /*yield*/, logout()];
                case 8:
                    _a.sent();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "getStarted" }],
                    });
                    return [3 /*break*/, 10];
                case 9:
                    resetSyncFlag();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    }); }, [
        appConfig.token,
        logout,
        LL,
        navigation,
        networkErrorToken,
        showedAlert,
        switchToNextProfile,
    ]);
    useEffect(function () {
        var _a, _b, _c;
        if (!networkError) {
            return;
        }
        if ("statusCode" in networkError) {
            if (networkError.statusCode >= 500) {
                // TODO translation
                toastShow({
                    message: function (translations) { return translations.errors.network.server(); },
                    LL: LL,
                });
                clearNetworkError();
                return;
            }
            if (networkError.statusCode >= 400 && networkError.statusCode < 500) {
                var errorCode_1 = "result" in networkError &&
                    typeof networkError.result !== "string" &&
                    ((_c = (_b = (_a = networkError.result) === null || _a === void 0 ? void 0 : _a.errors) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code)
                    ? networkError.result.errors[0].code
                    : undefined;
                if (!errorCode_1) {
                    switch (networkError.statusCode) {
                        case 401:
                            errorCode_1 = NetworkErrorCode.InvalidAuthentication;
                            break;
                    }
                }
                switch (errorCode_1) {
                    case NetworkErrorCode.InvalidAuthentication:
                        handleTokenExpiry();
                        break;
                    default:
                        // TODO translation
                        toastShow({
                            message: function (translations) {
                                return "StatusCode: ".concat(networkError.statusCode, "\nError code: ").concat(errorCode_1, "\n").concat(translations.errors.network.request());
                            },
                            LL: LL,
                        });
                        break;
                }
                clearNetworkError();
                return;
            }
        }
        if ("message" in networkError && networkError.message === "Network request failed") {
            // TODO translation
            toastShow({
                message: function (translations) { return translations.errors.network.connection(); },
                LL: LL,
            });
            clearNetworkError();
        }
    }, [networkError, clearNetworkError, LL, handleTokenExpiry]);
    return <></>;
};
//# sourceMappingURL=network-error-component.js.map