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
/* eslint-disable camelcase */
import React from "react";
import axios from "axios";
import { Linking } from "react-native";
import { renderHook, act } from "@testing-library/react-hooks";
import { useTelegramLogin, ErrorType, } from "@app/screens/telegram-login-screen/telegram-auth";
import { formatPublicKey } from "@app/utils/format-public-key";
import { BLINK_DEEP_LINK_PREFIX, TELEGRAM_CALLBACK_PATH } from "@app/config";
import { ContextForScreen } from "./helper";
// Mocks
jest.mock("@react-navigation/native", function () {
    var actualNav = jest.requireActual("@react-navigation/native");
    return __assign(__assign({}, actualNav), { useNavigation: function () { return ({
            navigate: jest.fn(),
            replace: jest.fn(),
        }); }, useFocusEffect: function (fn) { return fn(); } });
});
jest.mock("@react-native-firebase/analytics", function () { return function () { return ({
    logLogin: jest.fn(),
}); }; });
jest.mock("@app/hooks", function () { return ({
    useAppConfig: function () { return ({
        appConfig: {
            galoyInstance: {
                authUrl: "https://api.blink.sv",
            },
        },
    }); },
    useTokenManager: function () { return ({
        saveToken: jest.fn(),
        saveTokenAndInstance: jest.fn(),
    }); },
    useSaveSessionProfile: function () { return ({
        saveProfile: jest.fn(),
    }); },
}); });
jest.mock("axios");
jest.mock("react-native/Libraries/Linking/Linking", function () { return ({
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
    addEventListener: jest.fn(function () { return ({
        remove: jest.fn(),
    }); }),
}); });
var Wrapper = function (_a) {
    var children = _a.children;
    return (<ContextForScreen>{children}</ContextForScreen>);
};
describe("useTelegramLogin", function () {
    var mockPhone = "+50376543210";
    var mockData = {
        bot_id: "1111111111",
        scope: { data: ["phone_number"], v: 1 },
        public_key: "mocked_public_key",
        nonce: "mocked_nonce",
    };
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("should call getTelegramPassportRequestParams and open a URL", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    axios.post.mockResolvedValueOnce({ data: mockData });
                    Linking.canOpenURL.mockResolvedValueOnce(true);
                    Linking.openURL.mockResolvedValueOnce(undefined);
                    result = renderHook(function () { return useTelegramLogin(mockPhone); }, { wrapper: Wrapper }).result;
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleTelegramLogin()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(axios.post).toHaveBeenCalledWith("https://api.blink.sv/auth/telegram-passport/request-params", { phone: mockPhone });
                    expect(Linking.canOpenURL).toHaveBeenCalled();
                    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("tg://passport"));
                    expect(result.current.error).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle fallback link if Telegram is not installed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    axios.post.mockResolvedValueOnce({ data: mockData });
                    Linking.canOpenURL.mockResolvedValueOnce(false);
                    result = renderHook(function () { return useTelegramLogin(mockPhone); }, { wrapper: Wrapper }).result;
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleTelegramLogin()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("https://telegram.me/telegrampassport"));
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle error from backend", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    axios.post.mockRejectedValueOnce({
                        response: { data: {} },
                    });
                    result = renderHook(function () { return useTelegramLogin(mockPhone); }, { wrapper: Wrapper }).result;
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleTelegramLogin()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(result.current.error).toBe(ErrorType.FetchParamsError);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle general errors", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    axios.post.mockRejectedValueOnce(new Error("network failed"));
                    result = renderHook(function () { return useTelegramLogin(mockPhone); }, { wrapper: Wrapper }).result;
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleTelegramLogin()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(result.current.error).toBe(ErrorType.FetchParamsError);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should generate correct deepLink", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, encodedScope, encodedPublicKey, callback, expectedDeepLink;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    axios.post.mockResolvedValueOnce({ data: mockData });
                    Linking.canOpenURL.mockResolvedValueOnce(true);
                    result = renderHook(function () { return useTelegramLogin(mockPhone); }, { wrapper: Wrapper }).result;
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleTelegramLogin()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    encodedScope = encodeURIComponent(JSON.stringify(mockData.scope));
                    encodedPublicKey = encodeURIComponent(formatPublicKey(mockData.public_key));
                    callback = encodeURIComponent("".concat(BLINK_DEEP_LINK_PREFIX, "/").concat(TELEGRAM_CALLBACK_PATH));
                    expectedDeepLink = "tg://passport?bot_id=".concat(mockData.bot_id, "&scope=").concat(encodedScope, "&public_key=").concat(encodedPublicKey, "&nonce=").concat(mockData.nonce, "&callback_url=").concat(callback);
                    expect(Linking.openURL).toHaveBeenCalledWith(expectedDeepLink);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=telegram-auth.spec.js.map