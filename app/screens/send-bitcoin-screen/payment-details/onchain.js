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
import { toWalletAmount, } from "@app/types/amounts";
import { PaymentType } from "@blinkbitcoin/blink-client";
export var createNoAmountOnchainPaymentDetails = function (params) {
    var convertMoneyAmount = params.convertMoneyAmount, sendingWalletDescriptor = params.sendingWalletDescriptor, destinationSpecifiedMemo = params.destinationSpecifiedMemo, unitOfAccountAmount = params.unitOfAccountAmount, senderSpecifiedMemo = params.senderSpecifiedMemo, isSendingMax = params.isSendingMax, address = params.address;
    var settlementAmount = convertMoneyAmount(unitOfAccountAmount, sendingWalletDescriptor.currency);
    var memo = destinationSpecifiedMemo || senderSpecifiedMemo;
    var sendPaymentAndGetFee = {
        canSendPayment: false,
        canGetFee: false,
    };
    if (isSendingMax) {
        var sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, paymentMutations.onChainPaymentSendAll({
                            variables: {
                                input: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    memo: memo,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, {
                                status: data === null || data === void 0 ? void 0 : data.onChainPaymentSendAll.status,
                                errors: data === null || data === void 0 ? void 0 : data.onChainPaymentSendAll.errors,
                                transaction: data === null || data === void 0 ? void 0 : data.onChainPaymentSendAll.transaction,
                            }];
                }
            });
        }); };
        var getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount, data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(sendingWalletDescriptor.currency === WalletCurrency.Btc)) return [3 /*break*/, 2];
                        return [4 /*yield*/, getFeeFns.onChainTxFee({
                                variables: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: settlementAmount.amount,
                                },
                            })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.onChainTxFee.amount;
                        amount = typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                            }];
                    case 2:
                        if (!(sendingWalletDescriptor.currency === WalletCurrency.Usd)) return [3 /*break*/, 4];
                        return [4 /*yield*/, getFeeFns.onChainUsdTxFee({
                                variables: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: settlementAmount.amount,
                                },
                            })];
                    case 3:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.onChainUsdTxFee.amount;
                        amount = typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                            }];
                    case 4: return [2 /*return*/, { amount: null }];
                }
            });
        }); };
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            sendPaymentMutation: sendPaymentMutation,
            getFee: getFee,
        };
    }
    else if (settlementAmount.amount &&
        sendingWalletDescriptor.currency === WalletCurrency.Btc) {
        var sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
            var data;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, paymentMutations.onChainPaymentSend({
                            variables: {
                                input: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: settlementAmount.amount,
                                    memo: memo,
                                },
                            },
                        })];
                    case 1:
                        data = (_b.sent()).data;
                        return [2 /*return*/, {
                                status: data === null || data === void 0 ? void 0 : data.onChainPaymentSend.status,
                                errors: data === null || data === void 0 ? void 0 : data.onChainPaymentSend.errors,
                                transaction: data === null || data === void 0 ? void 0 : data.onChainPaymentSend.transaction,
                                extraInfo: {
                                    arrivalAtMempoolEstimate: ((_a = data === null || data === void 0 ? void 0 : data.onChainPaymentSend.transaction) === null || _a === void 0 ? void 0 : _a.settlementVia.__typename) ===
                                        "SettlementViaOnChain" &&
                                        data.onChainPaymentSend.transaction.settlementVia.arrivalInMempoolEstimatedAt
                                        ? data.onChainPaymentSend.transaction.settlementVia
                                            .arrivalInMempoolEstimatedAt
                                        : undefined,
                                },
                            }];
                }
            });
        }); };
        var getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.onChainTxFee({
                            variables: {
                                walletId: sendingWalletDescriptor.id,
                                address: address,
                                amount: settlementAmount.amount,
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.onChainTxFee.amount;
                        amount = typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                            }];
                }
            });
        }); };
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            sendPaymentMutation: sendPaymentMutation,
            getFee: getFee,
        };
    }
    else if (settlementAmount.amount &&
        sendingWalletDescriptor.currency === WalletCurrency.Usd) {
        var sendPaymentMutation = void 0;
        var getFee = void 0;
        if (settlementAmount.currency === WalletCurrency.Usd) {
            sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
                var data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, paymentMutations.onChainUsdPaymentSend({
                                variables: {
                                    input: {
                                        walletId: sendingWalletDescriptor.id,
                                        address: address,
                                        amount: settlementAmount.amount,
                                    },
                                },
                            })];
                        case 1:
                            data = (_a.sent()).data;
                            return [2 /*return*/, {
                                    status: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSend.status,
                                    errors: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSend.errors,
                                    transaction: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSend.transaction,
                                }];
                    }
                });
            }); };
            getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
                var data, rawAmount, amount;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getFeeFns.onChainUsdTxFee({
                                variables: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: settlementAmount.amount,
                                },
                            })];
                        case 1:
                            data = (_a.sent()).data;
                            rawAmount = data === null || data === void 0 ? void 0 : data.onChainUsdTxFee.amount;
                            amount = typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
                                ? toWalletAmount({
                                    amount: rawAmount,
                                    currency: sendingWalletDescriptor.currency,
                                })
                                : rawAmount;
                            return [2 /*return*/, {
                                    amount: amount,
                                }];
                    }
                });
            }); };
        }
        else {
            sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
                var data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, paymentMutations.onChainUsdPaymentSendAsBtcDenominated({
                                variables: {
                                    input: {
                                        walletId: sendingWalletDescriptor.id,
                                        address: address,
                                        amount: settlementAmount.amount,
                                    },
                                },
                            })];
                        case 1:
                            data = (_a.sent()).data;
                            return [2 /*return*/, {
                                    status: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSendAsBtcDenominated.status,
                                    errors: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSendAsBtcDenominated.errors,
                                    transaction: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSendAsBtcDenominated.transaction,
                                }];
                    }
                });
            }); };
            getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
                var data, rawAmount, amount;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getFeeFns.onChainUsdTxFeeAsBtcDenominated({
                                variables: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: settlementAmount.amount,
                                },
                            })];
                        case 1:
                            data = (_a.sent()).data;
                            rawAmount = data === null || data === void 0 ? void 0 : data.onChainUsdTxFeeAsBtcDenominated.amount;
                            amount = typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
                                ? toWalletAmount({
                                    amount: rawAmount,
                                    currency: sendingWalletDescriptor.currency,
                                })
                                : rawAmount;
                            return [2 /*return*/, {
                                    amount: amount,
                                }];
                    }
                });
            }); };
        }
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            sendPaymentMutation: sendPaymentMutation,
            getFee: getFee,
        };
    }
    var setAmount = function (newUnitOfAccountAmount, sendMax) {
        if (sendMax === void 0) { sendMax = false; }
        return createNoAmountOnchainPaymentDetails(__assign(__assign({}, params), { isSendingMax: sendMax, unitOfAccountAmount: newUnitOfAccountAmount }));
    };
    var setMemo = destinationSpecifiedMemo
        ? { canSetMemo: false }
        : {
            setMemo: function (newMemo) {
                return createNoAmountOnchainPaymentDetails(__assign(__assign({}, params), { senderSpecifiedMemo: newMemo }));
            },
            canSetMemo: true,
        };
    var setConvertMoneyAmount = function (newConvertMoneyAmount) {
        return createNoAmountOnchainPaymentDetails(__assign(__assign({}, params), { convertMoneyAmount: newConvertMoneyAmount }));
    };
    var setSendingWalletDescriptor = function (newSendingWalletDescriptor) {
        return createNoAmountOnchainPaymentDetails(__assign(__assign({}, params), { sendingWalletDescriptor: newSendingWalletDescriptor }));
    };
    return __assign(__assign(__assign(__assign({ destination: address, settlementAmount: settlementAmount, settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc, unitOfAccountAmount: unitOfAccountAmount, sendingWalletDescriptor: sendingWalletDescriptor, memo: memo, paymentType: PaymentType.Onchain, setSendingWalletDescriptor: setSendingWalletDescriptor, convertMoneyAmount: convertMoneyAmount, setConvertMoneyAmount: setConvertMoneyAmount }, setMemo), { setAmount: setAmount, canSetAmount: true }), sendPaymentAndGetFee), { canSendMax: true, isSendingMax: isSendingMax });
};
export var createAmountOnchainPaymentDetails = function (params) {
    var destinationSpecifiedAmount = params.destinationSpecifiedAmount, convertMoneyAmount = params.convertMoneyAmount, sendingWalletDescriptor = params.sendingWalletDescriptor, destinationSpecifiedMemo = params.destinationSpecifiedMemo, senderSpecifiedMemo = params.senderSpecifiedMemo, address = params.address;
    var settlementAmount = convertMoneyAmount(destinationSpecifiedAmount, sendingWalletDescriptor.currency);
    var unitOfAccountAmount = destinationSpecifiedAmount;
    var memo = destinationSpecifiedMemo || senderSpecifiedMemo;
    var sendPaymentAndGetFee = {
        canSendPayment: false,
        canGetFee: false,
    };
    var sendPaymentMutation;
    var getFee;
    if (sendingWalletDescriptor.currency === WalletCurrency.Btc) {
        sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, paymentMutations.onChainPaymentSend({
                            variables: {
                                input: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: settlementAmount.amount,
                                    memo: memo,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, {
                                status: data === null || data === void 0 ? void 0 : data.onChainPaymentSend.status,
                                errors: data === null || data === void 0 ? void 0 : data.onChainPaymentSend.errors,
                            }];
                }
            });
        }); };
        getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.onChainTxFee({
                            variables: {
                                walletId: sendingWalletDescriptor.id,
                                address: address,
                                amount: settlementAmount.amount,
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.onChainTxFee.amount;
                        amount = typeof rawAmount === "number"
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                            }];
                }
            });
        }); };
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            sendPaymentMutation: sendPaymentMutation,
            getFee: getFee,
        };
    }
    else {
        // sendingWalletDescriptor.currency === WalletCurrency.Usd
        sendPaymentMutation = function (paymentMutations) { return __awaiter(void 0, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, paymentMutations.onChainUsdPaymentSendAsBtcDenominated({
                            variables: {
                                input: {
                                    walletId: sendingWalletDescriptor.id,
                                    address: address,
                                    amount: unitOfAccountAmount.amount,
                                },
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, {
                                status: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSendAsBtcDenominated.status,
                                errors: data === null || data === void 0 ? void 0 : data.onChainUsdPaymentSendAsBtcDenominated.errors,
                            }];
                }
            });
        }); };
        getFee = function (getFeeFns) { return __awaiter(void 0, void 0, void 0, function () {
            var data, rawAmount, amount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getFeeFns.onChainUsdTxFeeAsBtcDenominated({
                            variables: {
                                walletId: sendingWalletDescriptor.id,
                                address: address,
                                amount: unitOfAccountAmount.amount,
                            },
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        rawAmount = data === null || data === void 0 ? void 0 : data.onChainUsdTxFeeAsBtcDenominated.amount;
                        amount = typeof rawAmount === "number"
                            ? toWalletAmount({
                                amount: rawAmount,
                                currency: sendingWalletDescriptor.currency,
                            })
                            : rawAmount;
                        return [2 /*return*/, {
                                amount: amount,
                            }];
                }
            });
        }); };
        sendPaymentAndGetFee = {
            canSendPayment: true,
            canGetFee: true,
            sendPaymentMutation: sendPaymentMutation,
            getFee: getFee,
        };
    }
    var setMemo = destinationSpecifiedMemo
        ? {
            canSetMemo: false,
        }
        : {
            setMemo: function (newMemo) {
                return createAmountOnchainPaymentDetails(__assign(__assign({}, params), { senderSpecifiedMemo: newMemo }));
            },
            canSetMemo: true,
        };
    var setConvertMoneyAmount = function (newConvertMoneyAmount) {
        return createAmountOnchainPaymentDetails(__assign(__assign({}, params), { convertMoneyAmount: newConvertMoneyAmount }));
    };
    var setSendingWalletDescriptor = function (newSendingWalletDescriptor) {
        return createAmountOnchainPaymentDetails(__assign(__assign({}, params), { sendingWalletDescriptor: newSendingWalletDescriptor }));
    };
    return __assign(__assign(__assign({ destination: address, destinationSpecifiedAmount: destinationSpecifiedAmount, settlementAmount: settlementAmount, settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc, unitOfAccountAmount: unitOfAccountAmount, sendingWalletDescriptor: sendingWalletDescriptor, setSendingWalletDescriptor: setSendingWalletDescriptor, canSetAmount: false, convertMoneyAmount: convertMoneyAmount, setConvertMoneyAmount: setConvertMoneyAmount }, setMemo), { memo: memo, paymentType: PaymentType.Onchain }), sendPaymentAndGetFee);
};
//# sourceMappingURL=onchain.js.map