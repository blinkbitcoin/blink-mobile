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
import { clickBackButton, clickIcon, clickOnSetting, waitTillOnHomeScreen, checkContact, selector, clickOnBottomTab, Tab, waitTillTextDisplayed, waitTillScreenTitleShowing, isScreenTitleShowing, clickButton, } from "./utils";
loadLocale("en");
loadLocale("es");
var LL = i18nObject("en");
var timeout = 30000;
describe("Change Language Flow", function () {
    var enLL = LL;
    var esLL = i18nObject("es");
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
    it("clicks Language", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnSetting(enLL.common.language())];
                case 1:
                    _a.sent();
                    browser.pause(2000);
                    return [2 /*return*/];
            }
        });
    }); });
    it("changes language to Spanish", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnSetting("Español")];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillScreenTitleShowing(esLL.common.languagePreference())];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("changes language back to Predetermined", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnSetting(esLL.Languages.DEFAULT())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillScreenTitleShowing(enLL.common.languagePreference())];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("navigates back to move home screen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickBackButton()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(enLL.common.preferences())];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, clickBackButton()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, waitTillOnHomeScreen()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("People Flow", function () {
    it("Click People Button", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnBottomTab(Tab.People)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click all contacts", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickButton(LL.PeopleScreen.viewAllContacts())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Check if contacts exists", function () { return __awaiter(void 0, void 0, void 0, function () {
        var contactList, contactUsernameButton, searchBar, enterButton, uiSelector;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, checkContact()];
                case 1:
                    contactList = (_a.sent()).contactList;
                    expect(contactList === null || contactList === void 0 ? void 0 : contactList.length).toBe(contactList === null || contactList === void 0 ? void 0 : contactList.length);
                    return [4 /*yield*/, $(selector(LL.common.search(), "Other"))];
                case 2:
                    searchBar = _a.sent();
                    return [4 /*yield*/, searchBar.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    console.log("1");
                    return [4 /*yield*/, searchBar.click()];
                case 4:
                    _a.sent();
                    console.log("2");
                    return [4 /*yield*/, searchBar.setValue((contactList === null || contactList === void 0 ? void 0 : contactList[0].username) || "")];
                case 5:
                    _a.sent();
                    console.log("3");
                    if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 10];
                    return [4 /*yield*/, $(selector("Return", "Button"))];
                case 6:
                    enterButton = _a.sent();
                    return [4 /*yield*/, enterButton.waitForDisplayed({ timeout: timeout })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, enterButton.click()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, $(selector("RNE__LISTITEM__padView", "Other"))];
                case 9:
                    contactUsernameButton = _a.sent();
                    return [3 /*break*/, 12];
                case 10:
                    // press the enter key
                    browser.keys("\uE007");
                    uiSelector = "new UiSelector().text(\"".concat(contactList === null || contactList === void 0 ? void 0 : contactList[0].username, "\").className(\"android.widget.TextView\")");
                    return [4 /*yield*/, $("android=".concat(uiSelector))];
                case 11:
                    contactUsernameButton = _a.sent();
                    _a.label = 12;
                case 12: return [4 /*yield*/, contactUsernameButton.waitForDisplayed({ timeout: timeout })];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, contactUsernameButton.click()
                        // pause to wait for contact details to load
                    ];
                case 14:
                    _a.sent();
                    // pause to wait for contact details to load
                    return [4 /*yield*/, browser.pause(2000)];
                case 15:
                    // pause to wait for contact details to load
                    _a.sent();
                    return [4 /*yield*/, $(selector("contact-detail-icon", "Other")).isDisplayed()];
                case 16:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back to People home", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnBottomTab(Tab.People)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, clickOnBottomTab(Tab.People)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back to main screen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickOnBottomTab(Tab.Home)];
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
describe("See transactions list", function () {
    it("Click 'Transactions'", function () { return __awaiter(void 0, void 0, void 0, function () {
        var transactionsButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.TransactionScreen.title(), "StaticText"))];
                case 1:
                    transactionsButton = _a.sent();
                    return [4 /*yield*/, transactionsButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, transactionsButton.click()
                        // pause to wait for transactions to load
                    ];
                case 3:
                    _a.sent();
                    // pause to wait for transactions to load
                    return [4 /*yield*/, browser.pause(2000)];
                case 4:
                    // pause to wait for transactions to load
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("See transactions", function () { return __awaiter(void 0, void 0, void 0, function () {
        var transactionsList, transactionDescription;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("list-item-content", "Other", "[1]"))];
                case 1:
                    transactionsList = _a.sent();
                    return [4 /*yield*/, $(selector("tx-description", "StaticText", "[2]"))];
                case 2:
                    transactionDescription = _a.sent();
                    return [4 /*yield*/, transactionsList.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    expect(transactionDescription).toBeDisplayed();
                    return [2 /*return*/];
            }
        });
    }); });
    it("click on first transaction", function () { return __awaiter(void 0, void 0, void 0, function () {
        var firstTransaction;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("list-item-content", "Other", "[1]"))];
                case 1:
                    firstTransaction = _a.sent();
                    return [4 /*yield*/, firstTransaction.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, firstTransaction.click()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("check if transaction details are shown", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitTillTextDisplayed(LL.common.date())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back home", function () { return __awaiter(void 0, void 0, void 0, function () {
        var close_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 4];
                    return [4 /*yield*/, $("(//XCUIElementTypeOther[@name=\"close\"])[2]")];
                case 1:
                    close_1 = _a.sent();
                    return [4 /*yield*/, close_1.waitForEnabled({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, close_1.click()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, clickIcon("close")];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [4 /*yield*/, waitTillScreenTitleShowing(LL.TransactionScreen.transactionHistoryTitle())];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8: return [4 /*yield*/, isScreenTitleShowing(LL.TransactionScreen.transactionHistoryTitle())];
                case 9:
                    if (!_a.sent()) return [3 /*break*/, 12];
                    return [4 /*yield*/, clickBackButton()];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, browser.pause(1000)];
                case 11:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 12: return [4 /*yield*/, waitTillOnHomeScreen()];
                case 13:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Price graph flow", function () {
    it("click on price graph button", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon("graph")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("click on one week button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var oneWeekButton, rangeText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.PriceHistoryScreen.oneWeek(), "Button"))];
                case 1:
                    oneWeekButton = _a.sent();
                    return [4 /*yield*/, $(selector("range", "StaticText"))];
                case 2:
                    rangeText = _a.sent();
                    return [4 /*yield*/, oneWeekButton.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, oneWeekButton.click()];
                case 4:
                    _a.sent();
                    expect(rangeText).toBeDisplayed();
                    return [2 /*return*/];
            }
        });
    }); });
    it("click on one month button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var oneMonthButton, rangeText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.PriceHistoryScreen.oneMonth(), "Button"))];
                case 1:
                    oneMonthButton = _a.sent();
                    return [4 /*yield*/, $(selector("range", "Other"))];
                case 2:
                    rangeText = _a.sent();
                    return [4 /*yield*/, oneMonthButton.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, oneMonthButton.click()];
                case 4:
                    _a.sent();
                    expect(rangeText).toBeDisplayed();
                    return [2 /*return*/];
            }
        });
    }); });
    it("click on one year button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var oneYearButton, rangeText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.PriceHistoryScreen.oneYear(), "Button"))];
                case 1:
                    oneYearButton = _a.sent();
                    return [4 /*yield*/, $(selector("range", "Other"))];
                case 2:
                    rangeText = _a.sent();
                    return [4 /*yield*/, oneYearButton.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, oneYearButton.click()];
                case 4:
                    _a.sent();
                    expect(rangeText).toBeDisplayed();
                    return [2 /*return*/];
            }
        });
    }); });
    it("click on five years button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var fiveYearsButton, rangeText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.PriceHistoryScreen.fiveYears(), "Button"))];
                case 1:
                    fiveYearsButton = _a.sent();
                    return [4 /*yield*/, $(selector("range", "Other"))];
                case 2:
                    rangeText = _a.sent();
                    return [4 /*yield*/, fiveYearsButton.waitForDisplayed({ timeout: timeout })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, fiveYearsButton.click()];
                case 4:
                    _a.sent();
                    expect(rangeText).toBeDisplayed();
                    return [2 /*return*/];
            }
        });
    }); });
    it("go back to home screen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickBackButton()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=06-other-tests.e2e.spec.js.map