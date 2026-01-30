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
import { TouchableOpacity, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { DisplayCurrency, toUsdMoneyAmount } from "@app/types/amounts";
import { WalletCurrency } from "@app/graphql/generated";
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/intraledger";
import * as PaymentDetailsLightning from "@app/screens/send-bitcoin-screen/payment-details/lightning";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { i18nObject } from "@app/i18n/i18n-util";
import { Intraledger, LightningLnURL, } from "@app/screens/send-bitcoin-screen/send-bitcoin-confirmation-screen.stories";
import { ContextForScreen } from "./helper";
jest.mock("@app/graphql/generated", function () { return (__assign(__assign({}, jest.requireActual("@app/graphql/generated")), { useSendBitcoinConfirmationScreenQuery: jest.fn(function () { return ({
        data: {
            me: {
                id: "mocked-user-id",
                defaultAccount: {
                    id: "mocked-account-id",
                    wallets: [
                        {
                            id: "btc-wallet-id",
                            balance: 500000,
                            walletCurrency: "BTC",
                        },
                        {
                            id: "usd-wallet-id",
                            balance: 10000,
                            walletCurrency: "USD",
                        },
                    ],
                },
            },
        },
    }); }) })); });
var btcSendingWalletDescriptor = {
    currency: WalletCurrency.Usd,
    id: "testwallet",
};
var convertMoneyAmountMock = function (amount, currency) {
    return {
        amount: amount.amount,
        currency: currency,
        currencyCode: currency === DisplayCurrency ? "NGN" : currency,
    };
};
var testAmount = toUsdMoneyAmount(100);
var defaultParams = {
    handle: "test",
    recipientWalletId: "testid",
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    unitOfAccountAmount: testAmount,
};
var createIntraledgerPaymentDetails = PaymentDetails.createIntraledgerPaymentDetails;
var paymentDetail = createIntraledgerPaymentDetails(defaultParams);
var route = {
    key: "sendBitcoinConfirmationScreen",
    name: "sendBitcoinConfirmation",
    params: {
        paymentDetail: paymentDetail,
    },
};
var successActionMessageMock = {
    tag: "message",
    message: "Thank you for your support.",
    description: null,
    url: null,
    ciphertext: null,
    iv: null,
    decipher: function () { return null; },
};
var lnUrlMock = {
    callback: "https://example.com/lnurl/callback",
    metadata: [["text/plain", "Pay to user@example.com"]],
    min: 1000,
    max: 1000000,
    fixed: false,
    metadataHash: "",
    identifier: "user@example.com",
    description: "Payment for services",
    image: "https://example.com/image.png",
    commentAllowed: 0,
    rawData: {},
};
var defaultLightningParams = {
    lnurl: "lnurl1dp68gurn8ghj7mr...",
    lnurlParams: lnUrlMock,
    paymentRequest: "lnbc1m1psh8d8zpp5qk3z7t...",
    paymentRequestAmount: {
        currency: "BTC",
        currencyCode: "BTC",
        amount: 10000,
    },
    unitOfAccountAmount: {
        currency: "USD",
        amount: 5.0,
        currencyCode: "USD",
    },
    successAction: successActionMessageMock,
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    isMerchant: false,
};
var saveLnAddressContactMock = jest.fn(function (_a) {
    var isMerchant = _a.isMerchant;
    if (isMerchant) {
        return Promise.resolve({ saved: false });
    }
    return Promise.resolve({ saved: true, handle: "user@example.com" });
});
jest.mock("@app/screens/send-bitcoin-screen/use-save-lnaddress-contact", function () { return ({
    useSaveLnAddressContact: function () { return saveLnAddressContactMock; },
}); });
var sendPaymentMock = jest.fn();
jest.mock("@app/screens/send-bitcoin-screen/use-send-payment", function () { return ({
    useSendPayment: function () { return ({
        loading: false,
        hasAttemptedSend: false,
        sendPayment: sendPaymentMock,
    }); },
}); });
jest.mock("@app/components/atomic/galoy-slider-button/galoy-slider-button", function () {
    var MockGaloySliderButton = function (_a) {
        var onSwipe = _a.onSwipe, _b = _a.testID, testID = _b === void 0 ? "slider" : _b, _c = _a.initialText, initialText = _c === void 0 ? "Slide" : _c;
        return (<TouchableOpacity testID={testID} onPress={onSwipe}>
      <Text>{initialText}</Text>
    </TouchableOpacity>);
    };
    return { __esModule: true, default: MockGaloySliderButton };
});
describe("SendBitcoinConfirmationScreen", function () {
    var LL;
    beforeEach(function () {
        jest.clearAllMocks();
        loadLocale("en");
        LL = i18nObject("en");
    });
    it("Send Screen Confirmation - Intraledger Payment", function () { return __awaiter(void 0, void 0, void 0, function () {
        var findByLabelText, children;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    findByLabelText = render(<ContextForScreen>
        <Intraledger route={route}/>
      </ContextForScreen>).findByLabelText;
                    // it seems we need multiple act because the component re-render multiple times
                    // probably this could be debug with why-did-you-render
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    // it seems we need multiple act because the component re-render multiple times
                    // probably this could be debug with why-did-you-render
                    _a.sent();
                    return [4 /*yield*/, findByLabelText("Successful Fee")];
                case 2:
                    children = (_a.sent()).children;
                    expect(children).toEqual(["₦0 ($0.00)"]);
                    return [2 /*return*/];
            }
        });
    }); });
    it("Send Screen Confirmation - Lightning lnurl Payment", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createLnurlPaymentDetails, paymentDetailLightning, route, lnurl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    createLnurlPaymentDetails = PaymentDetailsLightning.createLnurlPaymentDetails;
                    paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams);
                    route = {
                        key: "sendBitcoinConfirmationScreen",
                        name: "sendBitcoinConfirmation",
                        params: {
                            paymentDetail: paymentDetailLightning,
                        },
                    };
                    lnurl = "lnurl1dp68gurn8ghj7mr...";
                    render(<ContextForScreen>
        <LightningLnURL route={route}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () {
                            return new Promise(function (resolve) {
                                setTimeout(resolve, 10);
                            });
                        })];
                case 1:
                    _a.sent();
                    expect(screen.getByText(lnurl)).toBeTruthy();
                    expect(screen.getByText("$0.05 (₦100)")).toBeTruthy();
                    expect(screen.getByTestId("slider")).toBeTruthy();
                    expect(LL.SendBitcoinConfirmationScreen.slideToConfirm()).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("Calls saveLnAddressContact when LNURL payment is SUCCESS", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createLnurlPaymentDetails, paymentDetailLightning, routeLnurl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    createLnurlPaymentDetails = PaymentDetailsLightning.createLnurlPaymentDetails;
                    paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams);
                    routeLnurl = {
                        key: "sendBitcoinConfirmationScreen",
                        name: "sendBitcoinConfirmation",
                        params: { paymentDetail: paymentDetailLightning },
                    };
                    sendPaymentMock.mockResolvedValueOnce({
                        status: "SUCCESS",
                        extraInfo: { preimage: "preimagetest" },
                    });
                    render(<ContextForScreen>
        <LightningLnURL route={routeLnurl}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(screen.getByTestId("slider"));
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(sendPaymentMock).toHaveBeenCalledTimes(1);
                    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1);
                    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
                        paymentType: "lnurl",
                        destination: defaultLightningParams.lnurl,
                        isMerchant: false,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("Call saveLnAddressContact when LNURL payment is PENDING", function () { return __awaiter(void 0, void 0, void 0, function () {
        var createLnurlPaymentDetails, paymentDetailLightning, routeLnurl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    createLnurlPaymentDetails = PaymentDetailsLightning.createLnurlPaymentDetails;
                    paymentDetailLightning = createLnurlPaymentDetails(defaultLightningParams);
                    routeLnurl = {
                        key: "sendBitcoinConfirmationScreen",
                        name: "sendBitcoinConfirmation",
                        params: { paymentDetail: paymentDetailLightning },
                    };
                    sendPaymentMock.mockResolvedValueOnce({
                        status: "PENDING",
                        extraInfo: {},
                    });
                    render(<ContextForScreen>
        <LightningLnURL route={routeLnurl}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(screen.getByTestId("slider"));
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(sendPaymentMock).toHaveBeenCalledTimes(1);
                    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1);
                    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
                        paymentType: "lnurl",
                        destination: defaultLightningParams.lnurl,
                        isMerchant: false,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("Does not call saveLnAddressContact when LNURL payment is to a merchant", function () { return __awaiter(void 0, void 0, void 0, function () {
        var merchantParams, createLnurlPaymentDetails, paymentDetailMerchant, routeMerchant;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    merchantParams = __assign(__assign({}, defaultLightningParams), { isMerchant: true });
                    createLnurlPaymentDetails = PaymentDetailsLightning.createLnurlPaymentDetails;
                    paymentDetailMerchant = createLnurlPaymentDetails(merchantParams);
                    routeMerchant = {
                        key: "sendBitcoinConfirmationScreen",
                        name: "sendBitcoinConfirmation",
                        params: { paymentDetail: paymentDetailMerchant },
                    };
                    sendPaymentMock.mockResolvedValueOnce({
                        status: "SUCCESS",
                        extraInfo: { preimage: "preimagetest" },
                    });
                    render(<ContextForScreen>
        <LightningLnURL route={routeMerchant}/>
      </ContextForScreen>);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                fireEvent.press(screen.getByTestId("slider"));
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(sendPaymentMock).toHaveBeenCalledTimes(1);
                    expect(saveLnAddressContactMock).toHaveBeenCalledTimes(1);
                    expect(saveLnAddressContactMock).toHaveBeenCalledWith({
                        paymentType: "lnurl",
                        destination: merchantParams.lnurl,
                        isMerchant: true,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=send-confirmation.spec.js.map