import React from "react";
import { View } from "react-native";
import { WalletCurrency } from "@app/graphql/generated";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles } from "@rn-vui/themed";
import { CurrencyPill } from "../atomic/currency-pill";
var amountTypeToSymbol = {
    RECEIVE: "+",
    SEND: "-",
};
// TODO: this code should be refactored
// it's just used in transaction details
export var WalletSummary = function (_a) {
    var settlementAmount = _a.settlementAmount, txDisplayAmount = _a.txDisplayAmount, txDisplayCurrency = _a.txDisplayCurrency, amountType = _a.amountType;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var _b = useDisplayCurrency(), formatMoneyAmount = _b.formatMoneyAmount, formatCurrency = _b.formatCurrency;
    var walletName = settlementAmount.currency === WalletCurrency.Btc
        ? LL.common.btcAccount()
        : LL.common.usdAccount();
    var formattedDisplayAmount = formatCurrency({
        amountInMajorUnits: txDisplayAmount,
        currency: txDisplayCurrency,
        withSign: false,
        currencyCode: txDisplayCurrency,
    });
    var secondaryAmount = settlementAmount.currency === txDisplayCurrency
        ? undefined
        : formatMoneyAmount({ moneyAmount: settlementAmount });
    var amounts = secondaryAmount
        ? formattedDisplayAmount + " (".concat(secondaryAmount, ")")
        : formattedDisplayAmount;
    return (<View style={styles.walletSummaryContainer}>
      <View style={styles.currencyTagContainer}>
        <CurrencyPill currency={settlementAmount.currency} containerSize="medium"/>
      </View>
      <View style={styles.amountsContainer}>
        <Text type={"p2"}>{walletName}</Text>
        <Text>
          {amountTypeToSymbol[amountType]}
          {amounts}
        </Text>
      </View>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        walletSummaryContainer: {
            backgroundColor: colors.grey5,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 8,
            padding: 14,
        },
        amountsContainer: {
            marginLeft: 16,
        },
        currencyTagContainer: {},
    });
});
//# sourceMappingURL=wallet-summary.js.map