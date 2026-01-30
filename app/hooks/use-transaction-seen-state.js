var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useMemo, useCallback } from "react";
import { useApolloClient } from "@apollo/client";
import { useRemoteConfig } from "@app/config/feature-flags-context";
import { markTxLastSeenId } from "@app/graphql/client-only-query";
import { useTxLastSeenQuery, WalletCurrency, HomeAuthedDocument, TxStatus, TxDirection, } from "@app/graphql/generated";
var getLatestTransactionId = function (transactions, currency, feeReimbursementMemo) {
    var filteredTransactions = transactions.filter(function (transaction) {
        var _a;
        return transaction.settlementCurrency === currency &&
            transaction.settlementAmount !== 0 &&
            ((_a = transaction.memo) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== feeReimbursementMemo.toLowerCase();
    });
    if (filteredTransactions.length === 0)
        return "";
    var latestTransaction = filteredTransactions.reduce(function (latest, transaction) {
        return transaction.createdAt > latest.createdAt ? transaction : latest;
    });
    return latestTransaction.id;
};
export var useTransactionSeenState = function (accountId, transactions) {
    var _a, _b;
    var client = useApolloClient();
    var feeReimbursementMemo = useRemoteConfig().feeReimbursementMemo;
    var readCachedTransactions = useCallback(function () {
        var _a, _b, _c, _d, _e;
        var data = client.readQuery({ query: HomeAuthedDocument });
        var pendingTransactions = ((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.pendingIncomingTransactions) || [];
        var transactionEdges = (_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.transactions) === null || _e === void 0 ? void 0 : _e.edges;
        if (!(transactionEdges === null || transactionEdges === void 0 ? void 0 : transactionEdges.length))
            return pendingTransactions;
        var settledTransactions = transactionEdges
            .map(function (edge) { return edge.node; })
            .filter(function (transaction) {
            return transaction.status !== TxStatus.Pending ||
                transaction.direction === TxDirection.Send;
        });
        if (pendingTransactions.length === 0)
            return settledTransactions;
        return __spreadArray(__spreadArray([], pendingTransactions, true), settledTransactions, true);
    }, [client]);
    var latestTransactionIds = useMemo(function () {
        var baseTransactions = transactions && transactions.length > 0 ? transactions : readCachedTransactions();
        return {
            btcId: getLatestTransactionId(baseTransactions, WalletCurrency.Btc, feeReimbursementMemo),
            usdId: getLatestTransactionId(baseTransactions, WalletCurrency.Usd, feeReimbursementMemo),
        };
    }, [readCachedTransactions, transactions, feeReimbursementMemo]);
    var lastSeenData = useTxLastSeenQuery({
        fetchPolicy: "cache-only",
        returnPartialData: true,
        variables: { accountId: accountId },
    }).data;
    var lastSeenBtcId = ((_a = lastSeenData === null || lastSeenData === void 0 ? void 0 : lastSeenData.txLastSeen) === null || _a === void 0 ? void 0 : _a.btcId) || "";
    var lastSeenUsdId = ((_b = lastSeenData === null || lastSeenData === void 0 ? void 0 : lastSeenData.txLastSeen) === null || _b === void 0 ? void 0 : _b.usdId) || "";
    var latestBtcTxId = latestTransactionIds.btcId;
    var latestUsdTxId = latestTransactionIds.usdId;
    var hasUnseenBtcTx = useMemo(function () { return latestBtcTxId !== "" && latestBtcTxId !== lastSeenBtcId; }, [latestBtcTxId, lastSeenBtcId]);
    var hasUnseenUsdTx = useMemo(function () { return latestUsdTxId !== "" && latestUsdTxId !== lastSeenUsdId; }, [latestUsdTxId, lastSeenUsdId]);
    var markTransactionAsSeen = useCallback(function (currency) {
        var transactionIdToMark = currency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId;
        if (transactionIdToMark) {
            markTxLastSeenId({ client: client, accountId: accountId, currency: currency, id: transactionIdToMark });
        }
    }, [client, latestBtcTxId, latestUsdTxId, accountId]);
    return {
        hasUnseenBtcTx: hasUnseenBtcTx,
        hasUnseenUsdTx: hasUnseenUsdTx,
        latestBtcTxId: latestBtcTxId,
        latestUsdTxId: latestUsdTxId,
        lastSeenBtcId: lastSeenBtcId,
        lastSeenUsdId: lastSeenUsdId,
        markTxSeen: markTransactionAsSeen,
    };
};
//# sourceMappingURL=use-transaction-seen-state.js.map