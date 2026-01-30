var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useCallback, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { useApolloClient } from "@apollo/client";
import { useRemoteConfig } from "@app/config/feature-flags-context";
import { useDisplayCurrency } from "@app/hooks";
import { toWalletAmount } from "@app/types/amounts";
import { TxDirection, WalletCurrency, HomeAuthedDocument, TxStatus, } from "@app/graphql/generated";
export var useUnseenTxAmountBadge = function (_a) {
    var transactions = _a.transactions, hasUnseenUsdTx = _a.hasUnseenUsdTx, hasUnseenBtcTx = _a.hasUnseenBtcTx;
    var navigation = useNavigation();
    var _b = useDisplayCurrency(), formatCurrency = _b.formatCurrency, formatMoneyAmount = _b.formatMoneyAmount;
    var feeReimbursementMemo = useRemoteConfig().feeReimbursementMemo;
    var client = useApolloClient();
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
    var latestUnseenTx = useMemo(function () {
        var baseTransactions = transactions && transactions.length > 0 ? transactions : readCachedTransactions();
        if (!baseTransactions || baseTransactions.length === 0)
            return;
        if (!hasUnseenBtcTx && !hasUnseenUsdTx)
            return;
        var unseenCurrencies = [];
        if (hasUnseenBtcTx)
            unseenCurrencies.push(WalletCurrency.Btc);
        if (hasUnseenUsdTx)
            unseenCurrencies.push(WalletCurrency.Usd);
        var unseenTransactions = baseTransactions.filter(function (tx) {
            var _a;
            if (!unseenCurrencies.includes(tx.settlementCurrency))
                return false;
            if (tx.settlementAmount === 0)
                return false;
            if (((_a = tx.memo) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === feeReimbursementMemo.toLowerCase())
                return false;
            return true;
        });
        if (unseenTransactions.length === 0)
            return;
        return unseenTransactions.reduce(function (latest, tx) {
            return tx.createdAt > latest.createdAt ? tx : latest;
        });
    }, [
        transactions,
        hasUnseenBtcTx,
        hasUnseenUsdTx,
        feeReimbursementMemo,
        readCachedTransactions,
    ]);
    var unseenAmountText = useMemo(function () {
        if (!latestUnseenTx)
            return null;
        var displayAmount = latestUnseenTx.settlementDisplayAmount, displayCurrency = latestUnseenTx.settlementDisplayCurrency, rawAmount = latestUnseenTx.settlementAmount, rawCurrency = latestUnseenTx.settlementCurrency, direction = latestUnseenTx.direction;
        var hasDisplayAmount = displayAmount !== null && displayAmount !== undefined && Boolean(displayCurrency);
        var hasRawAmount = rawAmount !== null && rawAmount !== undefined && Boolean(rawCurrency);
        var formattedFromDisplay = hasDisplayAmount
            ? formatCurrency({ amountInMajorUnits: displayAmount, currency: displayCurrency })
            : null;
        var formattedFromRaw = !formattedFromDisplay && hasRawAmount
            ? formatMoneyAmount({
                moneyAmount: toWalletAmount({
                    amount: rawAmount,
                    currency: rawCurrency,
                }),
            })
            : null;
        var formatted = formattedFromDisplay !== null && formattedFromDisplay !== void 0 ? formattedFromDisplay : formattedFromRaw;
        if (!formatted)
            return null;
        return direction === TxDirection.Receive ? "+".concat(formatted) : formatted;
    }, [latestUnseenTx, formatCurrency, formatMoneyAmount]);
    var handleUnseenBadgePress = useCallback(function () {
        if (!(latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.id))
            return;
        navigation.navigate("transactionDetail", { txid: latestUnseenTx.id });
    }, [navigation, latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.id]);
    return {
        latestUnseenTx: latestUnseenTx,
        unseenAmountText: unseenAmountText,
        handleUnseenBadgePress: handleUnseenBadgePress,
        isOutgoing: (latestUnseenTx === null || latestUnseenTx === void 0 ? void 0 : latestUnseenTx.direction) === TxDirection.Send,
    };
};
//# sourceMappingURL=use-unseen-tx-amount-badge.js.map