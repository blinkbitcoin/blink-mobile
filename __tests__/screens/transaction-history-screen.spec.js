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
import React from "react";
import { InteractionManager } from "react-native";
import { act, fireEvent, render, waitFor, cleanup } from "@testing-library/react-native";
import { TransactionHistoryScreen } from "@app/screens/transaction-history";
import { TransactionListForDefaultAccountDocument, TxLastSeenDocument, } from "@app/graphql/generated";
import { loadLocale } from "@app/i18n/i18n-util.sync";
import { ContextForScreen } from "./helper";
var currentMocks = [];
var DEFAULT_ACCOUNT_ID = "account-id";
var currentTxLastSeen = { btcId: "", usdId: "" };
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
                        btcId: currentTxLastSeen.btcId,
                        usdId: currentTxLastSeen.usdId,
                    },
                },
            });
            return cache;
        } });
});
jest.mock("@app/graphql/mocks", function () { return ({
    __esModule: true,
    get default() {
        return currentMocks;
    },
}); });
jest.mock("@app/components/transaction-item", function () {
    var React = jest.requireActual("react");
    var Text = jest.requireActual("react-native").Text;
    var MemoizedTransactionItem = function (_a) {
        var txid = _a.txid, highlight = _a.highlight, testId = _a.testId;
        return (<Text testID={testId}>{"".concat(txid, ":").concat(highlight ? "highlight" : "no-highlight")}</Text>);
    };
    return {
        __esModule: true,
        MemoizedTransactionItem: React.memo(MemoizedTransactionItem),
    };
});
var BTC_WALLET_ID = "e821e124-1c70-4aab-9416-074ee5be21f6";
var USD_WALLET_ID = "5b54bf9a-46cc-4344-b638-b5e5e157a892";
var mockRouteWithCurrencyFilter = function (currency) { return ({
    key: "transactionHistory-test",
    name: "transactionHistory",
    params: __assign({ wallets: [
            {
                id: BTC_WALLET_ID,
                walletCurrency: "BTC",
            },
            {
                id: USD_WALLET_ID,
                walletCurrency: "USD",
            },
        ] }, (currency ? { currencyFilter: currency } : {})),
}); };
var buildTransactionMocks = function (_a) {
    var btcTxId = _a.btcTxId, usdTxId = _a.usdTxId;
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
    var btcEdge = {
        __typename: "TransactionEdge",
        cursor: "cursor-1",
        node: {
            __typename: "Transaction",
            id: btcTxId,
            status: "SUCCESS",
            direction: "RECEIVE",
            memo: null,
            createdAt: 1700000000,
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
                paymentHash: "hash-1",
                paymentRequest: "payment-request-1",
            },
            settlementVia: {
                __typename: "SettlementViaIntraLedger",
                counterPartyWalletId: null,
                counterPartyUsername: "user_btc",
                preImage: null,
            },
        },
    };
    var usdEdge = {
        __typename: "TransactionEdge",
        cursor: "cursor-2",
        node: {
            __typename: "Transaction",
            id: usdTxId,
            status: "SUCCESS",
            direction: "RECEIVE",
            memo: null,
            createdAt: 1700000001,
            settlementAmount: 1000,
            settlementFee: 0,
            settlementDisplayFee: "0.00",
            settlementCurrency: "USD",
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
                paymentHash: "hash-2",
                paymentRequest: "payment-request-2",
            },
            settlementVia: {
                __typename: "SettlementViaIntraLedger",
                counterPartyWalletId: null,
                counterPartyUsername: "user_usd",
                preImage: null,
            },
        },
    };
    var makeResult = function (edges) { return ({
        data: {
            me: {
                __typename: "User",
                id: "user-id",
                defaultAccount: {
                    __typename: "ConsumerAccount",
                    id: "account-id",
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
    }); };
    var makeRequest = function (walletIds, edges) { return ({
        request: {
            query: TransactionListForDefaultAccountDocument,
            variables: {
                first: 21,
                walletIds: walletIds,
            },
            newData: function () { return makeResult(edges); },
        },
        result: makeResult(edges),
    }); };
    return [
        makeRequest([BTC_WALLET_ID, USD_WALLET_ID], [usdEdge, btcEdge]),
        makeRequest([BTC_WALLET_ID], [btcEdge]),
        makeRequest([USD_WALLET_ID], [usdEdge]),
    ];
};
describe("TransactionHistoryScreen", function () {
    beforeEach(function () {
        loadLocale("en");
    });
    afterEach(function () {
        cleanup();
        currentMocks = [];
        currentTxLastSeen = { btcId: "", usdId: "" };
    });
    it("shows all transactions by default", function () { return __awaiter(void 0, void 0, void 0, function () {
        var findByTestId, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    currentTxLastSeen = {
                        btcId: "507f1f77bcf86cd799439010",
                        usdId: "507f1f77bcf86cd799439010",
                    };
                    currentMocks = buildTransactionMocks({
                        btcTxId: "507f1f77bcf86cd799439011",
                        usdTxId: "507f1f77bcf86cd799439012",
                    });
                    findByTestId = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()}/>
      </ContextForScreen>).findByTestId;
                    _a = expect;
                    return [4 /*yield*/, findByTestId("transaction-by-index-0")];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    it("filters only BTC transactions", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screen, dropdown, btcOption;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTxLastSeen = {
                        btcId: "507f1f77bcf86cd799439010",
                        usdId: "507f1f77bcf86cd799439010",
                    };
                    currentMocks = buildTransactionMocks({
                        btcTxId: "507f1f77bcf86cd799439011",
                        usdTxId: "507f1f77bcf86cd799439012",
                    });
                    screen = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    dropdown = screen.getByTestId("wallet-filter-dropdown");
                    return [4 /*yield*/, act(function () { return fireEvent.press(dropdown); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, screen.findByText("Bitcoin")];
                case 3:
                    btcOption = _a.sent();
                    return [4 /*yield*/, act(function () { return fireEvent.press(btcOption); })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0").props.children).toContain("507f1f77bcf86cd799439011");
                            expect(screen.queryByTestId("transaction-by-index-1")).toBeNull();
                        })];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("filters only BTC by route param", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screen;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTxLastSeen = {
                        btcId: "507f1f77bcf86cd799439010",
                        usdId: "507f1f77bcf86cd799439010",
                    };
                    currentMocks = buildTransactionMocks({
                        btcTxId: "507f1f77bcf86cd799439011",
                        usdTxId: "507f1f77bcf86cd799439012",
                    });
                    screen = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter("BTC")}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain("507f1f77bcf86cd799439011");
                    expect(screen.queryByTestId("transaction-by-index-1")).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("switches filter after BTC route param", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screen, dropdown, usdOption;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTxLastSeen = {
                        btcId: "507f1f77bcf86cd799439010",
                        usdId: "507f1f77bcf86cd799439010",
                    };
                    currentMocks = buildTransactionMocks({
                        btcTxId: "507f1f77bcf86cd799439011",
                        usdTxId: "507f1f77bcf86cd799439012",
                    });
                    screen = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter("BTC")}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    dropdown = screen.getByTestId("wallet-filter-dropdown");
                    return [4 /*yield*/, act(function () { return fireEvent.press(dropdown); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, screen.findByText("Dollar")];
                case 3:
                    usdOption = _a.sent();
                    return [4 /*yield*/, act(function () { return fireEvent.press(usdOption); })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0").props.children).toContain("507f1f77bcf86cd799439012");
                            expect(screen.queryByTestId("transaction-by-index-1")).toBeNull();
                        })];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("highlights none when lastSeen ids are missing", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screen;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTxLastSeen = { btcId: "", usdId: "" };
                    currentMocks = buildTransactionMocks({
                        btcTxId: "507f1f77bcf86cd799439011",
                        usdTxId: "507f1f77bcf86cd799439012",
                    });
                    screen = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy();
                        })];
                case 1:
                    _a.sent();
                    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain("no-highlight");
                    expect(screen.getByTestId("transaction-by-index-1").props.children).toContain("no-highlight");
                    return [2 /*return*/];
            }
        });
    }); });
    it("highlights transactions newer than min lastSeen when ALL", function () { return __awaiter(void 0, void 0, void 0, function () {
        var screen;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTxLastSeen = {
                        btcId: "507f1f77bcf86cd799439015",
                        usdId: "507f1f77bcf86cd799439025",
                    };
                    currentMocks = buildTransactionMocks({
                        btcTxId: "507f1f77bcf86cd799439030",
                        usdTxId: "507f1f77bcf86cd799439040",
                    });
                    screen = render(<ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()}/>
      </ContextForScreen>);
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy();
                        })
                        // min(lastSeenBtcId,lastSeenUsdId) = ...9015 and both are unseen => highlighted
                    ];
                case 1:
                    _a.sent();
                    // min(lastSeenBtcId,lastSeenUsdId) = ...9015 and both are unseen => highlighted
                    expect(screen.getByTestId("transaction-by-index-0").props.children).toContain("highlight");
                    expect(screen.getByTestId("transaction-by-index-1").props.children).toContain("highlight");
                    // ensure highlight doesn't flip off after `markTxSeen` updates cache
                    return [4 /*yield*/, waitFor(function () {
                            expect(screen.getByTestId("transaction-by-index-0").props.children).toContain("highlight");
                            expect(screen.getByTestId("transaction-by-index-1").props.children).toContain("highlight");
                        })];
                case 2:
                    // ensure highlight doesn't flip off after `markTxSeen` updates cache
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=transaction-history-screen.spec.js.map