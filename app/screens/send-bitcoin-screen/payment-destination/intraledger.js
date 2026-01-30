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
import { ZeroBtcMoneyAmount } from "@app/types/amounts";
import { createIntraledgerPaymentDetails } from "../payment-details";
import { DestinationDirection, InvalidDestinationReason, } from "./index.types";
export var resolveIntraledgerDestination = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var valid, handle, handleWalletId;
    var parsedIntraledgerDestination = _b.parsedIntraledgerDestination, accountDefaultWalletQuery = _b.accountDefaultWalletQuery, myWalletIds = _b.myWalletIds, flag = _b.flag;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                valid = parsedIntraledgerDestination.valid, handle = parsedIntraledgerDestination.handle;
                if (!valid) {
                    return [2 /*return*/, {
                            valid: false,
                            invalidReason: InvalidDestinationReason.WrongDomain,
                            invalidPaymentDestination: parsedIntraledgerDestination,
                        }];
                }
                return [4 /*yield*/, getUserWalletId({
                        username: handle,
                        accountDefaultWalletQuery: accountDefaultWalletQuery,
                        flag: flag,
                    })];
            case 1:
                handleWalletId = _c.sent();
                if (!handleWalletId) {
                    return [2 /*return*/, {
                            valid: false,
                            invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
                            invalidPaymentDestination: parsedIntraledgerDestination,
                        }];
                }
                if (myWalletIds.includes(handleWalletId)) {
                    return [2 /*return*/, {
                            valid: false,
                            invalidReason: InvalidDestinationReason.SelfPayment,
                            invalidPaymentDestination: parsedIntraledgerDestination,
                        }];
                }
                return [2 /*return*/, createIntraLedgerDestination({
                        parsedIntraledgerDestination: parsedIntraledgerDestination,
                        walletId: handleWalletId,
                    })];
        }
    });
}); };
export var createIntraLedgerDestination = function (params) {
    var handle = params.parsedIntraledgerDestination.handle, walletId = params.walletId;
    var createPaymentDetail = function (_a) {
        var convertMoneyAmount = _a.convertMoneyAmount, sendingWalletDescriptor = _a.sendingWalletDescriptor;
        return createIntraledgerPaymentDetails({
            handle: handle,
            recipientWalletId: walletId,
            sendingWalletDescriptor: sendingWalletDescriptor,
            convertMoneyAmount: convertMoneyAmount,
            unitOfAccountAmount: ZeroBtcMoneyAmount,
        });
    };
    return {
        valid: true,
        createPaymentDetail: createPaymentDetail,
        destinationDirection: DestinationDirection.Send,
        validDestination: __assign(__assign({}, params.parsedIntraledgerDestination), { walletId: walletId, valid: true }),
    };
};
var getUserWalletId = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var data_1, data;
    var _c, _d;
    var flag = _b.flag, username = _b.username, accountDefaultWalletQuery = _b.accountDefaultWalletQuery;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                if (!((flag === null || flag === void 0 ? void 0 : flag.toUpperCase()) === "USD")) return [3 /*break*/, 2];
                return [4 /*yield*/, accountDefaultWalletQuery({
                        variables: { username: username, walletCurrency: "USD" },
                    })];
            case 1:
                data_1 = (_e.sent()).data;
                return [2 /*return*/, (_c = data_1 === null || data_1 === void 0 ? void 0 : data_1.accountDefaultWallet) === null || _c === void 0 ? void 0 : _c.id];
            case 2: return [4 /*yield*/, accountDefaultWalletQuery({ variables: { username: username } })];
            case 3:
                data = (_e.sent()).data;
                return [2 /*return*/, (_d = data === null || data === void 0 ? void 0 : data.accountDefaultWallet) === null || _d === void 0 ? void 0 : _d.id];
        }
    });
}); };
//# sourceMappingURL=intraledger.js.map