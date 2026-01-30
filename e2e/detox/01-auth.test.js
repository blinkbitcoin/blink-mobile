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
import "detox";
import { i18nObject } from "../../app/i18n/i18n-util";
import { loadLocale } from "../../app/i18n/i18n-util.sync";
import { getKratosCode } from "./utils/commandline";
import { waitForAccountScreen, waitForSettingsScreen } from "./utils/common-flows";
import { timeout, ALICE_PHONE, ALICE_EMAIL, otp } from "./utils/config";
import { tap } from "./utils/controls";
export var setLocalEnvironment = function () { return __awaiter(void 0, void 0, void 0, function () {
    var buildBtn, logoutBtn, envBtn, developerScreenSV, saveChangesBtn, stagingInstanceText;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buildBtn = element(by.id("logo-button"));
                return [4 /*yield*/, waitFor(buildBtn)
                        .toBeVisible()
                        // Wait for 5 mins because metro bundler might not finish sync
                        .withTimeout(5 * 600000)];
            case 1:
                _a.sent();
                return [4 /*yield*/, buildBtn.multiTap(5)];
            case 2:
                _a.sent();
                logoutBtn = element(by.id("logout button"));
                return [4 /*yield*/, waitFor(logoutBtn).toBeVisible().withTimeout(timeout)];
            case 3:
                _a.sent();
                envBtn = element(by.id("Local Button"));
                developerScreenSV = by.id("developer-screen-scroll-view");
                return [4 /*yield*/, waitFor(envBtn)
                        .toBeVisible()
                        .whileElement(developerScreenSV)
                        .scroll(400, "down", NaN, 0.85)];
            case 4:
                _a.sent();
                return [4 /*yield*/, envBtn.tap()];
            case 5:
                _a.sent();
                saveChangesBtn = element(by.id("Save Changes"));
                return [4 /*yield*/, saveChangesBtn.tap()];
            case 6:
                _a.sent();
                stagingInstanceText = element(by.text("Galoy Instance: Local"));
                return [4 /*yield*/, waitFor(stagingInstanceText).toBeVisible().withTimeout(10000)];
            case 7:
                _a.sent();
                return [4 /*yield*/, tap(by.id("Back"))];
            case 8:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
export var loginAs = function (phone, LL) { return function () { return __awaiter(void 0, void 0, void 0, function () {
    var telephoneInput, otpInput, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tap(by.id(LL.GetStartedScreen.createAccount()))];
            case 1:
                _b.sent();
                return [4 /*yield*/, tap(by.id(LL.AcceptTermsAndConditionsScreen.accept()))];
            case 2:
                _b.sent();
                telephoneInput = element(by.id("telephoneNumber"));
                return [4 /*yield*/, waitFor(telephoneInput).toBeVisible().withTimeout(timeout)];
            case 3:
                _b.sent();
                return [4 /*yield*/, telephoneInput.clearText()];
            case 4:
                _b.sent();
                return [4 /*yield*/, telephoneInput.typeText(phone)];
            case 5:
                _b.sent();
                return [4 /*yield*/, tap(by.id(LL.PhoneLoginInitiateScreen.sms()))];
            case 6:
                _b.sent();
                otpInput = element(by.id("oneTimeCode"));
                _b.label = 7;
            case 7:
                _b.trys.push([7, 11, , 12]);
                return [4 /*yield*/, waitFor(otpInput).toBeVisible().withTimeout(timeout)];
            case 8:
                _b.sent();
                return [4 /*yield*/, otpInput.clearText()];
            case 9:
                _b.sent();
                return [4 /*yield*/, otpInput.typeText(otp)];
            case 10:
                _b.sent();
                return [3 /*break*/, 12];
            case 11:
                _a = _b.sent();
                return [3 /*break*/, 12];
            case 12: return [4 /*yield*/, waitFor(element(by.text(LL.HomeScreen.myAccounts())))
                    .toBeVisible()
                    .withTimeout(timeout)];
            case 13:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }; };
describe("Login/Register Flow", function () {
    loadLocale("en");
    var LL = i18nObject("en");
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, device.launchApp({ newInstance: true })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("set environment", setLocalEnvironment);
    it("login as an user", loginAs(ALICE_PHONE, LL));
    it("add an email", function () { return __awaiter(void 0, void 0, void 0, function () {
        var emailInput, codeInput, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id("menu"))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.AccountScreen.tapToAddEmail()))];
                case 2:
                    _a.sent();
                    emailInput = element(by.id(LL.EmailRegistrationInitiateScreen.placeholder()));
                    return [4 /*yield*/, waitFor(emailInput).toBeVisible().withTimeout(timeout)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, emailInput.clearText()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, emailInput.typeText(ALICE_EMAIL)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.EmailRegistrationInitiateScreen.send()))];
                case 6:
                    _a.sent();
                    codeInput = element(by.id("code-input"));
                    return [4 /*yield*/, waitFor(codeInput).toBeVisible().withTimeout(timeout)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, getKratosCode(ALICE_EMAIL)];
                case 8:
                    code = _a.sent();
                    return [4 /*yield*/, codeInput.clearText()];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, codeInput.typeText(code)];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, tap(by.text(LL.common.ok()))];
                case 11:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("logout", function () { return __awaiter(void 0, void 0, void 0, function () {
        var logoutBtn, accountScreenSV;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitForSettingsScreen(LL)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.account()))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waitForAccountScreen(LL)];
                case 3:
                    _a.sent();
                    logoutBtn = element(by.id(LL.AccountScreen.logOutAndDeleteLocalData()));
                    accountScreenSV = by.id("account-screen-scroll-view");
                    return [4 /*yield*/, waitFor(logoutBtn)
                            .toBeVisible()
                            .whileElement(accountScreenSV)
                            .scroll(400, "down", NaN, 0.85)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, logoutBtn.tap()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, tap(by.text(LL.AccountScreen.IUnderstand()))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, tap(by.text(LL.common.ok()))];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("reset to local environment", setLocalEnvironment);
    it("log back in, with the new email", function () { return __awaiter(void 0, void 0, void 0, function () {
        var emailInput, codeInput, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id("email-button"))];
                case 1:
                    _a.sent();
                    emailInput = element(by.id(LL.EmailRegistrationInitiateScreen.placeholder()));
                    return [4 /*yield*/, waitFor(emailInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, emailInput.clearText()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, emailInput.typeText(ALICE_EMAIL)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.EmailRegistrationInitiateScreen.send()))];
                case 5:
                    _a.sent();
                    codeInput = element(by.id("code-input"));
                    return [4 /*yield*/, waitFor(codeInput).toBeVisible().withTimeout(timeout)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, getKratosCode(ALICE_EMAIL)];
                case 7:
                    code = _a.sent();
                    return [4 /*yield*/, codeInput.clearText()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, codeInput.typeText(code)];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("verify we are in the same account as we started with", function () { return __awaiter(void 0, void 0, void 0, function () {
        var phoneNumber;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id("menu"))];
                case 1:
                    _a.sent();
                    phoneNumber = element(by.text(ALICE_PHONE));
                    return [4 /*yield*/, waitFor(phoneNumber).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=01-auth.test.js.map