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
import { act, renderHook } from "@testing-library/react-hooks";
jest.mock("@apollo/client", function () {
    var actual = jest.requireActual("@apollo/client");
    return __assign(__assign({}, actual), { useApolloClient: jest.fn(), gql: jest.fn(function (literals) {
            var placeholders = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                placeholders[_i - 1] = arguments[_i];
            }
            return literals.reduce(function (result, literal, index) { return result + literal + (placeholders[index] || ""); }, "");
        }) });
});
jest.mock("@app/graphql/generated", function () {
    var actual = jest.requireActual("@app/graphql/generated");
    return __assign(__assign({}, actual), { useTxLastSeenQuery: jest.fn() });
});
jest.mock("@app/graphql/client-only-query", function () { return ({
    markTxLastSeenId: jest.fn(),
}); });
import { useTransactionSeenState } from "@app/hooks/use-transaction-seen-state";
import { useApolloClient } from "@apollo/client";
import { TxDirection, TxStatus, WalletCurrency, useTxLastSeenQuery, } from "@app/graphql/generated";
import { markTxLastSeenId } from "@app/graphql/client-only-query";
var mockUseApolloClient = useApolloClient;
var mockUseTxLastSeenQuery = useTxLastSeenQuery;
var mockMarkTxLastSeenId = markTxLastSeenId;
var buildTx = function (overrides) {
    return (__assign({ __typename: "Transaction", id: "tx-id", status: TxStatus.Success, createdAt: 1, direction: TxDirection.Receive, settlementAmount: 1, settlementFee: 0, settlementDisplayFee: "", settlementCurrency: WalletCurrency.Btc, settlementDisplayAmount: "", settlementDisplayCurrency: "BTC", settlementPrice: {
            __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
            base: 1,
            offset: 0,
            currencyUnit: "BTC",
            formattedAmount: "1",
        }, initiationVia: {
            __typename: "InitiationViaLn",
            paymentHash: "",
            paymentRequest: "",
        }, settlementVia: {
            __typename: "SettlementViaLn",
            preImage: null,
        } }, overrides));
};
describe("useTransactionSeenState", function () {
    var accountId = "account-id";
    var mockClient;
    beforeEach(function () {
        mockClient = { readQuery: jest.fn() };
        mockUseApolloClient.mockReturnValue(mockClient);
        mockUseTxLastSeenQuery.mockReturnValue({
            data: { txLastSeen: { btcId: "", usdId: "" } },
        });
        mockMarkTxLastSeenId.mockReset();
    });
    it("derives latest ids from provided transactions", function () {
        mockUseTxLastSeenQuery.mockReturnValue({
            data: { txLastSeen: { btcId: "btc-old", usdId: "usd-old" } },
        });
        var transactions = [
            buildTx({ id: "btc-old", createdAt: 1, settlementCurrency: WalletCurrency.Btc }),
            buildTx({ id: "btc-new", createdAt: 5, settlementCurrency: WalletCurrency.Btc }),
            buildTx({ id: "usd-new", createdAt: 3, settlementCurrency: WalletCurrency.Usd }),
        ];
        var result = renderHook(function () { return useTransactionSeenState(accountId, transactions); }).result;
        expect(mockClient.readQuery).not.toHaveBeenCalled();
        expect(result.current.latestBtcTxId).toBe("btc-new");
        expect(result.current.hasUnseenBtcTx).toBe(true);
        expect(result.current.latestUsdTxId).toBe("usd-new");
        expect(result.current.hasUnseenUsdTx).toBe(true);
    });
    it("falls back to cached transactions when empty array is provided", function () {
        var pendingBtc = buildTx({
            id: "pending-btc",
            createdAt: 10,
            settlementCurrency: WalletCurrency.Btc,
            status: TxStatus.Pending,
            direction: TxDirection.Receive,
        });
        var settledUsd = buildTx({
            id: "settled-usd",
            createdAt: 8,
            settlementCurrency: WalletCurrency.Usd,
        });
        var pendingSendUsd = buildTx({
            id: "pending-send-usd",
            createdAt: 5,
            settlementCurrency: WalletCurrency.Usd,
            status: TxStatus.Pending,
            direction: TxDirection.Send,
        });
        mockClient.readQuery.mockReturnValue({
            me: {
                defaultAccount: {
                    pendingIncomingTransactions: [pendingBtc],
                    transactions: {
                        edges: [{ node: settledUsd }, { node: pendingSendUsd }],
                    },
                },
            },
        });
        var result = renderHook(function () { return useTransactionSeenState(accountId); }).result;
        expect(mockClient.readQuery).toHaveBeenCalledTimes(1);
        expect(result.current.latestBtcTxId).toBe("pending-btc");
        expect(result.current.latestUsdTxId).toBe("settled-usd");
    });
    it("handles transaction arrays", function () {
        var transactions = [
            buildTx({ id: "btc-array", createdAt: 2, settlementCurrency: WalletCurrency.Btc }),
            buildTx({ id: "usd-array", createdAt: 3, settlementCurrency: WalletCurrency.Usd }),
        ];
        var result = renderHook(function () { return useTransactionSeenState(accountId, transactions); }).result;
        expect(result.current.latestBtcTxId).toBe("btc-array");
        expect(result.current.latestUsdTxId).toBe("usd-array");
    });
    it("marks the latest transaction as seen for the requested currency", function () {
        var transactions = [
            buildTx({
                id: "btc-to-mark",
                createdAt: 4,
                settlementCurrency: WalletCurrency.Btc,
            }),
        ];
        var result = renderHook(function () { return useTransactionSeenState(accountId, transactions); }).result;
        act(function () {
            result.current.markTxSeen(WalletCurrency.Btc);
        });
        expect(mockMarkTxLastSeenId).toHaveBeenCalledWith({
            client: mockClient,
            accountId: accountId,
            currency: WalletCurrency.Btc,
            id: "btc-to-mark",
        });
    });
});
//# sourceMappingURL=use-transaction-seen-state.spec.js.map