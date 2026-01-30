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
import { getExternalLNNoAmountInvoice, getLnInvoiceForBob, getOnchainAddress, } from "./utils/commandline";
import { setLocalAndLoginWithAccessToken, waitForHomeScreen } from "./utils/common-flows";
import { timeout, BOB_USERNAME, ALICE_TOKEN } from "./utils/config";
import { addAmount, tap, verifyTextPresent, sleep, slideSlider } from "./utils/controls";
loadLocale("en");
var LL = i18nObject("en");
// Make sure all tests in this file reset back to home screen because tests reuse same session in this file
beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, device.launchApp({ newInstance: true })];
            case 1:
                _a.sent();
                return [4 /*yield*/, setLocalAndLoginWithAccessToken(ALICE_TOKEN, LL)];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
describe("Send: Intraledger using Username - BTC Amount", function () {
    it("send btc to bob using his username", function () { return __awaiter(void 0, void 0, void 0, function () {
        var usernameInput, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.send()))];
                case 1:
                    _b.sent();
                    usernameInput = element(by.id(LL.SendBitcoinScreen.placeholder()));
                    return [4 /*yield*/, waitFor(usernameInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, usernameInput.clearText()];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, usernameInput.typeText(BOB_USERNAME)];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()), 3)];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 9, , 10]);
                    return [4 /*yield*/, tap(by.id("address-is-right"))];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()))];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _a = _b.sent();
                    return [3 /*break*/, 10];
                case 10: return [4 /*yield*/, addAmount("0.02", LL)];
                case 11:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 12:
                    _b.sent();
                    return [4 /*yield*/, slideSlider()];
                case 13:
                    _b.sent();
                    return [4 /*yield*/, sleep(3000)];
                case 14:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.back()))];
                case 15:
                    _b.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 16:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("check if latest transaction has been updated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = element(by.id("transaction-by-index-0"));
                    return [4 /*yield*/, waitFor(tx)
                            .toBeVisible()
                            .withTimeout(timeout * 10)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tx.tap()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent(LL.TransactionDetailScreen.spent())];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent("-$0.02")];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("close"))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Send: Intraledger using Username - USD Amount", function () {
    it("send btc to bob using his username", function () { return __awaiter(void 0, void 0, void 0, function () {
        var usernameInput, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.send()))];
                case 1:
                    _b.sent();
                    usernameInput = element(by.id(LL.SendBitcoinScreen.placeholder()));
                    return [4 /*yield*/, waitFor(usernameInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, usernameInput.clearText()];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, usernameInput.typeText(BOB_USERNAME)];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()), 3)];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 9, , 10]);
                    return [4 /*yield*/, tap(by.id("address-is-right"))];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()))];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _a = _b.sent();
                    return [3 /*break*/, 10];
                case 10: return [4 /*yield*/, tap(by.id("choose-wallet-to-send-from"))];
                case 11:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id("USD"))];
                case 12:
                    _b.sent();
                    return [4 /*yield*/, addAmount("0.02", LL)];
                case 13:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 14:
                    _b.sent();
                    return [4 /*yield*/, slideSlider()];
                case 15:
                    _b.sent();
                    return [4 /*yield*/, sleep(3000)];
                case 16:
                    _b.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.back()))];
                case 17:
                    _b.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 18:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("check if latest transaction has been updated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = element(by.id("transaction-by-index-0"));
                    return [4 /*yield*/, waitFor(tx)
                            .toBeVisible()
                            .withTimeout(timeout * 10)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tx.tap()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent(LL.TransactionDetailScreen.spent())];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent("-$0.02")];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("close"))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Send: Intraledger using LN Invoice", function () {
    it("send btc to bob using his ln invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var invoice, invoiceInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.send()))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, getLnInvoiceForBob()];
                case 2:
                    invoice = _a.sent();
                    invoiceInput = element(by.id(LL.SendBitcoinScreen.placeholder()));
                    return [4 /*yield*/, waitFor(invoiceInput).toBeVisible().withTimeout(timeout)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, invoiceInput.clearText()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, invoiceInput.typeText(invoice)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, addAmount("0.02", LL)
                        // some bug
                    ];
                case 7:
                    _a.sent();
                    // some bug
                    return [4 /*yield*/, device.disableSynchronization()];
                case 8:
                    // some bug
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, device.enableSynchronization()];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, slideSlider()];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, sleep(3000)];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.back()))];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 14:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("check if latest transaction has been updated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = element(by.id("transaction-by-index-0"));
                    return [4 /*yield*/, waitFor(tx)
                            .toBeVisible()
                            .withTimeout(timeout * 10)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tx.tap()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent(LL.TransactionDetailScreen.spent())];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent("-$0.02")];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("close"))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Send: to External LN Invoice", function () {
    it("send btc to an external invoice taken from lnd-outside-1", function () { return __awaiter(void 0, void 0, void 0, function () {
        var invoice, invoiceInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.send()))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, getExternalLNNoAmountInvoice()];
                case 2:
                    invoice = _a.sent();
                    invoiceInput = element(by.id(LL.SendBitcoinScreen.placeholder()));
                    return [4 /*yield*/, waitFor(invoiceInput).toBeVisible().withTimeout(timeout)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, invoiceInput.clearText()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, invoiceInput.typeText(invoice)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, addAmount("0.02", LL)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, slideSlider()];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, sleep(3000)];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.back()))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 12:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("check if latest transaction has been updated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = element(by.id("transaction-by-index-0"));
                    return [4 /*yield*/, waitFor(tx)
                            .toBeVisible()
                            .withTimeout(timeout * 10)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tx.tap()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, verifyTextPresent(LL.TransactionDetailScreen.spent())];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("close"))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Send: to Onchain Address", function () {
    it("send btc to an onchain address from bitcoind", function () { return __awaiter(void 0, void 0, void 0, function () {
        var address, addressInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.send()))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, getOnchainAddress()];
                case 2:
                    address = _a.sent();
                    addressInput = element(by.id(LL.SendBitcoinScreen.placeholder()));
                    return [4 /*yield*/, waitFor(addressInput).toBeVisible().withTimeout(timeout)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, addressInput.clearText()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, addressInput.typeText(address)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, addAmount("25.0", LL)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.next()))];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, slideSlider()];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, sleep(3000)];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id(LL.common.back()))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 12:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("check if latest transaction has been updated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = element(by.id("transaction-by-index-0"));
                    return [4 /*yield*/, waitFor(tx)
                            .toBeVisible()
                            .withTimeout(timeout * 10)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, tx.tap()
                        // can take a bit of time for tx to be confirmed
                    ];
                case 2:
                    _a.sent();
                    // can take a bit of time for tx to be confirmed
                    return [4 /*yield*/, verifyTextPresent(LL.TransactionDetailScreen.spent(), timeout * 30)];
                case 3:
                    // can take a bit of time for tx to be confirmed
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("close"))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=03-payment-send.test.js.map