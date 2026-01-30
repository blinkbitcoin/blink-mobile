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
import { clickBackButton, clickIcon, clickOnSetting, selector, scrollDown, clickButton, waitTillButtonDisplayed, getInbox, getFirstEmail, getSecondEmail, clickAlertLastButton, sleep, waitTillTextDisplayed, } from "./utils";
describe("Login Flow", function () {
    loadLocale("en");
    var LL = i18nObject("en");
    var timeout = 30000;
    var email = "";
    var inboxId = "";
    it("clicks Settings Icon", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon("menu")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("are we logged in?", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnSetting(LL.common.account())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(LL.AccountScreen.accountId())];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("adding an email", function () { return __awaiter(void 0, void 0, void 0, function () {
        var inboxRes, emailInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnSetting(LL.AccountScreen.tapToAddEmail())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, getInbox()];
                case 2:
                    inboxRes = _a.sent();
                    if (!inboxRes)
                        throw new Error("No inbox response");
                    inboxId = inboxRes.id;
                    email = inboxRes.emailAddress;
                    return [4 /*yield*/, $(selector(LL.EmailRegistrationInitiateScreen.placeholder(), "Other", "[1]"))];
                case 3:
                    emailInput = _a.sent();
                    return [4 /*yield*/, emailInput.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, emailInput.setValue(email)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, clickButton(LL.EmailRegistrationInitiateScreen.send())];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("verifying email", function () { return __awaiter(void 0, void 0, void 0, function () {
        var emailRes, subject, body, regex, match, code, placeholder, codeInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getFirstEmail(inboxId)];
                case 1:
                    emailRes = _a.sent();
                    if (!emailRes)
                        throw new Error("No email response");
                    subject = emailRes.subject, body = emailRes.body;
                    expect(subject).toEqual("your code");
                    regex = /\b\d{6}\b/;
                    match = body.match(regex);
                    if (!match)
                        throw new Error("No code found in email body");
                    code = match[0];
                    placeholder = "000000";
                    return [4 /*yield*/, $(selector(placeholder, "Other", "[1]"))];
                case 2:
                    codeInput = _a.sent();
                    return [4 /*yield*/, codeInput.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, codeInput.click()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, codeInput.setValue(code)];
                case 5:
                    _a.sent();
                    clickAlertLastButton(LL.common.ok());
                    return [2 /*return*/];
            }
        });
    }); });
    it("log out", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitTillTextDisplayed(LL.AccountScreen.accountId())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, scrollDown()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, clickButton(LL.AccountScreen.logOutAndDeleteLocalData(), true)];
                case 3:
                    _a.sent();
                    clickAlertLastButton(LL.AccountScreen.IUnderstand());
                    return [4 /*yield*/, sleep(2000)];
                case 4:
                    _a.sent();
                    clickAlertLastButton(LL.common.ok());
                    return [2 /*return*/];
            }
        });
    }); });
    it("set staging environment again", function () { return __awaiter(void 0, void 0, void 0, function () {
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
                    return [4 /*yield*/, browser.pause(100)
                        // scroll down for small screens
                    ];
                case 8:
                    _a.sent();
                    // scroll down for small screens
                    return [4 /*yield*/, waitTillButtonDisplayed("logout button")];
                case 9:
                    // scroll down for small screens
                    _a.sent();
                    return [4 /*yield*/, scrollDown()];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, clickButton("Staging Button", false)];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, clickButton("Save Changes", false)];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, clickBackButton()];
                case 13:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("log back in", function () { return __awaiter(void 0, void 0, void 0, function () {
        var emailLink, emailInput, emailRes, subject, body, regex, match, code, placeholder, codeInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("email-button", "Other"))];
                case 1:
                    emailLink = _a.sent();
                    return [4 /*yield*/, emailLink.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, emailLink.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, $(selector(LL.EmailRegistrationInitiateScreen.placeholder(), "Other", "[1]"))];
                case 4:
                    emailInput = _a.sent();
                    return [4 /*yield*/, emailInput.waitForDisplayed({ timeout: timeout })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, emailInput.click()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, emailInput.setValue(email)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, clickButton(LL.EmailRegistrationInitiateScreen.send())];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, getSecondEmail(inboxId)];
                case 9:
                    emailRes = _a.sent();
                    if (!emailRes)
                        throw new Error("No email response");
                    subject = emailRes.subject, body = emailRes.body;
                    expect(subject).toEqual("your code");
                    regex = /\b\d{6}\b/;
                    match = body.match(regex);
                    if (!match)
                        throw new Error("No code found in email body");
                    code = match[0];
                    placeholder = "000000";
                    return [4 /*yield*/, $(selector(placeholder, "Other", "[1]"))];
                case 10:
                    codeInput = _a.sent();
                    return [4 /*yield*/, codeInput.waitForDisplayed({ timeout: timeout })];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, codeInput.click()];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, codeInput.setValue(code)];
                case 13:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get the new access token from clipboard", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAccessTokenFromClipboard(LL)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=02-email-flow.e2e.spec.js.map