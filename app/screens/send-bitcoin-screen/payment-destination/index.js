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
import { parsePaymentDestination, PaymentType, } from "@blinkbitcoin/blink-client";
import { InvalidDestinationReason, } from "./index.types";
import { resolveIntraledgerDestination } from "./intraledger";
import { resolveLightningDestination } from "./lightning";
import { resolveLnurlDestination } from "./lnurl";
import { resolveOnchainDestination } from "./onchain";
export * from "./intraledger";
export * from "./lightning";
export * from "./lnurl";
export * from "./onchain";
export var parseDestination = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var parsedDestination;
    var rawInput = _b.rawInput, myWalletIds = _b.myWalletIds, bitcoinNetwork = _b.bitcoinNetwork, lnurlDomains = _b.lnurlDomains, accountDefaultWalletQuery = _b.accountDefaultWalletQuery, inputSource = _b.inputSource, displayCurrency = _b.displayCurrency;
    return __generator(this, function (_c) {
        parsedDestination = parsePaymentDestination({
            destination: rawInput,
            network: bitcoinNetwork,
            lnAddressDomains: lnurlDomains,
            inputSource: inputSource,
            displayCurrency: displayCurrency,
        });
        switch (parsedDestination.paymentType) {
            case PaymentType.IntraledgerWithFlag:
                return [2 /*return*/, resolveIntraledgerDestination({
                        parsedIntraledgerDestination: parsedDestination,
                        accountDefaultWalletQuery: accountDefaultWalletQuery,
                        myWalletIds: myWalletIds,
                        flag: parsedDestination.flag,
                    })];
            case PaymentType.Intraledger:
                return [2 /*return*/, resolveIntraledgerDestination({
                        parsedIntraledgerDestination: parsedDestination,
                        accountDefaultWalletQuery: accountDefaultWalletQuery,
                        myWalletIds: myWalletIds,
                    })];
            case PaymentType.Lnurl: {
                return [2 /*return*/, resolveLnurlDestination({
                        parsedLnurlDestination: parsedDestination,
                        lnurlDomains: lnurlDomains,
                        accountDefaultWalletQuery: accountDefaultWalletQuery,
                        myWalletIds: myWalletIds,
                    })];
            }
            case PaymentType.Lightning: {
                return [2 /*return*/, resolveLightningDestination(parsedDestination)];
            }
            case PaymentType.Onchain: {
                return [2 /*return*/, resolveOnchainDestination(parsedDestination)];
            }
            default: {
                return [2 /*return*/, {
                        valid: false,
                        invalidReason: InvalidDestinationReason.UnknownDestination,
                        invalidPaymentDestination: parsedDestination,
                    }];
            }
        }
        return [2 /*return*/];
    });
}); };
//# sourceMappingURL=index.js.map