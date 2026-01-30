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
import { toBtcMoneyAmount, toWalletAmount, } from "@app/types/amounts";
import { PaymentType } from "@blinkbitcoin/blink-client";
export var createNoAmountLightningPaymentDetails = function (params) {
    var paymentRequest = params.paymentRequest, convertMoneyAmount = params.convertMoneyAmount, unitOfAccountAmount = params.unitOfAccountAmount, sendingWalletDescriptor = params.sendingWalletDescriptor, destinationSpecifiedMemo = params.destinationSpecifiedMemo, senderSpecifiedMemo = params.senderSpecifiedMemo;
    var memo = destinationSpecifiedMemo || senderSpecifiedMemo;
    var settlementAmount = convertMoneyAmount(unitOfAccountAmount, sendingWalletDescriptor.currency);
    var setConvertMoneyAmount = function (convertMoneyAmount) {
        return createNoAmountLightningPaymentDetails(__assign(__assign({}, params), { convertMoneyAmount: convertMoneyAmount }));
    };
    var sendPaymentAndGetFee = {
        canSendPayment: false,
        canGetFee: false,
    };
    if ((settlementAmount === null || settlementAmount === void 0 ? void 0 : settlementAmount.amount) &&
        sendingWalletDescriptor.currency === WalletCurrency.Btc) {
        var getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.lnNoAmountInvoiceFeeProbe({
                            variables: {
                                input: {
                                    amount: settlementAmount.amount,
                                    paymentRequest: paymentRequest,
                                    walletId: sendingWalletDescriptor.id,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.lnNoAmountInvoiceFeeProbe.amount;
                        amount = typeof rawAmount === "number"
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                                errors: data === null || data === void 0 ? void 0 : data.lnNoAmountInvoiceFeeProbe.errors,
                            }];
                }
            });
        }); };
        var sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, paymentMutations.lnNoAmountInvoicePaymentSend({
                            variables: {
                                input: {
                                    walletId: sendingWalletDescriptor.id,
                                    paymentRequest: paymentRequest,
                                    amount: settlementAmount.amount,
                                    memo: memo,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, {
                                status: data === null || data === void 0 ? void 0 : data.lnNoAmountInvoicePaymentSend.status,
                                errors: data === null || data === void 0 ? void 0 : data.lnNoAmountInvoicePaymentSend.errors,
                                transaction: data === null || data === void 0 ? void 0 : data.lnNoAmountInvoicePaymentSend.transaction,
                            }];
                }
            });
        }); };
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            getFee: getFee,
            sendPaymentMutation: sendPaymentMutation,
        };
    }
    else if ((settlementAmount === null || settlementAmount === void 0 ? void 0 : settlementAmount.amount) &&
        sendingWalletDescriptor.currency === WalletCurrency.Usd) {
        var getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.lnNoAmountUsdInvoiceFeeProbe({
                            variables: {
                                input: {
                                    amount: settlementAmount.amount,
                                    paymentRequest: paymentRequest,
                                    walletId: sendingWalletDescriptor.id,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.lnNoAmountUsdInvoiceFeeProbe.amount;
                        amount = typeof rawAmount === "number"
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                                errors: data === null || data === void 0 ? void 0 : data.lnNoAmountUsdInvoiceFeeProbe.errors,
                            }];
                }
            });
        }); };
        var sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, paymentMutations.lnNoAmountUsdInvoicePaymentSend({
                            variables: {
                                input: {
                                    walletId: sendingWalletDescriptor.id,
                                    paymentRequest: paymentRequest,
                                    amount: settlementAmount.amount,
                                    memo: memo,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, {
                                status: data === null || data === void 0 ? void 0 : data.lnNoAmountUsdInvoicePaymentSend.status,
                                errors: data === null || data === void 0 ? void 0 : data.lnNoAmountUsdInvoicePaymentSend.errors,
                                transaction: data === null || data === void 0 ? void 0 : data.lnNoAmountUsdInvoicePaymentSend.transaction,
                            }];
                }
            });
        }); };
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            getFee: getFee,
            sendPaymentMutation: sendPaymentMutation,
        };
    }
    var setAmount = function (newUnitOfAccountAmount) {
        return createNoAmountLightningPaymentDetails(__assign(__assign({}, params), { unitOfAccountAmount: newUnitOfAccountAmount }));
    };
    var setMemo = destinationSpecifiedMemo
        ? { canSetMemo: false }
        : {
            setMemo: function (newMemo) {
                return createNoAmountLightningPaymentDetails(__assign(__assign({}, params), { senderSpecifiedMemo: newMemo }));
            },
            canSetMemo: true,
        };
    var setSendingWalletDescriptor = function (newSendingWalletDescriptor) {
        return createNoAmountLightningPaymentDetails(__assign(__assign({}, params), { sendingWalletDescriptor: newSendingWalletDescriptor }));
    };
    return __assign(__assign(__assign({ destination: paymentRequest, memo: memo, convertMoneyAmount: convertMoneyAmount, setConvertMoneyAmount: setConvertMoneyAmount, paymentType: PaymentType.Lightning, settlementAmount: settlementAmount, settlementAmountIsEstimated: false, unitOfAccountAmount: unitOfAccountAmount, sendingWalletDescriptor: sendingWalletDescriptor, setAmount: setAmount, canSetAmount: true }, setMemo), sendPaymentAndGetFee), { setSendingWalletDescriptor: setSendingWalletDescriptor });
};
export var createAmountLightningPaymentDetails = function (params) {
    var paymentRequest = params.paymentRequest, paymentRequestAmount = params.paymentRequestAmount, convertMoneyAmount = params.convertMoneyAmount, sendingWalletDescriptor = params.sendingWalletDescriptor, destinationSpecifiedMemo = params.destinationSpecifiedMemo, senderSpecifiedMemo = params.senderSpecifiedMemo;
    var memo = destinationSpecifiedMemo || senderSpecifiedMemo;
    var settlementAmount = convertMoneyAmount(paymentRequestAmount, sendingWalletDescriptor.currency);
    var unitOfAccountAmount = paymentRequestAmount;
    var sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
        var data, settlementVia;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, paymentMutations.lnInvoicePaymentSend({
                        variables: {
                            input: {
                                walletId: sendingWalletDescriptor.id,
                                paymentRequest: paymentRequest,
                                memo: memo,
                            },
                        },
                    })];
                case 1:
                    data = (_a.sent()).data;
                    settlementVia = ((data === null || data === void 0 ? void 0 : data.lnInvoicePaymentSend.transaction) || {}).settlementVia;
                    return [2 /*return*/, {
                            status: data === null || data === void 0 ? void 0 : data.lnInvoicePaymentSend.status,
                            errors: data === null || data === void 0 ? void 0 : data.lnInvoicePaymentSend.errors,
                            transaction: data === null || data === void 0 ? void 0 : data.lnInvoicePaymentSend.transaction,
                            extraInfo: {
                                preimage: (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) === "SettlementViaLn" ||
                                    (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) === "SettlementViaIntraLedger"
                                    ? settlementVia.preImage
                                    : undefined,
                            },
                        }];
            }
        });
    }); };
    var getFee;
    if (sendingWalletDescriptor.currency === WalletCurrency.Btc) {
        getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.lnInvoiceFeeProbe({
                            variables: {
                                input: {
                                    paymentRequest: paymentRequest,
                                    walletId: sendingWalletDescriptor.id,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.lnInvoiceFeeProbe.amount;
                        amount = typeof rawAmount === "number"
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                                errors: data === null || data === void 0 ? void 0 : data.lnInvoiceFeeProbe.errors,
                            }];
                }
            });
        }); };
    }
    else {
        getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.lnUsdInvoiceFeeProbe({
                            variables: {
                                input: {
                                    paymentRequest: paymentRequest,
                                    walletId: sendingWalletDescriptor.id,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.lnUsdInvoiceFeeProbe.amount;
                        amount = typeof rawAmount === "number"
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                                errors: data === null || data === void 0 ? void 0 : data.lnUsdInvoiceFeeProbe.errors,
                            }];
                }
            });
        }); };
    }
    var setMemo = destinationSpecifiedMemo
        ? {
            canSetMemo: false,
        }
        : {
            setMemo: function (newMemo) {
                return createAmountLightningPaymentDetails(__assign(__assign({}, params), { senderSpecifiedMemo: newMemo }));
            },
            canSetMemo: true,
        };
    var setConvertMoneyAmount = function (newConvertMoneyAmount) {
        return createAmountLightningPaymentDetails(__assign(__assign({}, params), { convertMoneyAmount: newConvertMoneyAmount }));
    };
    var setSendingWalletDescriptor = function (newSendingWalletDescriptor) {
        return createAmountLightningPaymentDetails(__assign(__assign({}, params), { sendingWalletDescriptor: newSendingWalletDescriptor }));
    };
    return __assign(__assign({ destination: paymentRequest, destinationSpecifiedAmount: paymentRequestAmount, convertMoneyAmount: convertMoneyAmount, memo: memo, paymentType: PaymentType.Lightning, settlementAmount: settlementAmount, settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc, sendingWalletDescriptor: sendingWalletDescriptor, unitOfAccountAmount: unitOfAccountAmount }, setMemo), { canSetAmount: false, setSendingWalletDescriptor: setSendingWalletDescriptor, setConvertMoneyAmount: setConvertMoneyAmount, sendPaymentMutation: sendPaymentMutation, canSendPayment: true, getFee: getFee, canGetFee: true });
};
export var createLnurlPaymentDetails = function (params) {
    var lnurl = params.lnurl, lnurlParams = params.lnurlParams, paymentRequest = params.paymentRequest, paymentRequestAmount = params.paymentRequestAmount, unitOfAccountAmountIfDestinationAmountNotSpecified = params.unitOfAccountAmount, convertMoneyAmount = params.convertMoneyAmount, sendingWalletDescriptor = params.sendingWalletDescriptor, destinationSpecifiedMemo = params.destinationSpecifiedMemo, senderSpecifiedMemo = params.senderSpecifiedMemo, successAction = params.successAction, isMerchant = params.isMerchant;
    var destinationSpecifiedAmount = lnurlParams.max === lnurlParams.min ? toBtcMoneyAmount(lnurlParams.max) : undefined;
    var unitOfAccountAmount = destinationSpecifiedAmount || unitOfAccountAmountIfDestinationAmountNotSpecified;
    var memo = destinationSpecifiedMemo || senderSpecifiedMemo;
    var settlementAmount;
    var sendPaymentAndGetFee = {
        canGetFee: false,
        canSendPayment: false,
    };
    if (paymentRequest && paymentRequestAmount) {
        var amountLightningPaymentDetails = createAmountLightningPaymentDetails({
            paymentRequest: paymentRequest,
            paymentRequestAmount: paymentRequestAmount,
            convertMoneyAmount: convertMoneyAmount,
            sendingWalletDescriptor: sendingWalletDescriptor,
            destinationSpecifiedMemo: memo,
            senderSpecifiedMemo: memo,
        });
        settlementAmount = amountLightningPaymentDetails.settlementAmount;
        if (amountLightningPaymentDetails.canSendPayment) {
            sendPaymentAndGetFee = {
                canSendPayment: true,
                sendPaymentMutation: amountLightningPaymentDetails.sendPaymentMutation,
                canGetFee: true,
                getFee: amountLightningPaymentDetails.getFee,
            };
        }
    }
    else {
        settlementAmount = convertMoneyAmount(unitOfAccountAmount, sendingWalletDescriptor.currency);
    }
    var setAmount = destinationSpecifiedAmount
        ? {
            canSetAmount: false,
            destinationSpecifiedAmount: destinationSpecifiedAmount,
        }
        : {
            canSetAmount: true,
            setAmount: function (newAmount) {
                return createLnurlPaymentDetails(__assign(__assign({}, params), { paymentRequest: undefined, paymentRequestAmount: undefined, unitOfAccountAmount: newAmount }));
            },
        };
    var setMemo = {
        setMemo: function (newMemo) {
            return createLnurlPaymentDetails(__assign(__assign({}, params), { senderSpecifiedMemo: newMemo, destinationSpecifiedMemo: newMemo }));
        },
        canSetMemo: true,
    };
    var setConvertMoneyAmount = function (newConvertMoneyAmount) {
        return createLnurlPaymentDetails(__assign(__assign({}, params), { convertMoneyAmount: newConvertMoneyAmount }));
    };
    var setInvoice = function (_a) {
        var paymentRequest = _a.paymentRequest, paymentRequestAmount = _a.paymentRequestAmount;
        return createLnurlPaymentDetails(__assign(__assign({}, params), { paymentRequest: paymentRequest, paymentRequestAmount: paymentRequestAmount }));
    };
    var setSuccessAction = function (newSuccessAction) {
        return createLnurlPaymentDetails(__assign(__assign({}, params), { successAction: newSuccessAction }));
    };
    var setSendingWalletDescriptor = function (newSendingWalletDescriptor) {
        return createLnurlPaymentDetails(__assign(__assign({}, params), { sendingWalletDescriptor: newSendingWalletDescriptor }));
    };
    return __assign(__assign(__assign({ lnurlParams: lnurlParams, destinationSpecifiedAmount: destinationSpecifiedAmount, sendingWalletDescriptor: sendingWalletDescriptor, unitOfAccountAmount: unitOfAccountAmount, paymentType: PaymentType.Lnurl, destination: lnurl, settlementAmount: settlementAmount, memo: memo, settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc, setSendingWalletDescriptor: setSendingWalletDescriptor, setInvoice: setInvoice, convertMoneyAmount: convertMoneyAmount, setConvertMoneyAmount: setConvertMoneyAmount, successAction: successAction, setSuccessAction: setSuccessAction, isMerchant: isMerchant }, setAmount), setMemo), sendPaymentAndGetFee);
};
//# sourceMappingURL=lightning.js.map