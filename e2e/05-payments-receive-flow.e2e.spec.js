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
/* eslint-disable jest/no-disabled-tests */
import jimp from "jimp";
import jsQR from "jsqr";
import { i18nObject } from "../app/i18n/i18n-util";
import { loadLocale } from "../app/i18n/i18n-util.sync";
import { enter2CentsIntoNumberPad, scrollDown, selector, clickBackButton, clickButton, clickIcon, payAmountInvoice, payNoAmountInvoice, clickPressable, waitTillPressableDisplayed, waitTillOnHomeScreen, scrollUp, } from "./utils";
loadLocale("en");
var LL = i18nObject("en");
var timeout = 30000;
describe("Receive BTC Amount Payment Flow", function () {
    var invoice;
    var memo = "memo";
    it("Click Receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.receive())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Request Specific Amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waitTillPressableDisplayed("Amount Input Button")];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, clickPressable("Amount Input Button")
                        // we need to wait for the notifications permissions pop up
                        // and click allow before we can continue
                    ];
                case 2:
                    _a.sent();
                    // we need to wait for the notifications permissions pop up
                    // and click allow before we can continue
                    return [4 /*yield*/, browser.pause(4000)];
                case 3:
                    // we need to wait for the notifications permissions pop up
                    // and click allow before we can continue
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Enter Amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, enter2CentsIntoNumberPad(LL)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Checks that the invoice is updated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var lnInvoiceReadableText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("readable-payment-request", "Other"))];
                case 1:
                    lnInvoiceReadableText = _a.sent();
                    return [4 /*yield*/, lnInvoiceReadableText.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(lnInvoiceReadableText).toBeDisplayed();
                    return [2 /*return*/];
            }
        });
    }); });
    it("clicks on set a note button", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollDown()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, clickPressable("add-note")];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("sets a memo or note", function () { return __awaiter(void 0, void 0, void 0, function () {
        var memoInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("add-note", "Other"))];
                case 1:
                    memoInput = _a.sent();
                    return [4 /*yield*/, memoInput.setValue(memo)
                        // tap outside
                    ];
                case 2:
                    _a.sent();
                    // tap outside
                    return [4 /*yield*/, browser.touchAction({ action: "tap", x: 10, y: 250 })
                        // updating memo takes a little time for the qr code to be updated
                    ];
                case 3:
                    // tap outside
                    _a.sent();
                    // updating memo takes a little time for the qr code to be updated
                    return [4 /*yield*/, browser.pause(5000)];
                case 4:
                    // updating memo takes a little time for the qr code to be updated
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Copy BTC Invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrCode, copyInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("QR-Code", "Other"))];
                case 1:
                    qrCode = _a.sent();
                    return [4 /*yield*/, qrCode.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(qrCode).toBeDisplayed();
                    return [4 /*yield*/, $(selector("Copy Invoice", "StaticText"))];
                case 3:
                    copyInvoiceButton = _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get BTC Invoice from clipboard (android) or share link (ios)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var shareButton, invoiceSharedScreen, invoiceBase64;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 8];
                    return [4 /*yield*/, $(selector("Share Invoice", "StaticText"))];
                case 1:
                    shareButton = _a.sent();
                    return [4 /*yield*/, shareButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, shareButton.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, $('//*[contains(@name,"lntbs")]')];
                case 4:
                    invoiceSharedScreen = _a.sent();
                    return [4 /*yield*/, invoiceSharedScreen.waitForDisplayed({
                            timeout: 8000,
                        })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, invoiceSharedScreen.getAttribute("name")];
                case 6:
                    invoice = _a.sent();
                    return [4 /*yield*/, clickButton("Close")];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, browser.getClipboard()];
                case 9:
                    invoiceBase64 = _a.sent();
                    invoice = Buffer.from(invoiceBase64, "base64").toString();
                    expect(invoice).toContain("lntbs");
                    _a.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    }); });
    it.skip("Capture screenshot and decode QR code to match with invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screenshot, buffer, image, imageData, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollUp()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, browser.takeScreenshot()];
                case 2:
                    screenshot = _a.sent();
                    buffer = Buffer.from(screenshot, "base64");
                    return [4 /*yield*/, jimp.read(buffer)];
                case 3:
                    image = _a.sent();
                    imageData = {
                        data: new Uint8ClampedArray(image.bitmap.data),
                        height: image.bitmap.height,
                        width: image.bitmap.width,
                    };
                    code = jsQR(imageData.data, imageData.width, imageData.height);
                    expect(code).not.toBeNull();
                    expect(code === null || code === void 0 ? void 0 : code.data).toBe(invoice.toUpperCase());
                    return [2 /*return*/];
            }
        });
    }); });
    it("External User Pays the BTC Invoice through API", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, paymentStatus;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, payAmountInvoice({ invoice: invoice, memo: memo })];
                case 1:
                    _a = _b.sent(), result = _a.result, paymentStatus = _a.paymentStatus;
                    expect(paymentStatus).toBe("SUCCESS");
                    expect(result).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Wait for Green check for BTC Payment", function () { return __awaiter(void 0, void 0, void 0, function () {
        var successCheck;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Success Icon", "Other"))];
                case 1:
                    successCheck = _a.sent();
                    return [4 /*yield*/, successCheck.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back to main screen", function () { return __awaiter(void 0, void 0, void 0, function () {
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
describe("Receive BTC Amountless Invoice Payment Flow", function () {
    var invoice;
    it("Click Receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.receive())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Copy BTC Invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrCode, copyInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("QR-Code", "Other"))];
                case 1:
                    qrCode = _a.sent();
                    return [4 /*yield*/, qrCode.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(qrCode).toBeDisplayed();
                    return [4 /*yield*/, $(selector("Copy Invoice", "StaticText"))];
                case 3:
                    copyInvoiceButton = _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get BTC Invoice from clipboard (android) or share link (ios)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var shareButton, invoiceSharedScreen, closeShareButton, invoiceBase64;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 10];
                    return [4 /*yield*/, $(selector("Share Invoice", "StaticText"))];
                case 1:
                    shareButton = _a.sent();
                    return [4 /*yield*/, shareButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, shareButton.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, $('//*[contains(@name,"lntbs")]')];
                case 4:
                    invoiceSharedScreen = _a.sent();
                    return [4 /*yield*/, invoiceSharedScreen.waitForDisplayed({
                            timeout: 8000,
                        })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, invoiceSharedScreen.getAttribute("name")];
                case 6:
                    invoice = _a.sent();
                    return [4 /*yield*/, $(selector("Close", "Button"))];
                case 7:
                    closeShareButton = _a.sent();
                    return [4 /*yield*/, closeShareButton.waitForDisplayed({ timeout: timeout })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, closeShareButton.click()];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 10: return [4 /*yield*/, browser.getClipboard()];
                case 11:
                    invoiceBase64 = _a.sent();
                    invoice = Buffer.from(invoiceBase64, "base64").toString();
                    expect(invoice).toContain("lntbs");
                    _a.label = 12;
                case 12: return [2 /*return*/];
            }
        });
    }); });
    it.skip("Capture screenshot and decode QR code to match with invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screenshot, buffer, image, imageData, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollUp()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, browser.takeScreenshot()];
                case 2:
                    screenshot = _a.sent();
                    buffer = Buffer.from(screenshot, "base64");
                    return [4 /*yield*/, jimp.read(buffer)];
                case 3:
                    image = _a.sent();
                    imageData = {
                        data: new Uint8ClampedArray(image.bitmap.data),
                        height: image.bitmap.height,
                        width: image.bitmap.width,
                    };
                    code = jsQR(imageData.data, imageData.width, imageData.height);
                    expect(code).not.toBeNull();
                    expect(code === null || code === void 0 ? void 0 : code.data).toBe(invoice.toUpperCase());
                    return [2 /*return*/];
            }
        });
    }); });
    it("External User Pays the BTC Invoice through API", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, paymentStatus;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, payNoAmountInvoice({
                        invoice: invoice,
                        walletCurrency: "BTC",
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, paymentStatus = _a.paymentStatus;
                    expect(paymentStatus).toBe("SUCCESS");
                    expect(result).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Wait for Green check for BTC Payment", function () { return __awaiter(void 0, void 0, void 0, function () {
        var successCheck;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Success Icon", "Other"))];
                case 1:
                    successCheck = _a.sent();
                    return [4 /*yield*/, successCheck.waitForExist({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Receive USD Payment Flow", function () {
    var invoice;
    it("Click Receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.receive())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click USD invoice button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var usdInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Stablesats", "Other"))];
                case 1:
                    usdInvoiceButton = _a.sent();
                    return [4 /*yield*/, usdInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, usdInvoiceButton.click()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Copy BTC Invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrCode, copyInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("QR-Code", "Other"))];
                case 1:
                    qrCode = _a.sent();
                    return [4 /*yield*/, qrCode.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(qrCode).toBeDisplayed();
                    return [4 /*yield*/, $(selector("Copy Invoice", "StaticText"))];
                case 3:
                    copyInvoiceButton = _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get BTC Invoice from clipboard (android) or share link (ios)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var shareButton, invoiceSharedScreen, closeShareButton, invoiceBase64;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "ios")) return [3 /*break*/, 10];
                    return [4 /*yield*/, $(selector("Share Invoice", "StaticText"))];
                case 1:
                    shareButton = _a.sent();
                    return [4 /*yield*/, shareButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, shareButton.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, $('//*[contains(@name,"lntbs")]')];
                case 4:
                    invoiceSharedScreen = _a.sent();
                    return [4 /*yield*/, invoiceSharedScreen.waitForDisplayed({
                            timeout: 8000,
                        })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, invoiceSharedScreen.getAttribute("name")];
                case 6:
                    invoice = _a.sent();
                    return [4 /*yield*/, $(selector("Close", "Button"))];
                case 7:
                    closeShareButton = _a.sent();
                    return [4 /*yield*/, closeShareButton.waitForDisplayed({ timeout: timeout })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, closeShareButton.click()];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 10: return [4 /*yield*/, browser.getClipboard()];
                case 11:
                    invoiceBase64 = _a.sent();
                    invoice = Buffer.from(invoiceBase64, "base64").toString();
                    expect(invoice).toContain("lntbs");
                    _a.label = 12;
                case 12: return [2 /*return*/];
            }
        });
    }); });
    it.skip("Capture screenshot and decode QR code to match with invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screenshot, buffer, image, imageData, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollUp()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, browser.takeScreenshot()];
                case 2:
                    screenshot = _a.sent();
                    buffer = Buffer.from(screenshot, "base64");
                    return [4 /*yield*/, jimp.read(buffer)];
                case 3:
                    image = _a.sent();
                    imageData = {
                        data: new Uint8ClampedArray(image.bitmap.data),
                        height: image.bitmap.height,
                        width: image.bitmap.width,
                    };
                    code = jsQR(imageData.data, imageData.width, imageData.height);
                    expect(code).not.toBeNull();
                    expect(code === null || code === void 0 ? void 0 : code.data).toBe(invoice.toUpperCase());
                    return [2 /*return*/];
            }
        });
    }); });
    it("External User Pays the BTC Invoice through API", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, paymentStatus;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, payNoAmountInvoice({
                        invoice: invoice,
                        walletCurrency: "BTC",
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, paymentStatus = _a.paymentStatus;
                    expect(paymentStatus).toBe("SUCCESS");
                    expect(result).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Wait for Green check for BTC Payment", function () { return __awaiter(void 0, void 0, void 0, function () {
        var successCheck;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Success Icon", "Other"))];
                case 1:
                    successCheck = _a.sent();
                    return [4 /*yield*/, successCheck.waitForExist({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back to main screen", function () { return __awaiter(void 0, void 0, void 0, function () {
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
describe("Receive via Onchain", function () {
    var invoice;
    it("Click Receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.receive())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Onchain button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var onchainButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "android")) return [3 /*break*/, 2];
                    return [4 /*yield*/, browser.pause(100)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, $(selector("Onchain", "StaticText"))];
                case 3:
                    onchainButton = _a.sent();
                    return [4 /*yield*/, onchainButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, onchainButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Copy BTC Invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrCode, copyInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("QR-Code", "Other"))];
                case 1:
                    qrCode = _a.sent();
                    return [4 /*yield*/, qrCode.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(qrCode).toBeDisplayed();
                    return [4 /*yield*/, $(selector("Copy Invoice", "StaticText"))];
                case 3:
                    copyInvoiceButton = _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get BTC Invoice from clipboard (android) or skip test (ios)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var invoiceBase64;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "android")) return [3 /*break*/, 2];
                    return [4 /*yield*/, browser.getClipboard()];
                case 1:
                    invoiceBase64 = _a.sent();
                    invoice = Buffer.from(invoiceBase64, "base64").toString();
                    expect(invoice).toContain("tb1");
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    it.skip("Capture screenshot and decode QR code", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screenshot, buffer, image, imageData, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollUp()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, browser.takeScreenshot()];
                case 2:
                    screenshot = _a.sent();
                    buffer = Buffer.from(screenshot, "base64");
                    return [4 /*yield*/, jimp.read(buffer)];
                case 3:
                    image = _a.sent();
                    imageData = {
                        data: new Uint8ClampedArray(image.bitmap.data),
                        height: image.bitmap.height,
                        width: image.bitmap.width,
                    };
                    code = jsQR(imageData.data, imageData.width, imageData.height);
                    expect(code).not.toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back to main screen", function () { return __awaiter(void 0, void 0, void 0, function () {
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
describe("Receive via Onchain on USD", function () {
    var invoice;
    it("Click Receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.receive())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Onchain button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var onchainButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "android")) return [3 /*break*/, 2];
                    return [4 /*yield*/, browser.pause(100)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, $(selector("Onchain", "StaticText"))];
                case 3:
                    onchainButton = _a.sent();
                    return [4 /*yield*/, onchainButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, onchainButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click USD invoice button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var usdInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Stablesats", "Other"))];
                case 1:
                    usdInvoiceButton = _a.sent();
                    return [4 /*yield*/, usdInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, usdInvoiceButton.click()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Copy BTC Invoice", function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrCode, copyInvoiceButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("QR-Code", "Other"))];
                case 1:
                    qrCode = _a.sent();
                    return [4 /*yield*/, qrCode.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    expect(qrCode).toBeDisplayed();
                    return [4 /*yield*/, $(selector("Copy Invoice", "StaticText"))];
                case 3:
                    copyInvoiceButton = _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.waitForDisplayed({ timeout: timeout })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, copyInvoiceButton.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Get BTC Invoice from clipboard (android) or skip test (ios)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var invoiceBase64;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.env.E2E_DEVICE === "android")) return [3 /*break*/, 2];
                    return [4 /*yield*/, browser.getClipboard()];
                case 1:
                    invoiceBase64 = _a.sent();
                    invoice = Buffer.from(invoiceBase64, "base64").toString();
                    expect(invoice).toContain("tb1");
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); });
    it.skip("Capture screenshot and decode QR code", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screenshot, buffer, image, imageData, code;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrollUp()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, browser.takeScreenshot()];
                case 2:
                    screenshot = _a.sent();
                    buffer = Buffer.from(screenshot, "base64");
                    return [4 /*yield*/, jimp.read(buffer)];
                case 3:
                    image = _a.sent();
                    imageData = {
                        data: new Uint8ClampedArray(image.bitmap.data),
                        height: image.bitmap.height,
                        width: image.bitmap.width,
                    };
                    code = jsQR(imageData.data, imageData.width, imageData.height);
                    expect(code).not.toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Go back to main screen", function () { return __awaiter(void 0, void 0, void 0, function () {
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
describe("Receive via Paycode", function () {
    it("Click Receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, clickIcon(LL.HomeScreen.receive())];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Click Paycode button", function () { return __awaiter(void 0, void 0, void 0, function () {
        var paycodeButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $(selector("Paycode", "StaticText"))];
                case 1:
                    paycodeButton = _a.sent();
                    return [4 /*yield*/, paycodeButton.waitForDisplayed({ timeout: timeout })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, paycodeButton.click()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // we can't reliably test paycode qr because username needs to have been set
    // which is conditional - can be set or for new accounts might not be set
    it("Go back to main screen", function () { return __awaiter(void 0, void 0, void 0, function () {
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
//# sourceMappingURL=05-payments-receive-flow.e2e.spec.js.map