var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
import { useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useLnInvoiceFeeProbeMutation, useLnNoAmountInvoiceFeeProbeMutation, useLnNoAmountUsdInvoiceFeeProbeMutation, useLnUsdInvoiceFeeProbeMutation, useOnChainTxFeeLazyQuery, useOnChainUsdTxFeeAsBtcDenominatedLazyQuery, useOnChainUsdTxFeeLazyQuery, } from "@app/graphql/generated";
import crashlytics from "@react-native-firebase/crashlytics";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation lnNoAmountInvoiceFeeProbe($input: LnNoAmountInvoiceFeeProbeInput!) {\n    lnNoAmountInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  mutation lnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {\n    lnInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  mutation lnUsdInvoiceFeeProbe($input: LnUsdInvoiceFeeProbeInput!) {\n    lnUsdInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  mutation lnNoAmountUsdInvoiceFeeProbe($input: LnNoAmountUsdInvoiceFeeProbeInput!) {\n    lnNoAmountUsdInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  query onChainTxFee(\n    $walletId: WalletId!\n    $address: OnChainAddress!\n    $amount: SatAmount!\n  ) {\n    onChainTxFee(walletId: $walletId, address: $address, amount: $amount) {\n      amount\n    }\n  }\n\n  query onChainUsdTxFee(\n    $walletId: WalletId!\n    $address: OnChainAddress!\n    $amount: CentAmount!\n  ) {\n    onChainUsdTxFee(walletId: $walletId, address: $address, amount: $amount) {\n      amount\n    }\n  }\n\n  query onChainUsdTxFeeAsBtcDenominated(\n    $walletId: WalletId!\n    $address: OnChainAddress!\n    $amount: SatAmount!\n  ) {\n    onChainUsdTxFeeAsBtcDenominated(\n      walletId: $walletId\n      address: $address\n      amount: $amount\n    ) {\n      amount\n    }\n  }\n"], ["\n  mutation lnNoAmountInvoiceFeeProbe($input: LnNoAmountInvoiceFeeProbeInput!) {\n    lnNoAmountInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  mutation lnInvoiceFeeProbe($input: LnInvoiceFeeProbeInput!) {\n    lnInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  mutation lnUsdInvoiceFeeProbe($input: LnUsdInvoiceFeeProbeInput!) {\n    lnUsdInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  mutation lnNoAmountUsdInvoiceFeeProbe($input: LnNoAmountUsdInvoiceFeeProbeInput!) {\n    lnNoAmountUsdInvoiceFeeProbe(input: $input) {\n      errors {\n        message\n      }\n      amount\n    }\n  }\n\n  query onChainTxFee(\n    $walletId: WalletId!\n    $address: OnChainAddress!\n    $amount: SatAmount!\n  ) {\n    onChainTxFee(walletId: $walletId, address: $address, amount: $amount) {\n      amount\n    }\n  }\n\n  query onChainUsdTxFee(\n    $walletId: WalletId!\n    $address: OnChainAddress!\n    $amount: CentAmount!\n  ) {\n    onChainUsdTxFee(walletId: $walletId, address: $address, amount: $amount) {\n      amount\n    }\n  }\n\n  query onChainUsdTxFeeAsBtcDenominated(\n    $walletId: WalletId!\n    $address: OnChainAddress!\n    $amount: SatAmount!\n  ) {\n    onChainUsdTxFeeAsBtcDenominated(\n      walletId: $walletId\n      address: $address\n      amount: $amount\n    ) {\n      amount\n    }\n  }\n"])));
var useFee = function (getFeeFn) {
    var _a = useState({
        status: "unset",
    }), fee = _a[0], setFee = _a[1];
    var lnInvoiceFeeProbe = useLnInvoiceFeeProbeMutation()[0];
    var lnNoAmountInvoiceFeeProbe = useLnNoAmountInvoiceFeeProbeMutation()[0];
    var lnUsdInvoiceFeeProbe = useLnUsdInvoiceFeeProbeMutation()[0];
    var lnNoAmountUsdInvoiceFeeProbe = useLnNoAmountUsdInvoiceFeeProbeMutation()[0];
    var onChainTxFee = useOnChainTxFeeLazyQuery()[0];
    var onChainUsdTxFee = useOnChainUsdTxFeeLazyQuery()[0];
    var onChainUsdTxFeeAsBtcDenominated = useOnChainUsdTxFeeAsBtcDenominatedLazyQuery()[0];
    useEffect(function () {
        if (!getFeeFn) {
            return;
        }
        var getFee = function () { return __awaiter(void 0, void 0, void 0, function () {
            var feeResponse, err_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setFee({
                            status: "loading",
                        });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, getFeeFn({
                                lnInvoiceFeeProbe: lnInvoiceFeeProbe,
                                lnNoAmountInvoiceFeeProbe: lnNoAmountInvoiceFeeProbe,
                                lnUsdInvoiceFeeProbe: lnUsdInvoiceFeeProbe,
                                lnNoAmountUsdInvoiceFeeProbe: lnNoAmountUsdInvoiceFeeProbe,
                                onChainTxFee: onChainTxFee,
                                onChainUsdTxFee: onChainUsdTxFee,
                                onChainUsdTxFeeAsBtcDenominated: onChainUsdTxFeeAsBtcDenominated,
                            })];
                    case 2:
                        feeResponse = _b.sent();
                        if (((_a = feeResponse.errors) === null || _a === void 0 ? void 0 : _a.length) || !feeResponse.amount) {
                            return [2 /*return*/, setFee({
                                    status: "error",
                                    amount: feeResponse.amount,
                                })];
                        }
                        return [2 /*return*/, setFee({
                                status: "set",
                                amount: feeResponse.amount,
                            })];
                    case 3:
                        err_1 = _b.sent();
                        if (err_1 instanceof Error) {
                            crashlytics().recordError(err_1);
                        }
                        return [2 /*return*/, setFee({
                                status: "error",
                            })];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        getFee();
    }, [
        getFeeFn,
        setFee,
        lnInvoiceFeeProbe,
        lnNoAmountInvoiceFeeProbe,
        lnUsdInvoiceFeeProbe,
        lnNoAmountUsdInvoiceFeeProbe,
        onChainTxFee,
        onChainUsdTxFee,
        onChainUsdTxFeeAsBtcDenominated,
    ]);
    return fee;
};
export default useFee;
var templateObject_1;
//# sourceMappingURL=use-fee.js.map