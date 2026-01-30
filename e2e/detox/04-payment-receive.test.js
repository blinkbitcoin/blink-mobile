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
import jimp from "jimp";
import jsQR from "jsqr";
import { i18nObject } from "../../app/i18n/i18n-util";
import { loadLocale } from "../../app/i18n/i18n-util.sync";
import { sendBtcTo, sendLnPaymentFromBob } from "./utils/commandline";
import { setLocalAndLoginWithAccessToken, waitForHomeScreen } from "./utils/common-flows";
import { timeout, ALICE_TOKEN } from "./utils/config";
import { tap, sleep, addAmount } from "./utils/controls";
var decodeQRCode = function (imgPath) { return __awaiter(void 0, void 0, void 0, function () {
    var image, _a, data, width, height, clampedArray, qrCode;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, jimp.read(imgPath)];
            case 1:
                image = _b.sent();
                _a = image.bitmap, data = _a.data, width = _a.width, height = _a.height;
                clampedArray = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength / Uint8ClampedArray.BYTES_PER_ELEMENT);
                qrCode = jsQR(clampedArray, width, height);
                if (qrCode) {
                    return [2 /*return*/, qrCode.data];
                }
                throw new Error("QR code could not be decoded.");
        }
    });
}); };
loadLocale("en");
var LL = i18nObject("en");
// TODO:
// Transaction list doesn't get updated in the local setup because somehow websocket
// is broken. Thereby, the received animation is not happening. This needs debugging.
// Make sure all tests in this file reset back to home screen because tests reuse same session in this file
beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, device.launchApp({ newInstance: true, permissions: { notifications: "YES" } })];
            case 1:
                _a.sent();
                return [4 /*yield*/, setLocalAndLoginWithAccessToken(ALICE_TOKEN, LL)];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
