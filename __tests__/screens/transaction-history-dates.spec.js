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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import React from "react";
import { InteractionManager } from "react-native";
import { cleanup, render, waitFor } from "@testing-library/react-native";
import { TransactionHistoryScreen } from "@app/screens/transaction-history";
import { TransactionListForDefaultAccountDocument, TxLastSeenDocument, } from "@app/graphql/generated";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { ContextForScreen } from "./helper";
var currentMocks = [];
var DEFAULT_ACCOUNT_ID = "account-id";
jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation(function (callback) {
    if (typeof callback === "function") {
        callback();
    }
    return {
        cancel: function () { },
    };
});
jest.mock("../../app/graphql/cache", function () {
    var actual = jest.requireActual("../../app/graphql/cache");
    return __assign(__assign({ __esModule: true }, actual), { createCache: function () {
            var cache = actual.createCache();
            cache.writeQuery({
                query: TxLastSeenDocument,
                variables: { accountId: DEFAULT_ACCOUNT_ID },
                data: {
                    __typename: "Query",
                    txLastSeen: {
                        __typename: "TxLastSeen",
                        accountId: DEFAULT_ACCOUNT_ID,
                        btcId: "",
                        usdId: "",
                    },
                },
            });
            return cache;
        } });
});
jest.mock("@app/graphql/mocks", function () {
    var actual = jest.requireActual("@app/graphql/mocks");
    return {
        __esModule: true,
        get default() {
            return __spreadArray(__spreadArray([], currentMocks, true), actual.default, true);
        },
    };
});
var BTC_WALLET_ID = "e821e124-1c70-4aab-9416-074ee5be21f6";
var USD_WALLET_ID = "5b54bf9a-46cc-4344-b638-b5e5e157a892";
var mockRouteWithCurrencyFilter = function () { return ({
    key: "transactionHistory-test",
    name: "transactionHistory",
    params: {
        wallets: [
            {
                id: BTC_WALLET_ID,
                walletCurrency: "BTC",
            },
            {
                id: USD_WALLET_ID,
                walletCurrency: "USD",
            },
        ],
    },
}); };
var buildTransactionMocks = function (edges) {
    var wallets = [
        {
            __typename: "BTCWallet",
            id: BTC_WALLET_ID,
            balance: 0,
            walletCurrency: "BTC",
        },
        {
            __typename: "UsdWallet",
            id: USD_WALLET_ID,
            balance: 0,
            walletCurrency: "USD",
        },
    ];
    var result = {
        data: {
            me: {
                __typename: "User",
                id: "user-id",
                defaultAccount: {
                    __typename: "ConsumerAccount",
                    id: DEFAULT_ACCOUNT_ID,
                    wallets: wallets,
                    pendingIncomingTransactions: [],
                    transactions: {
                        __typename: "TransactionConnection",
                        pageInfo: {
                            __typename: "PageInfo",
                            hasNextPage: false,
                            hasPreviousPage: false,
                            startCursor: "cursor-1",
                            endCursor: "cursor-1",
                        },
                        edges: edges,
                    },
                },
            },
        },
    };
    return [
        {
            request: {
                query: TransactionListForDefaultAccountDocument,
                variables: {
                    first: 21,
                    walletIds: [BTC_WALLET_ID, USD_WALLET_ID],
                },
            },
            result: result,
            maxUsageCount: Number.POSITIVE_INFINITY,
            newData: function () { return result; },
        },
    ];
};
var makeEdge = function (id, createdAt) { return ({
    __typename: "TransactionEdge",
    cursor: "cursor-".concat(id),
    node: {
        __typename: "Transaction",
        id: id,
        status: "SUCCESS",
        direction: "RECEIVE",
        memo: null,
        createdAt: createdAt,
        settlementAmount: 1000,
        settlementFee: 0,
        settlementDisplayFee: "0.00",
        settlementCurrency: "BTC",
        settlementDisplayAmount: "0.10",
        settlementDisplayCurrency: "USD",
        settlementPrice: {
            __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
            base: 105000000000,
            offset: 12,
            currencyUnit: "MINOR",
            formattedAmount: "0.105",
        },
        initiationVia: {
            __typename: "InitiationViaLn",
            paymentHash: "hash-".concat(id),
            paymentRequest: "payment-request-".concat(id),
        },
        settlementVia: {
            __typename: "SettlementViaIntraLedger",
            counterPartyWalletId: null,
            counterPartyUsername: "user-".concat(id),
            preImage: null,
        },
    },
}); };
describe("TransactionHistoryScreen date formatting", function () {
    beforeEach(function () {
        loadLocale("en");
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-20T12:00:00Z"));
    });
    afterEach(function () {
        cleanup();
        currentMocks = [];
        jest.useRealTimers();
    });
    it("shows relative dates for today/yesterday and short dates for older groups", function () { return __awaiter(void 0, void 0, void 0, function () {
        var nowSeconds, edges, screen, _a, _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    nowSeconds = Math.floor(Date.now() / 1000);
                    edges = [
                        makeEdge("tx-today-1", nowSeconds - 5),
                        makeEdge("tx-today-2", nowSeconds - 2 * 60 * 60),
                        makeEdge("tx-today-3", nowSeconds - 45 * 60),
                        makeEdge("tx-yesterday-1", nowSeconds - 18 * 60 * 60),
                        makeEdge("tx-yesterday-2", nowSeconds - 20 * 60 * 60),
                        makeEdge("tx-yesterday-3", nowSeconds - 30 * 60 * 60),
                        makeEdge("tx-older-1", Math.floor(Date.parse("2026-01-18T12:00:00Z") / 1000)),
                        makeEdge("tx-older-2", Math.floor(Date.parse("2026-01-10T12:00:00Z") / 1000)),
                        makeEdge("tx-older-3", Math.floor(Date.parse("2025-12-31T12:00:00Z") / 1000)),
                        makeEdge("tx-older-4", Math.floor(Date.parse("2025-12-01T12:00:00Z") / 1000)),
                        makeEdge("tx-older-5", Math.floor(Date.parse("2025-11-15T12:00:00Z") / 1000)),
                    ];
                    currentMocks = buildTransactionMocks(edges);
                    screen = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getAllByTestId("transaction-by-index-0").length).toBeGreaterThan(0);
                        })];
                case 1:
                    _j.sent();
                    _a = expect;
                    return [4 /*yield*/, screen.findByText("5 seconds ago")];
                case 2:
                    _a.apply(void 0, [_j.sent()]).toBeTruthy();
                    _b = expect;
                    return [4 /*yield*/, screen.findByText("45 minutes ago")];
                case 3:
                    _b.apply(void 0, [_j.sent()]).toBeTruthy();
                    _c = expect;
                    return [4 /*yield*/, screen.findByText("2 hours ago")];
                case 4:
                    _c.apply(void 0, [_j.sent()]).toBeTruthy();
                    _d = expect;
                    return [4 /*yield*/, screen.findByText("18 hours ago")];
                case 5:
                    _d.apply(void 0, [_j.sent()]).toBeTruthy();
                    _e = expect;
                    return [4 /*yield*/, screen.findByText("20 hours ago")];
                case 6:
                    _e.apply(void 0, [_j.sent()]).toBeTruthy();
                    _f = expect;
                    return [4 /*yield*/, screen.findByText("30 hours ago")];
                case 7:
                    _f.apply(void 0, [_j.sent()]).toBeTruthy();
                    _g = expect;
                    return [4 /*yield*/, screen.findByText("2026-01-18")];
                case 8:
                    _g.apply(void 0, [_j.sent()]).toBeTruthy();
                    _h = expect;
                    return [4 /*yield*/, screen.findByText("2026-01-10")];
                case 9:
                    _h.apply(void 0, [_j.sent()]).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=transaction-history-dates.spec.js.map