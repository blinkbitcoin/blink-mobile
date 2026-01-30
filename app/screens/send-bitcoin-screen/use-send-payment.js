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
import { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { gql } from "@apollo/client";
import { HomeAuthedDocument, PaymentSendResult, useIntraLedgerPaymentSendMutation, useIntraLedgerUsdPaymentSendMutation, useLnInvoicePaymentSendMutation, useLnNoAmountInvoicePaymentSendMutation, useLnNoAmountUsdInvoicePaymentSendMutation, useOnChainPaymentSendMutation, useOnChainPaymentSendAllMutation, useOnChainUsdPaymentSendAsBtcDenominatedMutation, useOnChainUsdPaymentSendMutation, } from "@app/graphql/generated";
import { getErrorMessages } from "@app/graphql/utils";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation intraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {\n    intraLedgerPaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation intraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {\n    intraLedgerUsdPaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {\n    lnNoAmountInvoicePaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {\n    lnInvoicePaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n        settlementVia {\n          ... on SettlementViaLn {\n            preImage\n          }\n          ... on SettlementViaIntraLedger {\n            preImage\n          }\n        }\n      }\n    }\n  }\n\n  mutation lnNoAmountUsdInvoicePaymentSend($input: LnNoAmountUsdInvoicePaymentInput!) {\n    lnNoAmountUsdInvoicePaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation onChainPaymentSend($input: OnChainPaymentSendInput!) {\n    onChainPaymentSend(input: $input) {\n      transaction {\n        createdAt\n        settlementVia {\n          ... on SettlementViaOnChain {\n            arrivalInMempoolEstimatedAt\n          }\n        }\n      }\n      errors {\n        message\n      }\n      status\n    }\n  }\n\n  mutation onChainPaymentSendAll($input: OnChainPaymentSendAllInput!) {\n    onChainPaymentSendAll(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation onChainUsdPaymentSend($input: OnChainUsdPaymentSendInput!) {\n    onChainUsdPaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation onChainUsdPaymentSendAsBtcDenominated(\n    $input: OnChainUsdPaymentSendAsBtcDenominatedInput!\n  ) {\n    onChainUsdPaymentSendAsBtcDenominated(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n"], ["\n  mutation intraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {\n    intraLedgerPaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation intraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {\n    intraLedgerUsdPaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation lnNoAmountInvoicePaymentSend($input: LnNoAmountInvoicePaymentInput!) {\n    lnNoAmountInvoicePaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {\n    lnInvoicePaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n        settlementVia {\n          ... on SettlementViaLn {\n            preImage\n          }\n          ... on SettlementViaIntraLedger {\n            preImage\n          }\n        }\n      }\n    }\n  }\n\n  mutation lnNoAmountUsdInvoicePaymentSend($input: LnNoAmountUsdInvoicePaymentInput!) {\n    lnNoAmountUsdInvoicePaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation onChainPaymentSend($input: OnChainPaymentSendInput!) {\n    onChainPaymentSend(input: $input) {\n      transaction {\n        createdAt\n        settlementVia {\n          ... on SettlementViaOnChain {\n            arrivalInMempoolEstimatedAt\n          }\n        }\n      }\n      errors {\n        message\n      }\n      status\n    }\n  }\n\n  mutation onChainPaymentSendAll($input: OnChainPaymentSendAllInput!) {\n    onChainPaymentSendAll(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation onChainUsdPaymentSend($input: OnChainUsdPaymentSendInput!) {\n    onChainUsdPaymentSend(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n\n  mutation onChainUsdPaymentSendAsBtcDenominated(\n    $input: OnChainUsdPaymentSendAsBtcDenominatedInput!\n  ) {\n    onChainUsdPaymentSendAsBtcDenominated(input: $input) {\n      errors {\n        message\n      }\n      status\n      transaction {\n        createdAt\n      }\n    }\n  }\n"])));
var useGetUuid = function () {
    var randomUuid = useMemo(function () {
        var randomBytes = Array.from({ length: 16 }, function () { return Math.floor(Math.random() * 256); });
        return uuidv4({ random: randomBytes });
    }, []);
    return randomUuid;
};
export var useSendPayment = function (sendPaymentMutation) {
    var idempotencyKey = useGetUuid();
    var options = {
        refetchQueries: [HomeAuthedDocument],
        context: { headers: { "X-Idempotency-Key": idempotencyKey } },
    };
    var _a = useIntraLedgerPaymentSendMutation(options), intraLedgerPaymentSend = _a[0], intraLedgerPaymentSendLoading = _a[1].loading;
    var _b = useIntraLedgerUsdPaymentSendMutation(options), intraLedgerUsdPaymentSend = _b[0], intraLedgerUsdPaymentSendLoading = _b[1].loading;
    var _c = useLnInvoicePaymentSendMutation(options), lnInvoicePaymentSend = _c[0], lnInvoicePaymentSendLoading = _c[1].loading;
    var _d = useLnNoAmountInvoicePaymentSendMutation(options), lnNoAmountInvoicePaymentSend = _d[0], lnNoAmountInvoicePaymentSendLoading = _d[1].loading;
    var _e = useLnNoAmountUsdInvoicePaymentSendMutation(options), lnNoAmountUsdInvoicePaymentSend = _e[0], lnNoAmountUsdInvoicePaymentSendLoading = _e[1].loading;
    var _f = useOnChainPaymentSendMutation(options), onChainPaymentSend = _f[0], onChainPaymentSendLoading = _f[1].loading;
    var _g = useOnChainPaymentSendAllMutation(options), onChainPaymentSendAll = _g[0], onChainPaymentSendAllLoading = _g[1].loading;
    var _h = useOnChainUsdPaymentSendMutation(options), onChainUsdPaymentSend = _h[0], onChainUsdPaymentSendLoading = _h[1].loading;
    var _j = useOnChainUsdPaymentSendAsBtcDenominatedMutation(options), onChainUsdPaymentSendAsBtcDenominated = _j[0], onChainUsdPaymentSendAsBtcDenominatedLoading = _j[1].loading;
    var _k = useState(false), hasAttemptedSend = _k[0], setHasAttemptedSend = _k[1];
    var loading = intraLedgerPaymentSendLoading ||
        intraLedgerUsdPaymentSendLoading ||
        lnInvoicePaymentSendLoading ||
        lnNoAmountInvoicePaymentSendLoading ||
        lnNoAmountUsdInvoicePaymentSendLoading ||
        onChainPaymentSendLoading ||
        onChainPaymentSendAllLoading ||
        onChainUsdPaymentSendLoading ||
        onChainUsdPaymentSendAsBtcDenominatedLoading;
    var sendPayment = useMemo(function () {
        return sendPaymentMutation && !hasAttemptedSend
            ? function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, status, errors, extraInfo, transaction, errorsMessage;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            setHasAttemptedSend(true);
                            return [4 /*yield*/, sendPaymentMutation({
                                    intraLedgerPaymentSend: intraLedgerPaymentSend,
                                    intraLedgerUsdPaymentSend: intraLedgerUsdPaymentSend,
                                    lnInvoicePaymentSend: lnInvoicePaymentSend,
                                    lnNoAmountInvoicePaymentSend: lnNoAmountInvoicePaymentSend,
                                    lnNoAmountUsdInvoicePaymentSend: lnNoAmountUsdInvoicePaymentSend,
                                    onChainPaymentSend: onChainPaymentSend,
                                    onChainPaymentSendAll: onChainPaymentSendAll,
                                    onChainUsdPaymentSend: onChainUsdPaymentSend,
                                    onChainUsdPaymentSendAsBtcDenominated: onChainUsdPaymentSendAsBtcDenominated,
                                })];
                        case 1:
                            _a = _b.sent(), status = _a.status, errors = _a.errors, extraInfo = _a.extraInfo, transaction = _a.transaction;
                            errorsMessage = undefined;
                            if (errors) {
                                errorsMessage = getErrorMessages(errors);
                            }
                            if (status === PaymentSendResult.Failure) {
                                setHasAttemptedSend(false);
                            }
                            return [2 /*return*/, { status: status, errorsMessage: errorsMessage, extraInfo: extraInfo, transaction: transaction }];
                    }
                });
            }); }
            : undefined;
    }, [
        hasAttemptedSend,
        sendPaymentMutation,
        intraLedgerPaymentSend,
        intraLedgerUsdPaymentSend,
        lnInvoicePaymentSend,
        lnNoAmountInvoicePaymentSend,
        lnNoAmountUsdInvoicePaymentSend,
        onChainPaymentSend,
        onChainPaymentSendAll,
        onChainUsdPaymentSend,
        onChainUsdPaymentSendAsBtcDenominated,
    ]);
    return {
        hasAttemptedSend: hasAttemptedSend,
        loading: loading,
        sendPayment: sendPayment,
    };
};
var templateObject_1;
//# sourceMappingURL=use-send-payment.js.map