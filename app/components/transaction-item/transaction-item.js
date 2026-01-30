import React from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { Text, makeStyles, ListItem } from "@rn-vui/themed";
import { useFragment } from "@apollo/client";
import { TransactionFragmentDoc, } from "@app/graphql/generated";
import { useHideAmount } from "@app/graphql/hide-amount-context";
import { useAppConfig } from "@app/hooks";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useBounceInAnimation } from "@app/components/animations";
import { toWalletAmount } from "@app/types/amounts";
import { testProps } from "@app/utils/testProps";
import { IconTransaction } from "../icon-transactions";
import { TransactionDate } from "../transaction-date";
// This should extend the Transaction directly from the cache
export var useDescriptionDisplay = function (_a) {
    var tx = _a.tx, bankName = _a.bankName;
    var LL = useI18nContext().LL;
    if (!tx) {
        return "";
    }
    var memo = tx.memo, direction = tx.direction, settlementVia = tx.settlementVia;
    if (memo) {
        return memo;
    }
    var isReceive = direction === "RECEIVE";
    switch (settlementVia === null || settlementVia === void 0 ? void 0 : settlementVia.__typename) {
        case "SettlementViaOnChain":
            return "OnChain Payment";
        case "SettlementViaLn":
            return "Invoice";
        case "SettlementViaIntraLedger":
            return isReceive
                ? "".concat(LL.common.from(), " ").concat(settlementVia.counterPartyUsername || bankName + " User")
                : "".concat(LL.common.to(), " ").concat(settlementVia.counterPartyUsername || bankName + " User");
    }
};
var TransactionItem = function (_a) {
    var _b;
    var txid = _a.txid, _c = _a.subtitle, subtitle = _c === void 0 ? false : _c, _d = _a.isFirst, isFirst = _d === void 0 ? false : _d, _e = _a.isLast, isLast = _e === void 0 ? false : _e, _f = _a.isOnHomeScreen, isOnHomeScreen = _f === void 0 ? false : _f, _g = _a.testId, testId = _g === void 0 ? "transaction-item" : _g, _h = _a.highlight, highlight = _h === void 0 ? false : _h, onPress = _a.onPress;
    var styles = useStyles({
        isFirst: isFirst,
        isLast: isLast,
        isOnHomeScreen: isOnHomeScreen,
        highlight: highlight,
    });
    var tx = useFragment({
        fragment: TransactionFragmentDoc,
        fragmentName: "Transaction",
        from: {
            __typename: "Transaction",
            id: txid,
        },
    }).data;
    var galoyInstance = useAppConfig().appConfig.galoyInstance;
    var _j = useDisplayCurrency(), formatMoneyAmount = _j.formatMoneyAmount, formatCurrency = _j.formatCurrency;
    var hideAmount = useHideAmount().hideAmount;
    var description = useDescriptionDisplay({
        tx: tx,
        bankName: galoyInstance.name,
    });
    var isFocused = useIsFocused();
    var scale = useSharedValue(1);
    useBounceInAnimation({
        isFocused: isFocused,
        visible: highlight,
        scale: scale,
        delay: 300,
        duration: 120,
    });
    var animatedStyle = useAnimatedStyle(function () { return ({ transform: [{ scale: scale.value }] }); }, [scale]);
    if (!tx || Object.keys(tx).length === 0) {
        return null;
    }
    if (!tx.settlementCurrency ||
        !tx.settlementDisplayAmount ||
        !tx.settlementDisplayCurrency ||
        !tx.id ||
        !tx.createdAt ||
        !tx.status) {
        return null;
    }
    var isReceive = tx.direction === "RECEIVE";
    var isPending = tx.status === "PENDING";
    var amountStyle = isPending
        ? styles.pending
        : isReceive
            ? styles.receive
            : styles.send;
    var walletCurrency = tx.settlementCurrency;
    var formattedSettlementAmount = formatMoneyAmount({
        moneyAmount: toWalletAmount({
            amount: tx.settlementAmount,
            currency: tx.settlementCurrency,
        }),
    });
    var formattedDisplayAmount = formatCurrency({
        amountInMajorUnits: tx.settlementDisplayAmount,
        currency: tx.settlementDisplayCurrency,
    });
    var formattedSecondaryAmount = tx.settlementDisplayCurrency === tx.settlementCurrency
        ? undefined
        : formattedSettlementAmount;
    return (<Animated.View style={animatedStyle}>
      <ListItem {...testProps(testId)} containerStyle={styles.container} onPress={onPress}>
        <IconTransaction onChain={((_b = tx.settlementVia) === null || _b === void 0 ? void 0 : _b.__typename) === "SettlementViaOnChain"} isReceive={isReceive} pending={isPending} walletCurrency={walletCurrency}/>
        <ListItem.Content {...testProps("list-item-content")}>
          <ListItem.Title numberOfLines={1} ellipsizeMode="tail" style={styles.title} {...testProps("tx-description")}>
            {description}
          </ListItem.Title>
          <ListItem.Subtitle style={styles.subtitle}>
            {subtitle ? (<TransactionDate createdAt={tx.createdAt} status={tx.status} includeTime={false}/>) : undefined}
          </ListItem.Subtitle>
        </ListItem.Content>

        {hideAmount ? (<Text>****</Text>) : (<View>
            <Text style={amountStyle}>{formattedDisplayAmount}</Text>
            {formattedSecondaryAmount && (<Text style={amountStyle}>{formattedSecondaryAmount}</Text>)}
          </View>)}
      </ListItem>
    </Animated.View>);
};
export var MemoizedTransactionItem = React.memo(TransactionItem);
var useStyles = makeStyles(function (_a, props) {
    var colors = _a.colors;
    return ({
        container: {
            paddingVertical: 9,
            borderColor: colors.grey4,
            overflow: "hidden",
            backgroundColor: props.highlight ? colors.grey4 : colors.grey5,
            borderTopWidth: (props.isFirst && props.isOnHomeScreen) || !props.isFirst ? 1 : 0,
            borderBottomLeftRadius: props.isLast && props.isOnHomeScreen ? 12 : 0,
            borderBottomRightRadius: props.isLast && props.isOnHomeScreen ? 12 : 0,
        },
        hiddenBalanceContainer: {
            fontSize: 16,
            color: colors.grey0,
        },
        pending: {
            color: colors.grey1,
            textAlign: "right",
            flexWrap: "wrap",
        },
        receive: {
            color: colors._green,
            textAlign: "right",
            flexWrap: "wrap",
        },
        send: {
            color: colors.grey0,
            textAlign: "right",
            flexWrap: "wrap",
        },
        title: {
            fontSize: 16,
            lineHeight: 22,
            fontWeight: "400",
        },
        subtitle: {
            fontSize: 14,
            lineHeight: 20,
            fontWeight: "400",
        },
    });
});
//# sourceMappingURL=transaction-item.js.map