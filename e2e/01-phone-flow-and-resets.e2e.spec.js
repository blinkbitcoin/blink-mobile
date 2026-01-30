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
import { i18nObject } from "../app/i18n/i18n-util";
import { loadLocale } from "../app/i18n/i18n-util.sync";
import { getAccessTokenFromClipboard } from "./helpers";
import { clickBackButton, clickButton, otp, payTestUsername, phoneNumber, resetDisplayCurrency, resetEmail, resetLanguage, scrollDown, selector, timeout, waitTillButtonDisplayed, waitTillOnHomeScreen, waitTillTextDisplayed, } from "./utils";
describe("Login with Phone Flow", function () {
    loadLocale("en");
    var LL = i18nObject("en");
    // having an invoice or bitcoin address would popup a modal
    it("Clear the clipboard", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, browser.setClipboard("", "plaintext")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Set staging environment", function () { return __awaiter(void 0, void 0, void 0, function () {
        var buildButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("logo-button", "Other"))];
                case 1:
                    buildButton = _a.sent();
                    return [4 /*yield*/, buildButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, buildButton.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, browser.pause(100)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, buildButton.click()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, browser.pause(100)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, buildButton.click()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, browser.pause(100)];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, waitTillButtonDisplayed("logout button")];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, scrollDown()];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, clickButton("Staging Button")];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, clickButton("Save Changes")];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed("Galoy Instance: Staging")];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, clickBackButton()];
                case 14:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Login as an user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var telephoneInput, otpInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickButton(LL.GetStartedScreen.createAccount())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, $(selector("telephoneNumber", "Other", "[1]"))];
                case 2:
                    telephoneInput = _a.sent();
                    return [4 /*yield*/, telephoneInput.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, telephoneInput.click()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, telephoneInput.setValue(phoneNumber)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, browser.pause(500)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, clickButton(LL.PhoneLoginInitiateScreen.sms())];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, $(selector("oneTimeCode", "Other", "[1]"))];
                case 8:
                    otpInput = _a.sent();
                    return [4 /*yield*/, otpInput.waitForDisplayed({ timeout: timeout })];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, otpInput.click()];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, otpInput.setValue(String(otp))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, waitTillOnHomeScreen()];
                case 12:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get the access token from clipboard", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollDown()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, scrollDown()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, getAccessTokenFromClipboard(LL)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Resets", function () {
    it("reset language in case previous test has failed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, resetLanguage()];
                case 1:
                    result = _c.sent();
                    expect(result).toBeTruthy();
                    expect((_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.userUpdateLanguage.user) === null || _b === void 0 ? void 0 : _b.language).toBeFalsy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("reset email in case previous test has failed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, resetEmail()];
                case 1:
                    result = _g.sent();
                    expect(result).toBeTruthy();
                    expect((_c = (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.userEmailDelete.me) === null || _b === void 0 ? void 0 : _b.email) === null || _c === void 0 ? void 0 : _c.address).toBeFalsy();
                    expect((_f = (_e = (_d = result.data) === null || _d === void 0 ? void 0 : _d.userEmailDelete.me) === null || _e === void 0 ? void 0 : _e.email) === null || _f === void 0 ? void 0 : _f.verified).toBeFalsy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Pays Test Username to Create a Contact", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, payTestUsername()];
                case 1:
                    result = _b.sent();
                    expect((_a = result.data) === null || _a === void 0 ? void 0 : _a.intraLedgerPaymentSend.status).toBe("SUCCESS");
                    return [2 /*return*/];
            }
        });
    }); });
    it("resets display currency to USD", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, resetDisplayCurrency()];
                case 1:
                    result = _c.sent();
                    expect((_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.accountUpdateDisplayCurrency.account) === null || _b === void 0 ? void 0 : _b.displayCurrency).toBe("USD");
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=01-phone-flow-and-resets.e2e.spec.js.map