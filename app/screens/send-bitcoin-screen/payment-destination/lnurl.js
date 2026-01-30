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
import { getParams } from "js-lnurl";
import { requestPayServiceParams } from "lnurl-pay";
import { isPhoneNumber } from "@app/utils/phone";
import { toBtcMoneyAmount } from "@app/types/amounts";
import { PaymentType } from "@blinkbitcoin/blink-client";
import { createLnurlPaymentDetails } from "../payment-details";
import { DestinationDirection, InvalidDestinationReason, } from "./index.types";
import { resolveIntraledgerDestination } from "./intraledger";
export var resolveLnurlDestination = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var lnurlParams, lnurlPayParams, maybeIntraledgerDestination, _c;
    var parsedLnurlDestination = _b.parsedLnurlDestination, lnurlDomains = _b.lnurlDomains, accountDefaultWalletQuery = _b.accountDefaultWalletQuery, myWalletIds = _b.myWalletIds;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                if (!parsedLnurlDestination.valid) return [3 /*break*/, 8];
                return [4 /*yield*/, getParams(parsedLnurlDestination.lnurl)
                    // Check for lnurl withdraw request
                ];
            case 1:
                lnurlParams = _d.sent();
                // Check for lnurl withdraw request
                if ("tag" in lnurlParams && lnurlParams.tag === "withdrawRequest") {
                    return [2 /*return*/, createLnurlWithdrawDestination({
                            lnurl: parsedLnurlDestination.lnurl,
                            callback: lnurlParams.callback,
                            domain: lnurlParams.domain,
                            k1: lnurlParams.k1,
                            defaultDescription: lnurlParams.defaultDescription,
                            minWithdrawable: lnurlParams.minWithdrawable,
                            maxWithdrawable: lnurlParams.maxWithdrawable,
                        })];
                }
                _d.label = 2;
            case 2:
                _d.trys.push([2, 6, , 7]);
                return [4 /*yield*/, requestPayServiceParams({
                        lnUrlOrAddress: parsedLnurlDestination.lnurl,
                    })];
            case 3:
                lnurlPayParams = _d.sent();
                if (!lnurlPayParams) return [3 /*break*/, 5];
                return [4 /*yield*/, tryGetIntraLedgerDestinationFromLnurl({
                        lnurlDomains: lnurlDomains,
                        lnurlPayParams: lnurlPayParams,
                        myWalletIds: myWalletIds,
                        accountDefaultWalletQuery: accountDefaultWalletQuery,
                    })];
            case 4:
                maybeIntraledgerDestination = _d.sent();
                if (maybeIntraledgerDestination && maybeIntraledgerDestination.valid) {
                    return [2 /*return*/, maybeIntraledgerDestination];
                }
                return [2 /*return*/, createLnurlPaymentDestination(__assign({ lnurlParams: lnurlPayParams }, parsedLnurlDestination))];
            case 5: return [3 /*break*/, 7];
            case 6:
                _c = _d.sent();
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/, {
                    valid: false,
                    invalidReason: InvalidDestinationReason.LnurlUnsupported,
                    invalidPaymentDestination: parsedLnurlDestination,
                }];
            case 8: return [2 /*return*/, {
                    valid: false,
                    invalidReason: InvalidDestinationReason.LnurlError,
                    invalidPaymentDestination: parsedLnurlDestination,
                }];
        }
    });
}); };
// TODO: move to galoy-client
var tryGetIntraLedgerDestinationFromLnurl = function (_a) {
    var lnurlPayParams = _a.lnurlPayParams, lnurlDomains = _a.lnurlDomains, accountDefaultWalletQuery = _a.accountDefaultWalletQuery, myWalletIds = _a.myWalletIds;
    var intraLedgerHandleFromLnurl = getIntraLedgerHandleIfLnurlIsOurOwn({
        lnurlPayParams: lnurlPayParams,
        lnurlDomains: lnurlDomains,
    });
    if (intraLedgerHandleFromLnurl) {
        return resolveIntraledgerDestination({
            parsedIntraledgerDestination: {
                paymentType: PaymentType.Intraledger,
                handle: intraLedgerHandleFromLnurl,
                valid: true,
            },
            accountDefaultWalletQuery: accountDefaultWalletQuery,
            myWalletIds: myWalletIds,
        });
    }
    return undefined;
};
var getIntraLedgerHandleIfLnurlIsOurOwn = function (_a) {
    var lnurlPayParams = _a.lnurlPayParams, lnurlDomains = _a.lnurlDomains;
    var _b = lnurlPayParams.identifier.split("@"), username = _b[0], domain = _b[1];
    if (domain && lnurlDomains.includes(domain)) {
        if (isPhoneNumber(username))
            return undefined;
        return username;
    }
    return undefined;
};
export var createLnurlPaymentDestination = function (resolvedLnurlPaymentDestination) {
    var createPaymentDetail = function (_a) {
        var convertMoneyAmount = _a.convertMoneyAmount, sendingWalletDescriptor = _a.sendingWalletDescriptor;
        var minAmount = resolvedLnurlPaymentDestination.lnurlParams.min || 0;
        return createLnurlPaymentDetails({
            lnurl: resolvedLnurlPaymentDestination.lnurl,
            lnurlParams: resolvedLnurlPaymentDestination.lnurlParams,
            sendingWalletDescriptor: sendingWalletDescriptor,
            destinationSpecifiedMemo: resolvedLnurlPaymentDestination.lnurlParams.description,
            convertMoneyAmount: convertMoneyAmount,
            unitOfAccountAmount: toBtcMoneyAmount(minAmount),
            isMerchant: resolvedLnurlPaymentDestination.isMerchant,
        });
    };
    return {
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: resolvedLnurlPaymentDestination,
        createPaymentDetail: createPaymentDetail,
    };
};
export var createLnurlWithdrawDestination = function (params) {
    return {
        valid: true,
        destinationDirection: DestinationDirection.Receive,
        validDestination: __assign(__assign({}, params), { paymentType: PaymentType.Lnurl, valid: true }),
    };
};
//# sourceMappingURL=lnurl.js.map