describe("Receive: LN BTC Amountless", function () {
    it("receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        var amountInput, readablePaymentRequest, qrCode, imgPath, paymentRequest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.receive()))];
                case 1:
                    _a.sent();
                    amountInput = element(by.id("Amount Input Button"));
                    return [4 /*yield*/, waitFor(amountInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    readablePaymentRequest = element(by.id("readable-payment-request"));
                    return [4 /*yield*/, waitFor(readablePaymentRequest)
                            .toBeVisible()
                            .withTimeout(timeout * 60)];
                case 3:
                    _a.sent();
                    qrCode = element(by.id("QR-Code"));
                    return [4 /*yield*/, waitFor(qrCode).toBeVisible().withTimeout(timeout)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, qrCode.takeScreenshot("qr-code")];
                case 5:
                    imgPath = _a.sent();
                    return [4 /*yield*/, decodeQRCode(imgPath)];
                case 6:
                    paymentRequest = _a.sent();
                    return [4 /*yield*/, sendLnPaymentFromBob({ paymentRequest: paymentRequest, amount: 2 })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Back"))];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Receive: LN BTC $0.02 Amount", function () {
    it("receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        var amountInput, readablePaymentRequest, qrCode, imgPath, paymentRequest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.receive()))];
                case 1:
                    _a.sent();
                    amountInput = element(by.id("Amount Input Button"));
                    return [4 /*yield*/, waitFor(amountInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, addAmount("0.02", LL)];
                case 3:
                    _a.sent();
                    readablePaymentRequest = element(by.id("readable-payment-request"));
                    return [4 /*yield*/, waitFor(readablePaymentRequest)
                            .toBeVisible()
                            .withTimeout(timeout * 60)];
                case 4:
                    _a.sent();
                    qrCode = element(by.id("QR-Code"));
                    return [4 /*yield*/, waitFor(qrCode).toBeVisible().withTimeout(timeout)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, qrCode.takeScreenshot("qr-code")];
                case 6:
                    imgPath = _a.sent();
                    return [4 /*yield*/, decodeQRCode(imgPath)];
                case 7:
                    paymentRequest = _a.sent();
                    return [4 /*yield*/, sendLnPaymentFromBob({ paymentRequest: paymentRequest })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Back"))];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 10:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Receive: LN Stablesats Amountless", function () {
    it("receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        var amountInput, readablePaymentRequest, qrCode, imgPath, paymentRequest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.receive()))];
                case 1:
                    _a.sent();
                    amountInput = element(by.id("Amount Input Button"));
                    return [4 /*yield*/, waitFor(amountInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Dollar"))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, sleep(1000)];
                case 4:
                    _a.sent();
                    readablePaymentRequest = element(by.id("readable-payment-request"));
                    return [4 /*yield*/, waitFor(readablePaymentRequest)
                            .toBeVisible()
                            .withTimeout(timeout * 60)];
                case 5:
                    _a.sent();
                    qrCode = element(by.id("QR-Code"));
                    return [4 /*yield*/, waitFor(qrCode).toBeVisible().withTimeout(timeout)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, qrCode.takeScreenshot("qr-code")];
                case 7:
                    imgPath = _a.sent();
                    return [4 /*yield*/, decodeQRCode(imgPath)];
                case 8:
                    paymentRequest = _a.sent();
                    return [4 /*yield*/, sendLnPaymentFromBob({ paymentRequest: paymentRequest, amount: 2 })];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Back"))];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 11:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Receive: LN Stablesats $0.02 Amount", function () {
    it("receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        var amountInput, readablePaymentRequest, qrCode, imgPath, paymentRequest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.receive()))];
                case 1:
                    _a.sent();
                    amountInput = element(by.id("Amount Input Button"));
                    return [4 /*yield*/, waitFor(amountInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Dollar"))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, sleep(1000)
                        // await element(by.id("receive-screen")).scroll(400, "down", NaN, 0.85)
                    ];
                case 4:
                    _a.sent();
                    // await element(by.id("receive-screen")).scroll(400, "down", NaN, 0.85)
                    return [4 /*yield*/, addAmount("0.02", LL)];
                case 5:
                    // await element(by.id("receive-screen")).scroll(400, "down", NaN, 0.85)
                    _a.sent();
                    readablePaymentRequest = element(by.id("readable-payment-request"));
                    return [4 /*yield*/, waitFor(readablePaymentRequest)
                            .toBeVisible()
                            .withTimeout(timeout * 60)];
                case 6:
                    _a.sent();
                    qrCode = element(by.id("QR-Code"));
                    return [4 /*yield*/, waitFor(qrCode).toBeVisible().withTimeout(timeout)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, qrCode.takeScreenshot("qr-code")];
                case 8:
                    imgPath = _a.sent();
                    return [4 /*yield*/, decodeQRCode(imgPath)];
                case 9:
                    paymentRequest = _a.sent();
                    return [4 /*yield*/, sendLnPaymentFromBob({ paymentRequest: paymentRequest })];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Back"))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 12:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Receive: Onchain BTC", function () {
    it("receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        var amountInput, qrCode, imgPath, addressQR, address;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.receive()))];
                case 1:
                    _a.sent();
                    amountInput = element(by.id("Amount Input Button"));
                    return [4 /*yield*/, waitFor(amountInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Onchain"), 30)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, sleep(500)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Bitcoin"))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, sleep(500)];
                case 6:
                    _a.sent();
                    qrCode = element(by.id("QR-Code"));
                    return [4 /*yield*/, waitFor(qrCode).toBeVisible().withTimeout(timeout)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, qrCode.takeScreenshot("qr-code")];
                case 8:
                    imgPath = _a.sent();
                    return [4 /*yield*/, decodeQRCode(imgPath)];
                case 9:
                    addressQR = _a.sent();
                    address = addressQR.split(":")[1].split("?")[0];
                    return [4 /*yield*/, sendBtcTo({ address: address })];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Back"))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 12:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Receive: Onchain Stablesats", function () {
    it("receive", function () { return __awaiter(void 0, void 0, void 0, function () {
        var amountInput, qrCode, imgPath, addressQR, address;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tap(by.id(LL.HomeScreen.receive()))];
                case 1:
                    _a.sent();
                    amountInput = element(by.id("Amount Input Button"));
                    return [4 /*yield*/, waitFor(amountInput).toBeVisible().withTimeout(timeout)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Onchain"), 30)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, sleep(500)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Dollar"))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, sleep(500)];
                case 6:
                    _a.sent();
                    qrCode = element(by.id("QR-Code"));
                    return [4 /*yield*/, waitFor(qrCode).toBeVisible().withTimeout(timeout)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, qrCode.takeScreenshot("qr-code")];
                case 8:
                    imgPath = _a.sent();
                    return [4 /*yield*/, decodeQRCode(imgPath)];
                case 9:
                    addressQR = _a.sent();
                    address = addressQR.split(":")[1].split("?")[0];
                    return [4 /*yield*/, sendBtcTo({ address: address })];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, tap(by.id("Back"))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, waitForHomeScreen(LL)];
                case 12:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=04-payment-receive.test.js.map