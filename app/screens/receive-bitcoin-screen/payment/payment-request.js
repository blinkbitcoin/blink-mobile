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
import { bech32 } from "bech32";
import { WalletCurrency } from "@app/graphql/generated";
import { getPaymentRequestFullUri, prToDateString } from "./helpers";
import { Invoice, PaymentRequestState, } from "./index.types";
export var createPaymentRequest = function (params) {
    var state = params.state, info = params.info;
    if (!state)
        state = PaymentRequestState.Idle;
    var setState = function (state) {
        if (state === PaymentRequestState.Loading)
            return createPaymentRequest(__assign(__assign({}, params), { state: state, info: undefined }));
        return createPaymentRequest(__assign(__assign({}, params), { state: state }));
    };
    // The hook should setState(Loading) before calling this
    var generateQuote = function () { return __awaiter(void 0, void 0, void 0, function () {
        var creationData, mutations, pr, info, _a, data, errors, address_1, getFullUriFn, getCopyableInvoiceFn, _b, data_1, errors, dateString, getFullUriFn_1, getCopyableInvoiceFn, _c, data_2, errors, dateString, getFullUriFn_2, getCopyableInvoiceFn, _d, data_3, errors, dateString, getFullUriFn_3, getCopyableInvoiceFn, queryStringForAmount_1, lnurl_1, getFullUriFn, getCopyableInvoiceFn, state;
        var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
        return __generator(this, function (_0) {
            switch (_0.label) {
                case 0:
                    creationData = params.creationData, mutations = params.mutations;
                    pr = __assign({}, creationData);
                    // Default memo
                    if (!pr.memo)
                        pr.memo = "Pay to Blink Wallet User";
                    if (!(pr.type === Invoice.OnChain)) return [3 /*break*/, 2];
                    return [4 /*yield*/, mutations.onChainAddressCurrent({
                            variables: { input: { walletId: pr.receivingWalletDescriptor.id } },
                        })];
                case 1:
                    _a = _0.sent(), data = _a.data, errors = _a.errors;
                    if (pr.settlementAmount && pr.settlementAmount.currency !== WalletCurrency.Btc)
                        throw new Error("Onchain invoices only support BTC");
                    address_1 = ((_e = data === null || data === void 0 ? void 0 : data.onChainAddressCurrent) === null || _e === void 0 ? void 0 : _e.address) || undefined;
                    getFullUriFn = function (_a) {
                        var _b;
                        var uppercase = _a.uppercase, prefix = _a.prefix;
                        return getPaymentRequestFullUri({
                            type: Invoice.OnChain,
                            input: address_1 || "",
                            amount: (_b = pr.settlementAmount) === null || _b === void 0 ? void 0 : _b.amount,
                            memo: pr.memo,
                            uppercase: uppercase,
                            prefix: prefix,
                        });
                    };
                    getCopyableInvoiceFn = function () { return address_1 || ""; };
                    info = {
                        data: address_1
                            ? {
                                invoiceType: Invoice.OnChain,
                                getFullUriFn: getFullUriFn,
                                getCopyableInvoiceFn: getCopyableInvoiceFn,
                                address: address_1,
                                amount: pr.settlementAmount,
                                memo: pr.memo,
                            }
                            : undefined,
                        applicationErrors: (_f = data === null || data === void 0 ? void 0 : data.onChainAddressCurrent) === null || _f === void 0 ? void 0 : _f.errors,
                        gqlErrors: errors,
                    };
                    return [3 /*break*/, 12];
                case 2:
                    if (!(pr.type === Invoice.Lightning &&
                        (pr.settlementAmount === undefined || pr.settlementAmount.amount === 0))) return [3 /*break*/, 4];
                    return [4 /*yield*/, mutations.lnNoAmountInvoiceCreate({
                            variables: {
                                input: {
                                    walletId: pr.receivingWalletDescriptor.id,
                                    memo: pr.memo,
                                    expiresIn: (_g = pr.expirationTime) === null || _g === void 0 ? void 0 : _g.toString(),
                                },
                            },
                        })];
                case 3:
                    _b = _0.sent(), data_1 = _b.data, errors = _b.errors;
                    dateString = prToDateString((_j = (_h = data_1 === null || data_1 === void 0 ? void 0 : data_1.lnNoAmountInvoiceCreate.invoice) === null || _h === void 0 ? void 0 : _h.paymentRequest) !== null && _j !== void 0 ? _j : "", pr.network);
                    getFullUriFn_1 = function (_a) {
                        var _b, _c;
                        var uppercase = _a.uppercase, prefix = _a.prefix;
                        return getPaymentRequestFullUri({
                            type: Invoice.Lightning,
                            input: ((_b = data_1 === null || data_1 === void 0 ? void 0 : data_1.lnNoAmountInvoiceCreate.invoice) === null || _b === void 0 ? void 0 : _b.paymentRequest) || "",
                            amount: (_c = pr.settlementAmount) === null || _c === void 0 ? void 0 : _c.amount,
                            memo: pr.memo,
                            uppercase: uppercase,
                            prefix: prefix,
                        });
                    };
                    getCopyableInvoiceFn = function () { return getFullUriFn_1({}); };
                    info = {
                        data: (data_1 === null || data_1 === void 0 ? void 0 : data_1.lnNoAmountInvoiceCreate.invoice)
                            ? __assign(__assign({ invoiceType: Invoice.Lightning }, data_1 === null || data_1 === void 0 ? void 0 : data_1.lnNoAmountInvoiceCreate.invoice), { expiresAt: dateString ? new Date(dateString) : undefined, getCopyableInvoiceFn: getCopyableInvoiceFn, getFullUriFn: getFullUriFn_1 }) : undefined,
                        applicationErrors: (_k = data_1 === null || data_1 === void 0 ? void 0 : data_1.lnNoAmountInvoiceCreate) === null || _k === void 0 ? void 0 : _k.errors,
                        gqlErrors: errors,
                    };
                    return [3 /*break*/, 12];
                case 4:
                    if (!(pr.type === Invoice.Lightning &&
                        pr.settlementAmount &&
                        ((_l = pr.settlementAmount) === null || _l === void 0 ? void 0 : _l.currency) === WalletCurrency.Btc)) return [3 /*break*/, 6];
                    return [4 /*yield*/, mutations.lnInvoiceCreate({
                            variables: {
                                input: {
                                    walletId: pr.receivingWalletDescriptor.id,
                                    amount: pr.settlementAmount.amount,
                                    memo: pr.memo,
                                    expiresIn: (_m = pr.expirationTime) === null || _m === void 0 ? void 0 : _m.toString(),
                                },
                            },
                        })];
                case 5:
                    _c = _0.sent(), data_2 = _c.data, errors = _c.errors;
                    dateString = prToDateString((_p = (_o = data_2 === null || data_2 === void 0 ? void 0 : data_2.lnInvoiceCreate.invoice) === null || _o === void 0 ? void 0 : _o.paymentRequest) !== null && _p !== void 0 ? _p : "", pr.network);
                    getFullUriFn_2 = function (_a) {
                        var _b, _c;
                        var uppercase = _a.uppercase, prefix = _a.prefix;
                        return getPaymentRequestFullUri({
                            type: Invoice.Lightning,
                            input: ((_b = data_2 === null || data_2 === void 0 ? void 0 : data_2.lnInvoiceCreate.invoice) === null || _b === void 0 ? void 0 : _b.paymentRequest) || "",
                            amount: (_c = pr.settlementAmount) === null || _c === void 0 ? void 0 : _c.amount,
                            memo: pr.memo,
                            uppercase: uppercase,
                            prefix: prefix,
                        });
                    };
                    getCopyableInvoiceFn = function () { return getFullUriFn_2({}); };
                    info = {
                        data: (data_2 === null || data_2 === void 0 ? void 0 : data_2.lnInvoiceCreate.invoice)
                            ? __assign(__assign({ invoiceType: Invoice.Lightning }, data_2 === null || data_2 === void 0 ? void 0 : data_2.lnInvoiceCreate.invoice), { expiresAt: dateString ? new Date(dateString) : undefined, getCopyableInvoiceFn: getCopyableInvoiceFn, getFullUriFn: getFullUriFn_2 }) : undefined,
                        applicationErrors: (_q = data_2 === null || data_2 === void 0 ? void 0 : data_2.lnInvoiceCreate) === null || _q === void 0 ? void 0 : _q.errors,
                        gqlErrors: errors,
                    };
                    return [3 /*break*/, 12];
                case 6:
                    if (!(pr.type === Invoice.Lightning &&
                        pr.settlementAmount &&
                        ((_r = pr.settlementAmount) === null || _r === void 0 ? void 0 : _r.currency) === WalletCurrency.Usd)) return [3 /*break*/, 8];
                    return [4 /*yield*/, mutations.lnUsdInvoiceCreate({
                            variables: {
                                input: {
                                    walletId: pr.receivingWalletDescriptor.id,
                                    amount: pr.settlementAmount.amount,
                                    memo: pr.memo,
                                    expiresIn: (_s = pr.expirationTime) === null || _s === void 0 ? void 0 : _s.toString(),
                                },
                            },
                        })];
                case 7:
                    _d = _0.sent(), data_3 = _d.data, errors = _d.errors;
                    dateString = prToDateString((_u = (_t = data_3 === null || data_3 === void 0 ? void 0 : data_3.lnUsdInvoiceCreate.invoice) === null || _t === void 0 ? void 0 : _t.paymentRequest) !== null && _u !== void 0 ? _u : "", pr.network);
                    getFullUriFn_3 = function (_a) {
                        var _b, _c;
                        var uppercase = _a.uppercase, prefix = _a.prefix;
                        return getPaymentRequestFullUri({
                            type: Invoice.Lightning,
                            input: ((_b = data_3 === null || data_3 === void 0 ? void 0 : data_3.lnUsdInvoiceCreate.invoice) === null || _b === void 0 ? void 0 : _b.paymentRequest) || "",
                            amount: (_c = pr.settlementAmount) === null || _c === void 0 ? void 0 : _c.amount,
                            memo: pr.memo,
                            uppercase: uppercase,
                            prefix: prefix,
                        });
                    };
                    getCopyableInvoiceFn = function () { return getFullUriFn_3({}); };
                    info = {
                        data: (data_3 === null || data_3 === void 0 ? void 0 : data_3.lnUsdInvoiceCreate.invoice)
                            ? __assign(__assign({ invoiceType: Invoice.Lightning }, data_3 === null || data_3 === void 0 ? void 0 : data_3.lnUsdInvoiceCreate.invoice), { expiresAt: dateString ? new Date(dateString) : undefined, getCopyableInvoiceFn: getCopyableInvoiceFn, getFullUriFn: getFullUriFn_3 }) : undefined,
                        applicationErrors: (_v = data_3 === null || data_3 === void 0 ? void 0 : data_3.lnUsdInvoiceCreate) === null || _v === void 0 ? void 0 : _v.errors,
                        gqlErrors: errors,
                    };
                    return [3 /*break*/, 12];
                case 8:
                    if (!(pr.type === Invoice.PayCode && pr.username)) return [3 /*break*/, 11];
                    queryStringForAmount_1 = pr.unitOfAccountAmount === undefined || pr.unitOfAccountAmount.amount === 0
                        ? ""
                        : "amount=".concat((_w = pr.unitOfAccountAmount) === null || _w === void 0 ? void 0 : _w.amount, "&currency=").concat((_x = pr.unitOfAccountAmount) === null || _x === void 0 ? void 0 : _x.currencyCode);
                    return [4 /*yield*/, new Promise(function (resolve) {
                            resolve(bech32.encode("lnurl", bech32.toWords(Buffer.from("".concat(pr.posUrl, "/.well-known/lnurlp/").concat(pr.username).concat(queryStringForAmount_1 ? "?".concat(queryStringForAmount_1) : ""), "utf8")), 1500));
                        })
                        // To make the page render at loading state
                        // (otherwise jittery because encode takes ~10ms on slower phones)
                    ];
                case 9:
                    lnurl_1 = _0.sent();
                    // To make the page render at loading state
                    // (otherwise jittery because encode takes ~10ms on slower phones)
                    return [4 /*yield*/, new Promise(function (r) {
                            setTimeout(r, 50);
                        })];
                case 10:
                    // To make the page render at loading state
                    // (otherwise jittery because encode takes ~10ms on slower phones)
                    _0.sent();
                    getFullUriFn = function (_a) {
                        var uppercase = _a.uppercase, prefix = _a.prefix;
                        return getPaymentRequestFullUri({
                            type: Invoice.PayCode,
                            input: lnurl_1.toUpperCase(),
                            uppercase: uppercase,
                            prefix: prefix,
                        });
                    };
                    getCopyableInvoiceFn = function () {
                        return "".concat(pr.username, "@").concat(pr.lnAddressHostname);
                    };
                    info = {
                        data: {
                            invoiceType: Invoice.PayCode,
                            username: pr.username,
                            getCopyableInvoiceFn: getCopyableInvoiceFn,
                            getFullUriFn: getFullUriFn,
                        },
                        applicationErrors: undefined,
                        gqlErrors: undefined,
                    };
                    return [3 /*break*/, 12];
                case 11:
                    if (pr.type === Invoice.PayCode && !pr.username) {
                        // Can't create paycode payment request for a user with no username set so info will be empty
                        return [2 /*return*/, createPaymentRequest(__assign(__assign({}, params), { state: PaymentRequestState.Created, info: undefined }))];
                    }
                    else {
                        info = undefined;
                        console.log(JSON.stringify({ pr: pr }, null, 2));
                        throw new Error("Unknown Payment Request Type Encountered - Please Report");
                    }
                    _0.label = 12;
                case 12:
                    state = PaymentRequestState.Created;
                    if (!info || ((_y = info.applicationErrors) === null || _y === void 0 ? void 0 : _y.length) || ((_z = info.gqlErrors) === null || _z === void 0 ? void 0 : _z.length) || !info.data) {
                        state = PaymentRequestState.Error;
                    }
                    return [2 /*return*/, createPaymentRequest(__assign(__assign({}, params), { info: info, state: state }))];
            }
        });
    }); };
    return __assign(__assign({}, params), { state: state, info: info, generateRequest: generateQuote, setState: setState });
};
//# sourceMappingURL=payment-request.js.map