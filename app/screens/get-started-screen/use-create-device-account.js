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
import { useState, useCallback } from "react";
import * as Keychain from "react-native-keychain";
import { generateSecureRandom } from "react-native-securerandom";
import { v4 as uuidv4 } from "uuid";
import { useNavigation } from "@react-navigation/native";
import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";
import { useAppConfig, useSaveSessionProfile } from "@app/hooks";
import { logAttemptCreateDeviceAccount, logCreateDeviceAccountFailure, logCreatedDeviceAccount, } from "@app/utils/analytics";
var DEVICE_ACCOUNT_CREDENTIALS_KEY = "device-account";
var generateSecureRandomUUID = function () { return __awaiter(void 0, void 0, void 0, function () {
    var randomBytes;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, generateSecureRandom(16)];
            case 1:
                randomBytes = _a.sent();
                return [2 /*return*/, uuidv4({ random: randomBytes })];
        }
    });
}); };
export var useCreateDeviceAccount = function () {
    var _a = useState(false), loading = _a[0], setLoading = _a[1];
    var _b = useState(false), hasError = _b[0], setHasError = _b[1];
    var authUrl = useAppConfig().appConfig.galoyInstance.authUrl;
    var saveProfile = useSaveSessionProfile().saveProfile;
    var navigation = useNavigation();
    var getOrCreateCredentials = function () { return __awaiter(void 0, void 0, void 0, function () {
        var credentials, username, _a, password, _b, keychainRes;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Keychain.getInternetCredentials(DEVICE_ACCOUNT_CREDENTIALS_KEY)];
                case 1:
                    credentials = _c.sent();
                    if (!credentials) return [3 /*break*/, 2];
                    _a = credentials.username;
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, generateSecureRandomUUID()];
                case 3:
                    _a = _c.sent();
                    _c.label = 4;
                case 4:
                    username = _a;
                    if (!credentials) return [3 /*break*/, 5];
                    _b = credentials.password;
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, generateSecureRandomUUID()];
                case 6:
                    _b = _c.sent();
                    _c.label = 7;
                case 7:
                    password = _b;
                    if (!!credentials) return [3 /*break*/, 9];
                    return [4 /*yield*/, Keychain.setInternetCredentials(DEVICE_ACCOUNT_CREDENTIALS_KEY, username, password)];
                case 8:
                    keychainRes = _c.sent();
                    if (!keychainRes)
                        throw new Error("Failed to save credentials");
                    _c.label = 9;
                case 9: return [2 /*return*/, { username: username, password: password }];
            }
        });
    }); };
    var createDeviceAccountAndLogin = useCallback(function (appCheckToken, onClose) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, username, password, auth, res, data, authToken, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, 5, 6]);
                    setLoading(true);
                    setHasError(false);
                    return [4 /*yield*/, getOrCreateCredentials()];
                case 1:
                    _a = _b.sent(), username = _a.username, password = _a.password;
                    auth = Buffer.from("".concat(username, ":").concat(password), "utf8").toString("base64");
                    logAttemptCreateDeviceAccount();
                    return [4 /*yield*/, fetch("".concat(authUrl, "/auth/create/device-account"), {
                            method: "POST",
                            headers: {
                                Authorization: "Basic ".concat(auth),
                                Appcheck: appCheckToken || "undefined",
                            },
                        })];
                case 2:
                    res = _b.sent();
                    return [4 /*yield*/, res.json()];
                case 3:
                    data = _b.sent();
                    authToken = data.result;
                    if (!authToken) {
                        throw new Error("Missing session token");
                    }
                    logCreatedDeviceAccount();
                    analytics().logLogin({ method: "device" });
                    saveProfile(authToken);
                    navigation.replace("Primary");
                    onClose === null || onClose === void 0 ? void 0 : onClose();
                    return [3 /*break*/, 6];
                case 4:
                    err_1 = _b.sent();
                    setHasError(true);
                    logCreateDeviceAccountFailure();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                    }
                    console.error("Device account creation error:", err_1);
                    throw err_1;
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [authUrl, navigation, saveProfile]);
    return {
        createDeviceAccountAndLogin: createDeviceAccountAndLogin,
        loading: loading,
        hasError: hasError,
        resetError: function () { return setHasError(false); },
    };
};
//# sourceMappingURL=use-create-device-account.js.map