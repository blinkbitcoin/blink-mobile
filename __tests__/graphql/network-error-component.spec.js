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
import { render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import useLogout from "@app/hooks/use-logout";
import { useAppConfig } from "@app/hooks";
import { toastShow } from "@app/utils/toast";
import { useNavigation } from "@react-navigation/native";
import KeyStoreWrapper from "@app/utils/storage/secureStorage";
import { useNetworkError } from "@app/graphql/network-error-context";
import { NetworkErrorCode } from "@app/graphql/error-code";
import { NetworkErrorComponent } from "@app/graphql/network-error-component";
jest.mock("@app/graphql/network-error-context");
jest.mock("@app/i18n/i18n-react");
jest.mock("@app/hooks/use-logout");
jest.mock("@app/hooks");
jest.mock("@app/utils/toast");
jest.mock("@react-navigation/native");
jest.mock("@app/utils/storage/secureStorage");
var mockClearNetworkError = jest.fn();
var mockToastShow = toastShow;
var mockLogout = jest.fn();
var mockSaveToken = jest.fn();
var mockNavigate = jest.fn();
var mockReset = jest.fn();
var mockNavigation = {
    navigate: mockNavigate,
    reset: mockReset,
};
beforeEach(function () {
    jest.clearAllMocks();
    useNetworkError.mockReturnValue({
        networkError: null,
        clearNetworkError: mockClearNetworkError,
    });
    useI18nContext.mockReturnValue({
        LL: {
            common: { reauth: function () { return "Please re-authenticate"; }, ok: function () { return "OK"; } },
            ProfileScreen: { switchAccount: function () { return "Switched account"; } },
            errors: {
                network: {
                    server: function () { return "Server error"; },
                    request: function () { return "Request failed"; },
                    connection: function () { return "No connection"; },
                },
            },
        },
    });
    useLogout.mockReturnValue({ logout: mockLogout });
    useAppConfig.mockReturnValue({
        appConfig: { token: "current-token" },
        saveToken: mockSaveToken,
    });
    useNavigation.mockReturnValue(mockNavigation);
    jest.spyOn(Alert, "alert").mockImplementation(function (title, message, buttons) {
        var _a, _b;
        (_b = (_a = buttons === null || buttons === void 0 ? void 0 : buttons[0]) === null || _a === void 0 ? void 0 : _a.onPress) === null || _b === void 0 ? void 0 : _b.call(_a);
    });
});
describe("NetworkErrorComponent", function () {
    it("does nothing when there is no network error", function () {
        render(<NetworkErrorComponent />);
        expect(mockToastShow).not.toHaveBeenCalled();
        expect(mockClearNetworkError).not.toHaveBeenCalled();
    });
    it("shows toast for server errors (500+)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: { statusCode: 500 },
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockToastShow).toHaveBeenCalledWith({
                                message: expect.any(Function),
                                LL: expect.any(Object),
                            });
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        }, { timeout: 1000, interval: 50 })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows toast for generic client errors (400-499) without specific code", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: { statusCode: 403 },
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockToastShow).toHaveBeenCalledWith({
                                message: expect.any(Function),
                                LL: expect.any(Object),
                            });
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        }, { timeout: 1000 })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles InvalidAuthentication with multiple profiles - switches account", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    KeyStoreWrapper.getSessionProfiles.mockResolvedValue([
                        { token: "current-token", username: "user1" },
                        { token: "other-token", username: "user2" },
                    ]);
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: {
                            statusCode: 401,
                            result: { errors: [{ code: NetworkErrorCode.InvalidAuthentication }] },
                        },
                        token: "current-token",
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockLogout).toHaveBeenCalledWith({
                                stateToDefault: false,
                                token: "current-token",
                                isValidToken: false,
                            });
                            expect(mockSaveToken).toHaveBeenCalledWith("other-token");
                            expect(mockToastShow).toHaveBeenCalledWith({
                                type: "success",
                                message: "Switched account",
                                LL: expect.any(Object),
                            });
                            expect(mockNavigate).toHaveBeenCalledWith("Primary");
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles InvalidAuthentication with one profile - shows alert and navigates to getStarted", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    KeyStoreWrapper.getSessionProfiles.mockResolvedValue([
                        { token: "current-token", username: "user1" },
                    ]);
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: { statusCode: 401 },
                        token: "current-token",
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(Alert.alert).toHaveBeenCalled();
                            expect(mockReset).toHaveBeenCalledWith({
                                index: 0,
                                routes: [{ name: "getStarted" }],
                            });
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles InvalidAuthentication with no current token - logs out and navigates", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    useAppConfig.mockReturnValue({
                        appConfig: { token: null },
                        saveToken: mockSaveToken,
                    });
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: { statusCode: 401 },
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockLogout).toHaveBeenCalledWith();
                            expect(mockReset).toHaveBeenCalledWith({
                                index: 0,
                                routes: [{ name: "getStarted" }],
                            });
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        }, { timeout: 1000 })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles network connectivity error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: { message: "Network request failed" },
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockToastShow).toHaveBeenCalledWith({
                                message: expect.any(Function),
                                LL: expect.any(Object),
                            });
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        }, { timeout: 1000 })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("ignores InvalidAuthentication when networkErrorToken differs from current token", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: {
                            statusCode: 401,
                            result: { errors: [{ code: NetworkErrorCode.InvalidAuthentication }] },
                        },
                        token: "stale-token",
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockLogout).not.toHaveBeenCalled();
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("falls back to logout on error during token expiry handling", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ;
                    KeyStoreWrapper.getSessionProfiles.mockRejectedValue(new Error("Storage error"));
                    rerender = render(<NetworkErrorComponent />).rerender;
                    useNetworkError.mockReturnValue({
                        networkError: { statusCode: 401 },
                        token: "current-token",
                        clearNetworkError: mockClearNetworkError,
                    });
                    rerender(<NetworkErrorComponent />);
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockLogout).toHaveBeenCalledWith();
                            expect(mockReset).toHaveBeenCalledWith({
                                index: 0,
                                routes: [{ name: "getStarted" }],
                            });
                            expect(mockClearNetworkError).toHaveBeenCalled();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=network-error-component.spec.js.map