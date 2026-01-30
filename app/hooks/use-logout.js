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
import { gql } from "@apollo/client";
import { SCHEMA_VERSION_KEY } from "@app/config";
import { useUserLogoutMutation } from "@app/graphql/generated";
import { usePersistentStateContext } from "@app/store/persistent-state";
import { logLogout } from "@app/utils/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import crashlytics from "@react-native-firebase/crashlytics";
import messaging from "@react-native-firebase/messaging";
import KeyStoreWrapper from "../utils/storage/secureStorage";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userLogout($input: UserLogoutInput!) {\n    userLogout(input: $input) {\n      success\n    }\n  }\n"], ["\n  mutation userLogout($input: UserLogoutInput!) {\n    userLogout(input: $input) {\n      success\n    }\n  }\n"])));
var useLogout = function () {
    var resetState = usePersistentStateContext().resetState;
    var userLogoutMutation = useUserLogoutMutation({
        fetchPolicy: "no-cache",
    })[0];
    var logout = useCallback(function () {
        var args_1 = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args_1[_i] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([], args_1, true), void 0, function (_a) {
            var context, deviceToken, err_1;
            var _b = _a === void 0 ? {} : _a, _c = _b.stateToDefault, stateToDefault = _c === void 0 ? true : _c, token = _b.token, _d = _b.isValidToken, isValidToken = _d === void 0 ? true : _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 12, 13, 14]);
                        context = void 0;
                        return [4 /*yield*/, messaging().getToken()];
                    case 1:
                        deviceToken = _e.sent();
                        if (!token) return [3 /*break*/, 3];
                        return [4 /*yield*/, KeyStoreWrapper.removeSessionProfileByToken(token)];
                    case 2:
                        _e.sent();
                        context = { headers: { authorization: "Bearer ".concat(token) } };
                        return [3 /*break*/, 9];
                    case 3: return [4 /*yield*/, AsyncStorage.multiRemove([SCHEMA_VERSION_KEY])];
                    case 4:
                        _e.sent();
                        return [4 /*yield*/, KeyStoreWrapper.removeIsBiometricsEnabled()];
                    case 5:
                        _e.sent();
                        return [4 /*yield*/, KeyStoreWrapper.removePin()];
                    case 6:
                        _e.sent();
                        return [4 /*yield*/, KeyStoreWrapper.removePinAttempts()];
                    case 7:
                        _e.sent();
                        return [4 /*yield*/, KeyStoreWrapper.removeSessionProfiles()];
                    case 8:
                        _e.sent();
                        _e.label = 9;
                    case 9:
                        logLogout();
                        if (!(token && isValidToken)) return [3 /*break*/, 11];
                        return [4 /*yield*/, Promise.race([
                                userLogoutMutation({
                                    context: context,
                                    variables: { input: { deviceToken: deviceToken } },
                                }),
                                // Create a promise that rejects after 2 seconds
                                // this is handy for the case where the server is down, or in dev mode
                                new Promise(function (_, reject) {
                                    setTimeout(function () {
                                        reject(new Error("Logout mutation timeout"));
                                    }, 2000);
                                }),
                            ])];
                    case 10:
                        _e.sent();
                        _e.label = 11;
                    case 11: return [3 /*break*/, 14];
                    case 12:
                        err_1 = _e.sent();
                        if (err_1 instanceof Error) {
                            crashlytics().recordError(err_1);
                            console.debug({ err: err_1 }, "error logout");
                        }
                        return [3 /*break*/, 14];
                    case 13:
                        if (stateToDefault) {
                            resetState();
                        }
                        return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    }, [resetState, userLogoutMutation]);
    return {
        logout: logout,
    };
};
export default useLogout;
var templateObject_1;
//# sourceMappingURL=use-logout.js.map