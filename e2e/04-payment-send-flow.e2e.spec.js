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
import { bech32 } from "bech32";
import { i18nObject } from "../app/i18n/i18n-util";
import { loadLocale } from "../app/i18n/i18n-util.sync";
import { clickBackButton, clickButton, clickIcon, waitTillOnHomeScreen, waitTillTextDisplayed, getInvoice, selector, addSmallAmount, waitTillButtonDisplayed, waitTillPressableDisplayed, swipeButton, } from "./utils";
loadLocale("en");
var LL = i18nObject("en");
var timeout = 30000;
describe("Lightning address flow", function () {
    var lightningAddress = "extheo@testlnurl.netlify.app";
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
    it("Paste Lnurl", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lnurlInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"))];
                case 1:
                    lnurlInput = _a.sent();
                    return [4 /*yield*/, lnurlInput.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, lnurlInput.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, lnurlInput.setValue(lightningAddress)];
                case 4:
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
    it("Checks if on the SendBitcoinDetails screen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitTillPressableDisplayed("Amount Input Button")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickBackButton()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(LL.SendBitcoinScreen.destination())];
                case 2:
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
describe("Lnurl Pay Flow", function () {
    // see https://github.com/Extheoisah/lnurl-json for reference to lnurl json
    var words = bech32.toWords(Buffer.from("https://testlnurl.netlify.app:443/.well-known/lnurlp/extheo", "utf-8"));
    var lnurlp = bech32.encode("lnurl", words, 1000);
    // lnurl1dp68gurn8ghj7ar9wd6xcmn4wfkzumn9w3kxjene9eshqup6xs6rxtewwajkcmpdddhx7amw9akxuatjd3cz7etcw35x2mcql20cc
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
    it("Paste Lnurl", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lnurlInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"))];
                case 1:
                    lnurlInput = _a.sent();
                    return [4 /*yield*/, lnurlInput.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, lnurlInput.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, lnurlInput.setValue(lnurlp)];
                case 4:
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
    it("Checks if on the SendBitcoinDetails screen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitTillPressableDisplayed("Amount Input Button")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickBackButton()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(LL.SendBitcoinScreen.destination())];
                case 2:
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
describe("Lnurl Withdraw Flow", function () {
    // see https://github.com/Extheoisah/lnurl-json for reference to lnurl json
    var words = bech32.toWords(Buffer.from("https://testlnurl.netlify.app/lnurl-withdraw/lnwithdrawresponse.json", "utf-8"));
    var lnurlWithdraw = bech32.encode("lnurl", words, 1000);
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
    it("Paste Lnurl", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lnurlInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"))];
                case 1:
                    lnurlInput = _a.sent();
                    return [4 /*yield*/, lnurlInput.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, lnurlInput.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, lnurlInput.setValue(lnurlWithdraw)];
                case 4:
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
    it("Checks if lnwithdraw details are displayed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var description;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("description", "StaticText"))];
                case 1:
                    description = _a.sent();
                    return [4 /*yield*/, description.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waitTillButtonDisplayed("Redeem Bitcoin")];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickBackButton()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitTillTextDisplayed(LL.SendBitcoinScreen.destination())];
                case 2:
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
describe("Lightning Payments Flow", function () {
    var invoice;
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
    it("Create Invoice from API", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getInvoice()];
                case 1:
                    invoice = _a.sent();
                    expect(invoice).toContain("lntbs");
                    return [2 /*return*/];
            }
        });
    }); });
    it("Paste Invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var invoiceInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"))];
                case 1:
                    invoiceInput = _a.sent();
                    return [4 /*yield*/, invoiceInput.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, invoiceInput.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, invoiceInput.setValue(invoice)];
                case 4:
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
    it("Wait for fee calculation to return", function () { return __awaiter(void 0, void 0, void 0, function () {
        var feeDisplay;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Successful Fee", "StaticText"))];
                case 1:
                    feeDisplay = _a.sent();
                    return [4 /*yield*/, feeDisplay.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Slides to confirm payment and navigate to move money screen", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, swipeButton(LL.SendBitcoinConfirmationScreen.slideToConfirm())];
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
//# sourceMappingURL=04-payment-send-flow.e2e.spec.js.map