var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import * as React from "react";
import { SectionList, Text, View } from "react-native";
import { gql } from "@apollo/client";
import { MemoizedTransactionItem } from "@app/components/transaction-item";
import { useTransactionListForContactQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { groupTransactionsByDate } from "@app/graphql/transactions";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles } from "@rn-vui/themed";
import { toastShow } from "../../../utils/toast";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query transactionListForContact(\n    $username: Username!\n    $first: Int\n    $after: String\n    $last: Int\n    $before: String\n  ) {\n    me {\n      id\n      contactByUsername(username: $username) {\n        transactions(first: $first, after: $after, last: $last, before: $before) {\n          ...TransactionList\n        }\n      }\n    }\n  }\n"], ["\n  query transactionListForContact(\n    $username: Username!\n    $first: Int\n    $after: String\n    $last: Int\n    $before: String\n  ) {\n    me {\n      id\n      contactByUsername(username: $username) {\n        transactions(first: $first, after: $after, last: $last, before: $before) {\n          ...TransactionList\n        }\n      }\n    }\n  }\n"])));
export var ContactTransactions = function (_a) {
    var _b, _c;
    var contactUsername = _a.contactUsername;
    var styles = useStyles();
    var _d = useI18nContext(), LL = _d.LL, locale = _d.locale;
    var isAuthed = useIsAuthed();
    var _e = useTransactionListForContactQuery({
        variables: { username: contactUsername },
        skip: !isAuthed,
    }), error = _e.error, data = _e.data, fetchMore = _e.fetchMore;
    var transactions = (_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.contactByUsername) === null || _c === void 0 ? void 0 : _c.transactions;
    var sections = React.useMemo(function () {
        var _a, _b;
        return groupTransactionsByDate({
            txs: (_b = (_a = transactions === null || transactions === void 0 ? void 0 : transactions.edges) === null || _a === void 0 ? void 0 : _a.map(function (edge) { return edge.node; })) !== null && _b !== void 0 ? _b : [],
            LL: LL,
            locale: locale,
        });
    }, [transactions, LL, locale]);
    if (error) {
        toastShow({
            message: function (translations) { return translations.common.transactionsError(); },
            LL: LL,
        });
        return <></>;
    }
    if (!transactions) {
        return <></>;
    }
    var fetchNextTransactionsPage = function () {
        var pageInfo = transactions === null || transactions === void 0 ? void 0 : transactions.pageInfo;
        if (pageInfo.hasNextPage) {
            fetchMore({
                variables: {
                    username: contactUsername,
                    after: pageInfo.endCursor,
                },
            });
        }
    };
    return (<View style={styles.screen}>
      <SectionList renderItem={function (_a) {
            var item = _a.item;
            return (<MemoizedTransactionItem key={"txn-".concat(item.id)} txid={item.id}/>);
        }} initialNumToRender={20} renderSectionHeader={function (_a) {
            var title = _a.section.title;
            return (<View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>);
        }} ListEmptyComponent={<View style={styles.noTransactionView}>
            <Text style={styles.noTransactionText}>
              {LL.TransactionScreen.noTransaction()}
            </Text>
          </View>} sections={sections} keyExtractor={function (item) { return item.id; }} onEndReached={fetchNextTransactionsPage} onEndReachedThreshold={0.5}/>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        noTransactionText: {
            fontSize: 24,
        },
        noTransactionView: {
            alignItems: "center",
            flex: 1,
            marginVertical: 48,
        },
        screen: {
            flex: 1,
            borderRadius: 10,
            borderColor: colors.grey4,
            borderWidth: 2,
            overflow: "hidden",
        },
        sectionHeaderContainer: {
            backgroundColor: colors.grey5,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 10,
        },
        sectionHeaderText: {
            color: colors.black,
            fontSize: 18,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=contact-transactions.js.map