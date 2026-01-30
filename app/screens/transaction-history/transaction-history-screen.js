var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
import * as React from "react";
import { InteractionManager, SectionList, Text, View } from "react-native";
import crashlytics from "@react-native-firebase/crashlytics";
import { makeStyles } from "@rn-vui/themed";
import { gql } from "@apollo/client";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@app/components/screen";
import { useTransactionListForDefaultAccountQuery, useWalletOverviewScreenQuery, WalletCurrency, TxDirection, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { groupTransactionsByDate } from "@app/graphql/transactions";
import { useI18nContext } from "@app/i18n/i18n-react";
import { WalletFilterDropdown, } from "@app/components/wallet-filter-dropdown";
import { useTransactionSeenState } from "@app/hooks";
import { useRemoteConfig } from "@app/config/feature-flags-context";
import { MemoizedTransactionItem } from "@app/components/transaction-item";
import { toastShow } from "../../utils/toast";
import TransactionHistorySkeleton from "./transaction-history-skeleton";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query transactionListForDefaultAccount(\n    $first: Int\n    $after: String\n    $walletIds: [WalletId!]\n  ) {\n    me {\n      id\n      defaultAccount {\n        id\n        pendingIncomingTransactions {\n          ...Transaction\n        }\n        transactions(first: $first, after: $after, walletIds: $walletIds) {\n          ...TransactionList\n        }\n      }\n    }\n  }\n"], ["\n  query transactionListForDefaultAccount(\n    $first: Int\n    $after: String\n    $walletIds: [WalletId!]\n  ) {\n    me {\n      id\n      defaultAccount {\n        id\n        pendingIncomingTransactions {\n          ...Transaction\n        }\n        transactions(first: $first, after: $after, walletIds: $walletIds) {\n          ...TransactionList\n        }\n      }\n    }\n  }\n"])));
var INITIAL_ITEMS_TO_RENDER = 14;
var RENDER_BATCH_SIZE = 14;
var QUERY_BATCH_SIZE = INITIAL_ITEMS_TO_RENDER * 1.5;
export var TransactionHistoryScreen = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    var route = _a.route;
    var styles = useStyles();
    var _s = useI18nContext(), LL = _s.LL, locale = _s.locale;
    var navigation = useNavigation();
    var _t = React.useState((_c = (_b = route.params) === null || _b === void 0 ? void 0 : _b.currencyFilter) !== null && _c !== void 0 ? _c : "ALL"), walletFilter = _t[0], setWalletFilter = _t[1];
    var isAuthed = useIsAuthed();
    var feeReimbursementMemo = useRemoteConfig().feeReimbursementMemo;
    var _u = React.useState(true), deferQueries = _u[0], setDeferQueries = _u[1];
    React.useEffect(function () {
        var task = InteractionManager.runAfterInteractions(function () {
            setDeferQueries(false);
        });
        return function () { return task.cancel(); };
    }, []);
    var hasRouteWallets = ((_f = (_e = (_d = route.params) === null || _d === void 0 ? void 0 : _d.wallets) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) > 0;
    var _v = React.useState((_h = (_g = route.params) === null || _g === void 0 ? void 0 : _g.wallets) !== null && _h !== void 0 ? _h : []), availableWallets = _v[0], setAvailableWallets = _v[1];
    var walletOverviewData = useWalletOverviewScreenQuery({
        skip: !isAuthed || hasRouteWallets || deferQueries,
        fetchPolicy: "cache-first",
    }).data;
    var walletIdsByCurrency = React.useMemo(function () {
        if (!availableWallets.length)
            return undefined;
        if (walletFilter === "ALL") {
            return availableWallets.map(function (w) { return w.id; });
        }
        return availableWallets
            .filter(function (w) { return w.walletCurrency === walletFilter; })
            .map(function (w) { return w.id; });
    }, [availableWallets, walletFilter]);
    var _w = useTransactionListForDefaultAccountQuery({
        skip: !isAuthed || deferQueries,
        fetchPolicy: "cache-and-network",
        returnPartialData: true,
        variables: {
            first: QUERY_BATCH_SIZE,
            walletIds: walletIdsByCurrency,
        },
    }), data = _w.data, previousData = _w.previousData, error = _w.error, fetchMore = _w.fetchMore, refetch = _w.refetch, loading = _w.loading;
    var dataToRender = data !== null && data !== void 0 ? data : previousData;
    React.useEffect(function () {
        var _a, _b, _c;
        if (availableWallets.length)
            return;
        if (deferQueries)
            return;
        var queryWallets = (_c = (_b = (_a = walletOverviewData === null || walletOverviewData === void 0 ? void 0 : walletOverviewData.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets) !== null && _c !== void 0 ? _c : [];
        if (queryWallets.length === 0)
            return;
        setAvailableWallets(queryWallets);
    }, [
        availableWallets.length,
        (_k = (_j = walletOverviewData === null || walletOverviewData === void 0 ? void 0 : walletOverviewData.me) === null || _j === void 0 ? void 0 : _j.defaultAccount) === null || _k === void 0 ? void 0 : _k.wallets,
        deferQueries,
    ]);
    var accountId = (_m = (_l = dataToRender === null || dataToRender === void 0 ? void 0 : dataToRender.me) === null || _l === void 0 ? void 0 : _l.defaultAccount) === null || _m === void 0 ? void 0 : _m.id;
    var pendingIncomingTransactions = (_p = (_o = dataToRender === null || dataToRender === void 0 ? void 0 : dataToRender.me) === null || _o === void 0 ? void 0 : _o.defaultAccount) === null || _p === void 0 ? void 0 : _p.pendingIncomingTransactions;
    var transactions = (_r = (_q = dataToRender === null || dataToRender === void 0 ? void 0 : dataToRender.me) === null || _q === void 0 ? void 0 : _q.defaultAccount) === null || _r === void 0 ? void 0 : _r.transactions;
    var settledTxs = React.useMemo(function () { var _a, _b; return (_b = (_a = transactions === null || transactions === void 0 ? void 0 : transactions.edges) === null || _a === void 0 ? void 0 : _a.map(function (e) { return e.node; })) !== null && _b !== void 0 ? _b : []; }, [transactions]);
    var pendingTxs = React.useMemo(function () { return (pendingIncomingTransactions ? __spreadArray([], pendingIncomingTransactions, true) : []); }, [pendingIncomingTransactions]);
    var sections = React.useMemo(function () {
        return groupTransactionsByDate({
            pendingIncomingTxs: pendingTxs,
            txs: settledTxs,
            LL: LL,
            locale: locale,
        });
    }, [pendingTxs, settledTxs, LL, locale]);
    var allTransactions = React.useMemo(function () {
        var transactions = [];
        transactions.push.apply(transactions, pendingTxs);
        transactions.push.apply(transactions, settledTxs);
        return transactions;
    }, [pendingTxs, settledTxs]);
    var _x = useTransactionSeenState(accountId || "", allTransactions), hasUnseenBtcTx = _x.hasUnseenBtcTx, hasUnseenUsdTx = _x.hasUnseenUsdTx, lastSeenBtcId = _x.lastSeenBtcId, lastSeenUsdId = _x.lastSeenUsdId, latestBtcTxId = _x.latestBtcTxId, latestUsdTxId = _x.latestUsdTxId, markTxSeen = _x.markTxSeen;
    var _y = React.useState(new Set()), seenTxIds = _y[0], setSeenTxIds = _y[1];
    var _z = React.useState(function () {
        if (lastSeenBtcId || lastSeenUsdId) {
            return { btcId: lastSeenBtcId, usdId: lastSeenUsdId };
        }
        return null;
    }), highlightBaselineLastSeen = _z[0], setHighlightBaselineLastSeen = _z[1];
    React.useEffect(function () {
        if (loading)
            return;
        if (highlightBaselineLastSeen === null) {
            setHighlightBaselineLastSeen({ btcId: lastSeenBtcId, usdId: lastSeenUsdId });
            return;
        }
        var missingBtc = !highlightBaselineLastSeen.btcId && lastSeenBtcId;
        var missingUsd = !highlightBaselineLastSeen.usdId && lastSeenUsdId;
        if (missingBtc || missingUsd) {
            setHighlightBaselineLastSeen({
                btcId: missingBtc ? lastSeenBtcId : highlightBaselineLastSeen.btcId,
                usdId: missingUsd ? lastSeenUsdId : highlightBaselineLastSeen.usdId,
            });
        }
    }, [loading, highlightBaselineLastSeen, lastSeenBtcId, lastSeenUsdId]);
    var lastSeenIdForAll = React.useMemo(function () {
        if (!(highlightBaselineLastSeen === null || highlightBaselineLastSeen === void 0 ? void 0 : highlightBaselineLastSeen.btcId) || !(highlightBaselineLastSeen === null || highlightBaselineLastSeen === void 0 ? void 0 : highlightBaselineLastSeen.usdId))
            return "";
        return highlightBaselineLastSeen.btcId < highlightBaselineLastSeen.usdId
            ? highlightBaselineLastSeen.btcId
            : highlightBaselineLastSeen.usdId;
    }, [highlightBaselineLastSeen]);
    var shouldHighlightTransactionId = React.useCallback(function (_a) {
        var txId = _a.txId, settlementCurrency = _a.settlementCurrency, memo = _a.memo, direction = _a.direction;
        if (seenTxIds.has(txId))
            return false;
        if (!highlightBaselineLastSeen)
            return false;
        if (!settlementCurrency)
            return false;
        if ((memo === null || memo === void 0 ? void 0 : memo.toLowerCase()) === feeReimbursementMemo.toLowerCase())
            return false;
        if (direction !== TxDirection.Receive)
            return false;
        var lastSeenIdForCurrency = settlementCurrency === WalletCurrency.Btc
            ? highlightBaselineLastSeen.btcId
            : settlementCurrency === WalletCurrency.Usd
                ? highlightBaselineLastSeen.usdId
                : "";
        var latestTxIdForCurrency = settlementCurrency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId;
        if (walletFilter === "ALL") {
            if (lastSeenIdForAll) {
                return txId > lastSeenIdForCurrency && txId > lastSeenIdForAll;
            }
            return lastSeenIdForCurrency
                ? txId > lastSeenIdForCurrency
                : txId === latestTxIdForCurrency;
        }
        if (settlementCurrency !== walletFilter)
            return false;
        return lastSeenIdForCurrency
            ? txId > lastSeenIdForCurrency
            : txId === latestTxIdForCurrency;
    }, [
        walletFilter,
        highlightBaselineLastSeen,
        lastSeenIdForAll,
        seenTxIds,
        feeReimbursementMemo,
        latestBtcTxId,
        latestUsdTxId,
    ]);
    React.useEffect(function () {
        if (loading)
            return;
        if (!highlightBaselineLastSeen)
            return;
        if (walletFilter === "ALL") {
            if (hasUnseenBtcTx)
                markTxSeen(WalletCurrency.Btc);
            if (hasUnseenUsdTx)
                markTxSeen(WalletCurrency.Usd);
            return;
        }
        if (walletFilter === WalletCurrency.Btc && hasUnseenBtcTx) {
            markTxSeen(WalletCurrency.Btc);
        }
        if (walletFilter === WalletCurrency.Usd && hasUnseenUsdTx) {
            markTxSeen(WalletCurrency.Usd);
        }
    }, [
        loading,
        highlightBaselineLastSeen,
        walletFilter,
        hasUnseenBtcTx,
        hasUnseenUsdTx,
        markTxSeen,
    ]);
    if (error) {
        console.error(error);
        crashlytics().recordError(error);
        toastShow({
            message: function (translations) { return translations.common.transactionsError(); },
            LL: LL,
        });
        return <></>;
    }
    if (deferQueries || !transactions) {
        return (<Screen>
        <WalletFilterDropdown selected={walletFilter} onSelectionChange={setWalletFilter} loading={true}/>
        <View style={styles.skeletonWrapper}>
          <TransactionHistorySkeleton />
        </View>
      </Screen>);
    }
    var fetchNextTransactionsPage = function () {
        var pageInfo = transactions === null || transactions === void 0 ? void 0 : transactions.pageInfo;
        if (!(pageInfo === null || pageInfo === void 0 ? void 0 : pageInfo.hasNextPage) || !pageInfo.endCursor)
            return;
        fetchMore({
            variables: {
                first: QUERY_BATCH_SIZE,
                walletIds: walletIdsByCurrency,
                after: pageInfo.endCursor,
            },
        });
    };
    return (<Screen>
      <WalletFilterDropdown selected={walletFilter} onSelectionChange={setWalletFilter} loading={loading}/>
      <SectionList showsVerticalScrollIndicator={false} maxToRenderPerBatch={RENDER_BATCH_SIZE} initialNumToRender={INITIAL_ITEMS_TO_RENDER} renderItem={function (_a) {
            var item = _a.item, index = _a.index, section = _a.section;
            return (<MemoizedTransactionItem key={"txn-".concat(item.id)} isFirst={index === 0} isLast={index === section.data.length - 1} txid={item.id} subtitle testId={"transaction-by-index-".concat(index)} highlight={shouldHighlightTransactionId({
                    txId: item.id,
                    settlementCurrency: item.settlementCurrency,
                    memo: item.memo,
                    direction: item.direction,
                })} onPress={function () {
                    setSeenTxIds(function (prev) { return new Set(prev).add(item.id); });
                    navigation.navigate("transactionDetail", { txid: item.id });
                }}/>);
        }} renderSectionHeader={function (_a) {
            var title = _a.section.title;
            return (<View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>);
        }} ListEmptyComponent={<View style={styles.noTransactionView}>
            <Text style={styles.noTransactionText}>
              {LL.TransactionScreen.noTransaction()}
            </Text>
          </View>} sections={sections} keyExtractor={function (item) { return item.id; }} onEndReached={fetchNextTransactionsPage} onEndReachedThreshold={0.5} onRefresh={function () { return refetch(); }} refreshing={loading}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        skeletonWrapper: { flex: 1, alignSelf: "stretch" },
        noTransactionText: {
            fontSize: 24,
        },
        noTransactionView: {
            alignItems: "center",
            flex: 1,
            marginVertical: 48,
        },
        sectionHeaderContainer: {
            backgroundColor: colors.white,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 18,
        },
        sectionHeaderText: {
            color: colors.black,
            fontSize: 18,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=transaction-history-screen.js.map