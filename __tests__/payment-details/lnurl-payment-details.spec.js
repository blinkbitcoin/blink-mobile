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
import { WalletCurrency } from "@app/graphql/generated";
import * as PaymentDetails from "@app/screens/send-bitcoin-screen/payment-details/lightning";
import { btcSendingWalletDescriptor, btcTestAmount, convertMoneyAmountMock, createGetFeeMocks, createSendPaymentMocks, testAmount, usdSendingWalletDescriptor, } from "./helpers";
var mockLnUrlPayServiceResponse = function (min, max) { return ({
    callback: "mockCallbackUrl",
    fixed: false,
    min: min,
    max: max,
    domain: "mockDomain",
    metadata: [["mockMetadata"]],
    metadataHash: "mockMetadataHash",
    identifier: "mockIdentifier",
    description: "mockDescription",
    image: "mockImageUrl",
    commentAllowed: 0,
    rawData: {
        mockKey: "mockValue",
    },
}); };
var defaultParamsWithoutInvoice = {
    lnurl: "testlnurl",
    lnurlParams: mockLnUrlPayServiceResponse(1, 1000),
    convertMoneyAmount: convertMoneyAmountMock,
    sendingWalletDescriptor: btcSendingWalletDescriptor,
    unitOfAccountAmount: testAmount,
    isMerchant: false,
};
var defaultParamsWithInvoice = __assign(__assign({}, defaultParamsWithoutInvoice), { paymentRequest: "testinvoice", paymentRequestAmount: btcTestAmount });
var defaultParamsWithEqualMinMaxAmount = __assign(__assign({}, defaultParamsWithoutInvoice), { lnurlParams: mockLnUrlPayServiceResponse(100, 100) });
describe("lnurl payment details", function () {
    var createLnurlPaymentDetails = PaymentDetails.createLnurlPaymentDetails;
    it("properly sets fields if min and max amount is equal", function () {
        var paymentDetails = createLnurlPaymentDetails(defaultParamsWithEqualMinMaxAmount);
        expect(paymentDetails).toEqual(expect.objectContaining({
            destination: defaultParamsWithEqualMinMaxAmount.lnurl,
            settlementAmount: defaultParamsWithEqualMinMaxAmount.unitOfAccountAmount,
            unitOfAccountAmount: defaultParamsWithEqualMinMaxAmount.unitOfAccountAmount,
            sendingWalletDescriptor: defaultParamsWithEqualMinMaxAmount.sendingWalletDescriptor,
            settlementAmountIsEstimated: defaultParamsWithEqualMinMaxAmount.sendingWalletDescriptor.currency !==
                WalletCurrency.Btc,
            canGetFee: false,
            canSendPayment: false,
            canSetAmount: false,
            canSetMemo: true,
            convertMoneyAmount: defaultParamsWithoutInvoice.convertMoneyAmount,
        }));
    });
    it("properly sets fields without invoice", function () {
        var paymentDetails = createLnurlPaymentDetails(defaultParamsWithoutInvoice);
        expect(paymentDetails).toEqual(expect.objectContaining({
            destination: defaultParamsWithoutInvoice.lnurl,
            settlementAmount: defaultParamsWithoutInvoice.unitOfAccountAmount,
            unitOfAccountAmount: defaultParamsWithoutInvoice.unitOfAccountAmount,
            sendingWalletDescriptor: defaultParamsWithoutInvoice.sendingWalletDescriptor,
            canGetFee: false,
            settlementAmountIsEstimated: defaultParamsWithInvoice.sendingWalletDescriptor.currency !==
                WalletCurrency.Btc,
            canSendPayment: false,
            canSetAmount: true,
            canSetMemo: true,
            convertMoneyAmount: defaultParamsWithoutInvoice.convertMoneyAmount,
        }));
    });
    it("properly sets fields with invoice set", function () {
        var paymentDetails = createLnurlPaymentDetails(defaultParamsWithInvoice);
        expect(paymentDetails).toEqual(expect.objectContaining({
            destination: defaultParamsWithInvoice.lnurl,
            settlementAmount: defaultParamsWithInvoice.paymentRequestAmount,
            unitOfAccountAmount: defaultParamsWithInvoice.unitOfAccountAmount,
            sendingWalletDescriptor: defaultParamsWithInvoice.sendingWalletDescriptor,
            settlementAmountIsEstimated: defaultParamsWithInvoice.sendingWalletDescriptor.currency !==
                WalletCurrency.Btc,
            canGetFee: true,
            canSendPayment: true,
            canSetAmount: true,
            canSetMemo: true,
            convertMoneyAmount: defaultParamsWithoutInvoice.convertMoneyAmount,
        }));
    });
    describe("sending from a btc wallet", function () {
        var btcSendingWalletParams = __assign(__assign({}, defaultParamsWithInvoice), { sendingWalletDescriptor: btcSendingWalletDescriptor });
        var paymentDetails = createLnurlPaymentDetails(btcSendingWalletParams);
        it("uses the correct fee mutations and args", function () { return __awaiter(void 0, void 0, void 0, function () {
            var feeParamsMocks, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        feeParamsMocks = createGetFeeMocks();
                        if (!paymentDetails.canGetFee) {
                            throw new Error("Cannot get fee");
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, paymentDetails.getFee(feeParamsMocks)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        expect(feeParamsMocks.lnInvoiceFeeProbe).toHaveBeenCalledWith({
                            variables: {
                                input: {
                                    paymentRequest: btcSendingWalletParams.paymentRequest,
                                    walletId: btcSendingWalletParams.sendingWalletDescriptor.id,
                                },
                            },
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it("uses the correct send payment mutation and args", function () { return __awaiter(void 0, void 0, void 0, function () {
            var sendPaymentMocks, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        sendPaymentMocks = createSendPaymentMocks();
                        if (!paymentDetails.canSendPayment) {
                            throw new Error("Cannot send payment");
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, paymentDetails.sendPaymentMutation(sendPaymentMocks)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        expect(sendPaymentMocks.lnInvoicePaymentSend).toHaveBeenCalledWith({
                            variables: {
                                input: {
                                    paymentRequest: btcSendingWalletParams.paymentRequest,
                                    walletId: btcSendingWalletParams.sendingWalletDescriptor.id,
                                },
                            },
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("sending from a usd wallet", function () {
        var usdSendingWalletParams = __assign(__assign({}, defaultParamsWithInvoice), { sendingWalletDescriptor: usdSendingWalletDescriptor });
        var paymentDetails = createLnurlPaymentDetails(usdSendingWalletParams);
        it("uses the correct fee mutations and args", function () { return __awaiter(void 0, void 0, void 0, function () {
            var feeParamsMocks, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        feeParamsMocks = createGetFeeMocks();
                        if (!paymentDetails.canGetFee) {
                            throw new Error("Cannot get fee");
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, paymentDetails.getFee(feeParamsMocks)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        expect(feeParamsMocks.lnUsdInvoiceFeeProbe).toHaveBeenCalledWith({
                            variables: {
                                input: {
                                    paymentRequest: usdSendingWalletParams.paymentRequest,
                                    walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
                                },
                            },
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it("uses the correct send payment mutation and args", function () { return __awaiter(void 0, void 0, void 0, function () {
            var sendPaymentMocks, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        sendPaymentMocks = createSendPaymentMocks();
                        if (!paymentDetails.canSendPayment) {
                            throw new Error("Cannot send payment");
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, paymentDetails.sendPaymentMutation(sendPaymentMocks)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        expect(sendPaymentMocks.lnInvoicePaymentSend).toHaveBeenCalledWith({
                            variables: {
                                input: {
                                    paymentRequest: usdSendingWalletParams.paymentRequest,
                                    walletId: usdSendingWalletParams.sendingWalletDescriptor.id,
                                },
                            },
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    it("can set amount", function () {
        var paymentDetails = createLnurlPaymentDetails(defaultParamsWithoutInvoice);
        var unitOfAccountAmount = {
            amount: 100,
            currency: WalletCurrency.Btc,
            currencyCode: "BTC",
        };
        if (!paymentDetails.canSetAmount)
            throw new Error("Amount is unable to be set");
        var newPaymentDetails = paymentDetails.setAmount(unitOfAccountAmount);
        expect(newPaymentDetails.unitOfAccountAmount).toEqual(unitOfAccountAmount);
    });
    it("can set sending wallet descriptor", function () {
        var paymentDetails = createLnurlPaymentDetails(defaultParamsWithoutInvoice);
        var sendingWalletDescriptor = {
            currency: WalletCurrency.Btc,
            id: "newtestwallet",
        };
        var newPaymentDetails = paymentDetails.setSendingWalletDescriptor(sendingWalletDescriptor);
        expect(newPaymentDetails.sendingWalletDescriptor).toEqual(sendingWalletDescriptor);
    });
});
//# sourceMappingURL=lnurl-payment-details.spec.js.map