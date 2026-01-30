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
import { Invoice, PaymentRequestState, } from "@app/screens/receive-bitcoin-screen/payment/index.types";
import { createPaymentRequest } from "@app/screens/receive-bitcoin-screen/payment/payment-request";
import { createPaymentRequestCreationData } from "@app/screens/receive-bitcoin-screen/payment/payment-request-creation-data";
import { toUsdMoneyAmount } from "@app/types/amounts";
import { btcWalletDescriptor, defaultParams, usdWalletDescriptor } from "./helpers";
var usdAmountInvoice = "lnbc49100n1p3l2q6cpp5y8lc3dv7qnplxhc3z9j0sap4n0hu99g39tl3srx6zj0hrqy2snwsdqqcqzpuxqzfvsp5q6t5f3xeruu4k5sk5nlmxx2kzlw2pydmmjk9g4qqmsc9c6ffzldq9qyyssq9lesnumasvvlvwc7yckvuepklttlvwhjqw3539qqqttsyh5s5j246spy9gezng7ng3d40qsrn6dhsrgs7rccaftzulx5auqqd5lz0psqfskeg4";
var noAmountInvoice = "lnbc1p3l2qmfpp5t2ne20k97f3n24el9a792fte4q6n7jqr6x8qjjnklgktrdvpqq2sdqqcqzpuxqyz5vqsp5n23d3as4jxvpaemnsnvyynlpsg6pzsmxhn3tcwxealcyh6566nys9qyyssqce802uft9d44llekxqedzufkeaq7anldzpf64s4hmskwd9h5ppe4xrgq4dpq8rc3ph048066wgexjtgw4fs8032xwuazw9kdjcq8ujgpdk07ht";
var btcAmountInvoice = "lnbc23690n1p3l2qugpp5jeflfqjpxhe0hg3tzttc325j5l6czs9vq9zqx5edpt0yf7k6cypsdqqcqzpuxqyz5vqsp5lteanmnwddszwut839etrgjenfr3dv5tnvz2d2ww2mvggq7zn46q9qyyssqzcz0rvt7r30q7jul79xqqwpr4k2e8mgd23fkjm422sdgpndwql93d4wh3lap9yfwahue9n7ju80ynkqly0lrqqd2978dr8srkrlrjvcq2v5s6k";
var mockOnChainAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
// Manually created mock objects
var mockLnInvoice = {
    __typename: "LnInvoice",
    paymentRequest: btcAmountInvoice,
    // Add other necessary properties here
};
var mockLnUsdInvoice = {
    __typename: "LnInvoice",
    paymentRequest: usdAmountInvoice,
    // Add other necessary properties here
};
var mockLnNoAmountInvoice = {
    __typename: "LnInvoice",
    paymentRequest: noAmountInvoice,
    // Add other necessary properties here
};
var mockLnInvoiceCreate = jest.fn(function () {
    return Promise.resolve({
        data: {
            __typename: "Mutation", // Correct placement according to your schema
            lnInvoiceCreate: {
                __typename: "LnInvoicePayload",
                invoice: mockLnInvoice,
                errors: [],
            },
        },
        errors: [],
    });
});
var mockLnUsdInvoiceCreate = jest.fn(function () {
    return Promise.resolve({
        data: {
            __typename: "Mutation", // Correct placement according to your schema
            lnUsdInvoiceCreate: {
                __typename: "LnInvoicePayload",
                invoice: mockLnUsdInvoice,
                errors: [],
            },
        },
        errors: [],
    });
});
var mockLnNoAmountInvoiceCreate = jest.fn(function () {
    return Promise.resolve({
        data: {
            __typename: "Mutation", // Correct placement according to your schema
            lnNoAmountInvoiceCreate: {
                __typename: "LnNoAmountInvoicePayload",
                invoice: mockLnNoAmountInvoice,
                errors: [],
            },
        },
        errors: [],
    });
});
var mockOnChainAddressCurrent = jest.fn(function () {
    return Promise.resolve({
        data: {
            __typename: "Mutation", // Correct placement according to your schema
            onChainAddressCurrent: {
                __typename: "OnChainAddressPayload",
                address: mockOnChainAddress,
                errors: [],
            },
        },
        errors: [],
    });
});
export var mutations = {
    // eslint-disable-next-line
    // @ts-ignore type mismatch, but we don't care because it's a mock
    lnInvoiceCreate: mockLnInvoiceCreate,
    // eslint-disable-next-line
    // @ts-ignore type mismatch, but we don't care because it's a mock
    lnUsdInvoiceCreate: mockLnUsdInvoiceCreate,
    // eslint-disable-next-line
    // @ts-ignore type mismatch, but we don't care because it's a mock
    lnNoAmountInvoiceCreate: mockLnNoAmountInvoiceCreate,
    // eslint-disable-next-line
    // @ts-ignore type mismatch, but we don't care because it's a mock
    onChainAddressCurrent: mockOnChainAddressCurrent,
};
export var clearMocks = function () {
    mockLnInvoiceCreate.mockClear();
    mockLnUsdInvoiceCreate.mockClear();
    mockLnNoAmountInvoiceCreate.mockClear();
    mockOnChainAddressCurrent.mockClear();
};
describe("payment request", function () {
    it("ln with btc receiving wallet", function () { return __awaiter(void 0, void 0, void 0, function () {
        var prcd, pr, prNew;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { receivingWalletDescriptor: btcWalletDescriptor }));
                    pr = createPaymentRequest({ creationData: prcd, mutations: mutations });
                    expect(pr.info).toBeUndefined();
                    expect(pr.state).toBe(PaymentRequestState.Idle);
                    return [4 /*yield*/, pr.generateRequest()];
                case 1:
                    prNew = _e.sent();
                    expect(prNew.info).not.toBeUndefined();
                    expect(mockLnNoAmountInvoiceCreate).toHaveBeenCalled();
                    expect(prNew.state).toBe(PaymentRequestState.Created);
                    expect((_b = (_a = prNew.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType).toBe(Invoice.Lightning);
                    expect((_d = (_c = prNew.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.getFullUriFn({})).toBe(noAmountInvoice);
                    return [2 /*return*/];
            }
        });
    }); });
    it("ln with usd receiving wallet", function () { return __awaiter(void 0, void 0, void 0, function () {
        var prcd, pr, prNew;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { receivingWalletDescriptor: usdWalletDescriptor }));
                    pr = createPaymentRequest({ creationData: prcd, mutations: mutations });
                    expect(pr.info).toBeUndefined();
                    expect(pr.state).toBe(PaymentRequestState.Idle);
                    return [4 /*yield*/, pr.generateRequest()];
                case 1:
                    prNew = _e.sent();
                    expect(prNew.info).not.toBeUndefined();
                    expect(mockLnNoAmountInvoiceCreate).toHaveBeenCalled();
                    expect(prNew.state).toBe(PaymentRequestState.Created);
                    expect((_b = (_a = prNew.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType).toBe(Invoice.Lightning);
                    expect((_d = (_c = prNew.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.getFullUriFn({})).toBe(noAmountInvoice);
                    return [2 /*return*/];
            }
        });
    }); });
    it("ln with btc receiving wallet - set amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        var prcd, pr, prNew;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { receivingWalletDescriptor: btcWalletDescriptor, unitOfAccountAmount: toUsdMoneyAmount(1) }));
                    pr = createPaymentRequest({ creationData: prcd, mutations: mutations });
                    expect(pr.info).toBeUndefined();
                    expect(pr.state).toBe(PaymentRequestState.Idle);
                    return [4 /*yield*/, pr.generateRequest()];
                case 1:
                    prNew = _e.sent();
                    expect(prNew.info).not.toBeUndefined();
                    expect(mockLnInvoiceCreate).toHaveBeenCalled();
                    expect(prNew.state).toBe(PaymentRequestState.Created);
                    expect((_b = (_a = prNew.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType).toBe(Invoice.Lightning);
                    expect((_d = (_c = prNew.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.getFullUriFn({})).toBe(btcAmountInvoice);
                    return [2 /*return*/];
            }
        });
    }); });
    it("ln with usd receiving wallet - set amount", function () { return __awaiter(void 0, void 0, void 0, function () {
        var prcd, pr, prNew;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { receivingWalletDescriptor: usdWalletDescriptor, unitOfAccountAmount: toUsdMoneyAmount(1) }));
                    pr = createPaymentRequest({ creationData: prcd, mutations: mutations });
                    expect(pr.info).toBeUndefined();
                    expect(pr.state).toBe(PaymentRequestState.Idle);
                    return [4 /*yield*/, pr.generateRequest()];
                case 1:
                    prNew = _e.sent();
                    expect(prNew.info).not.toBeUndefined();
                    expect(mockLnUsdInvoiceCreate).toHaveBeenCalled();
                    expect(prNew.state).toBe(PaymentRequestState.Created);
                    expect((_b = (_a = prNew.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType).toBe(Invoice.Lightning);
                    expect((_d = (_c = prNew.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.getFullUriFn({})).toBe(usdAmountInvoice);
                    return [2 /*return*/];
            }
        });
    }); });
    it("paycode/lnurl", function () { return __awaiter(void 0, void 0, void 0, function () {
        var prcd, pr, prNew;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.PayCode, username: "username", posUrl: "posUrl" }));
                    pr = createPaymentRequest({ creationData: prcd, mutations: mutations });
                    expect(pr.info).toBeUndefined();
                    expect(pr.state).toBe(PaymentRequestState.Idle);
                    return [4 /*yield*/, pr.generateRequest()];
                case 1:
                    prNew = _e.sent();
                    expect(prNew.info).not.toBeUndefined();
                    expect(prNew.state).toBe(PaymentRequestState.Created);
                    expect((_b = (_a = prNew.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType).toBe(Invoice.PayCode);
                    expect((_d = (_c = prNew.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.getFullUriFn({})).toBe("LNURL1WPHHX4TJDSHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9A6HXETJDESK6EG3S7SZA");
                    return [2 /*return*/];
            }
        });
    }); });
    it("onchain", function () { return __awaiter(void 0, void 0, void 0, function () {
        var prcd, pr, prNew;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prcd = createPaymentRequestCreationData(__assign(__assign({}, defaultParams), { type: Invoice.OnChain }));
                    pr = createPaymentRequest({ creationData: prcd, mutations: mutations });
                    expect(pr.info).toBeUndefined();
                    expect(pr.state).toBe(PaymentRequestState.Idle);
                    return [4 /*yield*/, pr.generateRequest()];
                case 1:
                    prNew = _e.sent();
                    expect(prNew.info).not.toBeUndefined();
                    expect(mockOnChainAddressCurrent).toHaveBeenCalled();
                    expect(prNew.state).toBe(PaymentRequestState.Created);
                    expect((_b = (_a = prNew.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType).toBe(Invoice.OnChain);
                    expect((_d = (_c = prNew.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.getFullUriFn({}).startsWith("bitcoin:".concat(mockOnChainAddress))).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=payment-request.spec.js.map