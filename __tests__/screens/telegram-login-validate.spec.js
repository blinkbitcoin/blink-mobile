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
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { TelegramLogin } from "@app/screens/telegram-login-screen/telegram-login-validate.stories";
import { useTelegramLogin, ErrorType, } from "@app/screens/telegram-login-screen/telegram-auth";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { ContextForScreen } from "./helper";
// Mock useTelegramLogin
jest.mock("@app/screens/telegram-login-screen/telegram-auth", function () {
    var actual = jest.requireActual("@app/screens/telegram-login-screen/telegram-auth");
    return __assign(__assign({}, actual), { useTelegramLogin: jest.fn() });
});
var mockUseTelegramLogin = useTelegramLogin;
var mockRoute = {
    key: "telegram-login",
    name: "telegramLoginValidate",
    params: {
        phone: "+50378662557",
        type: "Login",
    },
};
describe("Telegram Login Screen", function () {
    var LL;
    beforeEach(function () {
        loadLocale("en");
        LL = i18nObject("en");
        // Default mock
        mockUseTelegramLogin.mockReturnValue({
            loading: false,
            error: null,
            isPollingForAuth: false,
            handleTelegramLogin: jest.fn(),
        });
    });
    it("renders login button", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <TelegramLogin mockRoute={mockRoute}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.TelegramValidationScreen.loginWithTelegram())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders screen title and description", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    render(<ContextForScreen>
        <TelegramLogin mockRoute={mockRoute}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.TelegramValidationScreen.text())).toBeTruthy();
                            expect(screen.getByText(LL.TelegramValidationScreen.description())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders GaloyInfo while polling", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockUseTelegramLogin.mockReturnValueOnce({
                        loading: false,
                        error: null,
                        isPollingForAuth: true,
                        handleTelegramLogin: jest.fn(),
                    });
                    render(<ContextForScreen>
        <TelegramLogin mockRoute={mockRoute}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.TelegramValidationScreen.waitingForAuthorization())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders GaloyErrorBox when error exists", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockUseTelegramLogin.mockReturnValueOnce({
                        loading: false,
                        error: ErrorType.OpenAppError,
                        isPollingForAuth: false,
                        handleTelegramLogin: jest.fn(),
                    });
                    render(<ContextForScreen>
        <TelegramLogin mockRoute={mockRoute}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByText(LL.TelegramValidationScreen.errorOpenAppError())).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=telegram-login-validate.spec.js.map