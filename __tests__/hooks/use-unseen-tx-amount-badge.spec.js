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
import { renderHook } from "@testing-library/react-hooks";
import { TxDirection } from "@app/graphql/generated";
import { useUnseenTxAmountBadge } from "@app/components/unseen-tx-amount-badge";
var mockNavigate = jest.fn();
jest.mock("@react-navigation/native", function () {
    return {
        useNavigation: function () { return ({ navigate: mockNavigate }); },
    };
});
jest.mock("@app/hooks", function () {
    return {
        useDisplayCurrency: function () { return ({
            formatCurrency: function (_a) {
                var amountInMajorUnits = _a.amountInMajorUnits, currency = _a.currency;
                return "".concat(currency, " ").concat(amountInMajorUnits);
            },
            formatMoneyAmount: function (_a) {
                var moneyAmount = _a.moneyAmount;
                return "".concat(moneyAmount.currency, " ").concat(moneyAmount.amount);
            },
        }); },
    };
});
jest.mock("@app/types/amounts", function () {
    return {
        toWalletAmount: function (_a) {
            var amount = _a.amount, currency = _a.currency;
            return ({ amount: amount, currency: currency });
        },
    };
});
jest.mock("@app/config/feature-flags-context", function () { return ({
    useRemoteConfig: function () { return ({
        feeReimbursementMemo: "fee reimbursement",
    }); },
}); });
jest.mock("@apollo/client", function () { return (__assign(__assign({}, jest.requireActual("@apollo/client")), { useApolloClient: function () { return ({
        readQuery: jest.fn(function () { return null; }),
    }); } })); });
var tx = function (overrides) {
    return (__assign({ __typename: "Transaction", id: "txid", status: "SUCCESS", createdAt: 0, direction: TxDirection.Receive, settlementAmount: 123, settlementFee: 0, settlementDisplayFee: "", settlementCurrency: "BTC", settlementDisplayAmount: "", settlementDisplayCurrency: "", settlementPrice: {
            __typename: "PriceOfOneSettlementMinorUnitInDisplayMinorUnit",
            base: 0,
            offset: 0,
            currencyUnit: "",
            formattedAmount: "",
        }, initiationVia: {
            __typename: "InitiationViaLn",
            paymentHash: "",
            paymentRequest: "",
        }, settlementVia: {
            __typename: "SettlementViaLn",
            preImage: null,
        } }, overrides));
};
describe("useUnseenTxAmountBadge", function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("returns null when nothing unseen", function () {
        var result = renderHook(function () {
            return useUnseenTxAmountBadge({
                transactions: [tx({ id: "a", createdAt: 1 })],
                hasUnseenBtcTx: false,
                hasUnseenUsdTx: false,
            });
        }).result;
        expect(result.current.latestUnseenTx).toBeUndefined();
        expect(result.current.unseenAmountText).toBeNull();
    });
    it("picks most recent by createdAt", function () {
        var _a;
        var result = renderHook(function () {
            return useUnseenTxAmountBadge({
                transactions: [tx({ id: "old", createdAt: 1 }), tx({ id: "new", createdAt: 2 })],
                hasUnseenBtcTx: true,
                hasUnseenUsdTx: false,
            });
        }).result;
        expect((_a = result.current.latestUnseenTx) === null || _a === void 0 ? void 0 : _a.id).toBe("new");
    });
    it("ignores currencies without unseen txs", function () {
        var _a;
        var result = renderHook(function () {
            return useUnseenTxAmountBadge({
                transactions: [
                    tx({ id: "btc-latest", createdAt: 2, settlementCurrency: "BTC" }),
                    tx({ id: "usd-latest", createdAt: 3, settlementCurrency: "USD" }),
                ],
                hasUnseenBtcTx: true,
                hasUnseenUsdTx: false,
            });
        }).result;
        expect((_a = result.current.latestUnseenTx) === null || _a === void 0 ? void 0 : _a.id).toBe("btc-latest");
    });
    it("prefixes + for receive and not for send", function () {
        var receiveResult = renderHook(function () {
            return useUnseenTxAmountBadge({
                transactions: [
                    tx({
                        id: "r",
                        createdAt: 1,
                        direction: TxDirection.Receive,
                        settlementCurrency: "USD",
                        settlementDisplayAmount: "5",
                        settlementDisplayCurrency: "USD",
                    }),
                ],
                hasUnseenBtcTx: false,
                hasUnseenUsdTx: true,
            });
        }).result;
        expect(receiveResult.current.unseenAmountText).toBe("+USD 5");
        var sendResult = renderHook(function () {
            return useUnseenTxAmountBadge({
                transactions: [
                    tx({
                        id: "s",
                        createdAt: 1,
                        direction: TxDirection.Send,
                        settlementAmount: 10,
                        settlementCurrency: "BTC",
                    }),
                ],
                hasUnseenBtcTx: true,
                hasUnseenUsdTx: false,
            });
        }).result;
        expect(sendResult.current.unseenAmountText).toBe("BTC 10");
    });
    it("navigates to transactionDetail using latest tx id", function () {
        var result = renderHook(function () {
            return useUnseenTxAmountBadge({
                transactions: [tx({ id: "navigate-me", createdAt: 10 })],
                hasUnseenBtcTx: true,
                hasUnseenUsdTx: false,
            });
        }).result;
        result.current.handleUnseenBadgePress();
        expect(mockNavigate).toHaveBeenCalledWith("transactionDetail", {
            txid: "navigate-me",
        });
    });
});
//# sourceMappingURL=use-unseen-tx-amount-badge.spec.js.map