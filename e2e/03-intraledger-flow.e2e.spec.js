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
import { clickBackButton, clickButton, clickIcon, waitTillOnHomeScreen, waitTillTextDisplayed, checkContact, selector, addSmallAmount, swipeButton, } from "./utils";
loadLocale("en");
var LL = i18nObject("en");
var timeout = 30000;
describe("Validate Username Flow", function () {
    var username = "unclesamtoshi";
    var lnAddress = "unclesamtoshi@pay.staging.blink.sv";
    it("Click Send", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.send())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Paste Username", function () { return __awaiter(void 0, void 0, void 0, function () {
        var usernameInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"))];
                case 1:
                    usernameInput = _a.sent();
                    return [4 /*yield*/, usernameInput.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, usernameInput.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, usernameInput.setValue(username)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, clickButton(LL.common.next())];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Confirm Username", function () { return __awaiter(void 0, void 0, void 0, function () {
        var selectorValue, checkBoxButton, isContactAvailable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    selectorValue = process.env.E2E_DEVICE === "ios"
                        ? "".concat(LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                            lnAddress: lnAddress,
                        }), " ").concat(LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                            lnAddress: lnAddress,
                        }))
                        : LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({ lnAddress: lnAddress });
                    return [4 /*yield*/, $(selector(selectorValue, "Other"))];
                case 1:
                    checkBoxButton = _a.sent();
                    return [4 /*yield*/, checkBoxButton.waitForEnabled({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, checkBoxButton.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, checkContact(username)];
                case 4:
                    isContactAvailable = (_a.sent()).isContactAvailable;
                    expect(isContactAvailable).toBe(false);
                    return [4 /*yield*/, clickButton(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton())];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(LL.SendBitcoinScreen.amount())];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, clickBackButton()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(LL.SendBitcoinScreen.destination())];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back home", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickBackButton()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillOnHomeScreen()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Username Payment Flow", function () {
    var username = "galoytest";
    it("Click Send", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.send())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Paste Username", function () { return __awaiter(void 0, void 0, void 0, function () {
        var usernameInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"))];
                case 1:
                    usernameInput = _a.sent();
                    return [4 /*yield*/, usernameInput.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, usernameInput.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, usernameInput.setValue(username)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Next", function () { return __awaiter(void 0, void 0, void 0, function () {
        var isContactAvailable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, checkContact(username)];
                case 1:
                    isContactAvailable = (_a.sent()).isContactAvailable;
                    expect(isContactAvailable).toBeTruthy();
                    return [4 /*yield*/, clickButton(LL.common.next())];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Wallet contains balances", function () { return __awaiter(void 0, void 0, void 0, function () {
        var btcWalletBalance, btcWalletBalanceInUsdValue;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("BTC Wallet Balance", "StaticText"))];
                case 1:
                    btcWalletBalance = _a.sent();
                    return [4 /*yield*/, btcWalletBalance.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(btcWalletBalance).toBeDisplayed();
                    return [4 /*yield*/, btcWalletBalance.getText()];
                case 3:
                    btcWalletBalanceInUsdValue = _a.sent();
                    expect(btcWalletBalanceInUsdValue).toHaveText(new RegExp("^\\$\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?\\s\\(\\d{1,3}(,\\d{3})*\\ssats\\)$"));
                    return [2 /*return*/];
            }
        });
    }); });
    it("Add amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, addSmallAmount(LL)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Next again", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickButton(LL.common.next())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Slides to confirm payment and get Green Checkmark success", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, swipeButton(LL.SendBitcoinConfirmationScreen.slideToConfirm())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Clicks on not enjoying app", function () { return __awaiter(void 0, void 0, void 0, function () {
        var contexts, nativeContext, appContext;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, browser.pause(3000)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, browser.getContexts()];
                case 2:
                    contexts = _a.sent();
                    nativeContext = contexts.find(function (context) {
                        return context.toString().toLowerCase().includes("native");
                    });
                    return [4 /*yield*/, browser.pause(3000)];
                case 3:
                    _a.sent();
                    if (!nativeContext) return [3 /*break*/, 5];
                    return [4 /*yield*/, browser.switchContext(nativeContext.toString())];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    if (!(process.env.E2E_DEVICE === "android")) return [3 /*break*/, 7];
                    return [4 /*yield*/, driver.back()];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    appContext = contexts.find(function (context) {
                        return context.toString().toLowerCase().includes("webview");
                    });
                    if (!appContext) return [3 /*break*/, 9];
                    return [4 /*yield*/, browser.switchContext(appContext.toString())];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9: return [2 /*return*/];
            }
        });
    }); });
    it("Checks for suggestion modal and skips", function () { return __awaiter(void 0, void 0, void 0, function () {
        var suggestionInput, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.suggestionInput(), "TextView"))];
                case 1:
                    suggestionInput = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 9, , 10]);
                    return [4 /*yield*/, suggestionInput.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, suggestionInput.click()];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, suggestionInput.setValue("e2e test suggestion")];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, clickButton(LL.AuthenticationScreen.skip())
                        // FIXME: this is a bug. we should not have to double tap here.
                    ];
                case 6:
                    _b.sent();
                    // FIXME: this is a bug. we should not have to double tap here.
                    return [4 /*yield*/, browser.pause(1000)];
                case 7:
                    // FIXME: this is a bug. we should not have to double tap here.
                    _b.sent();
                    return [4 /*yield*/, clickButton(LL.AuthenticationScreen.skip())];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _a = _b.sent();
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    }); });
});
describe("Conversion Flow", function () {
    if (process.env.E2E_DEVICE === "ios") {
        return;
    }
    it("Click on Transfer Button", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.ConversionDetailsScreen.title())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Add amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, addSmallAmount(LL)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Next", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickButton(LL.common.next())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click on Convert", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickButton(LL.common.convert())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get Green Checkmark Success Icon and Navigate to HomeScreen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitTillOnHomeScreen()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=03-intraledger-flow.e2e.spec.js.map