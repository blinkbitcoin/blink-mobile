import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { AmountInput } from "@app/components/amount-input";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { Screen } from "@app/components/screen";
import { usePaymentRequestQuery, WalletCurrency } from "@app/graphql/generated";
import { getBtcWallet } from "@app/graphql/wallets-utils";
import { usePriceConversion } from "@app/hooks";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { DisplayCurrency, toBtcMoneyAmount, } from "@app/types/amounts";
import { testProps } from "@app/utils/testProps";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text } from "@rn-vui/themed";
var RedeemBitcoinDetailScreen = function (_a) {
    var _b, _c;
    var route = _a.route;
    var styles = useStyles();
    var navigation = useNavigation();
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var _d = route.params.receiveDestination.validDestination, callback = _d.callback, domain = _d.domain, defaultDescription = _d.defaultDescription, k1 = _d.k1, minWithdrawable = _d.minWithdrawable, maxWithdrawable = _d.maxWithdrawable;
    // minWithdrawable and maxWithdrawable are in msats
    var minWithdrawableSatoshis = toBtcMoneyAmount(Math.round(minWithdrawable / 1000));
    var maxWithdrawableSatoshis = toBtcMoneyAmount(Math.round(maxWithdrawable / 1000));
    var amountIsFlexible = minWithdrawableSatoshis.amount !== maxWithdrawableSatoshis.amount;
    var _e = useState(WalletCurrency.Btc), receiveCurrency = _e[0], setReceiveCurrency = _e[1];
    var LL = useI18nContext().LL;
    var data = usePaymentRequestQuery({ fetchPolicy: "cache-first" }).data;
    var btcWallet = getBtcWallet((_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets);
    var btcWalletId = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.id;
    var usdWalletId = null; // TODO: enable receiving USD when USD invoices support satoshi amounts
    useEffect(function () {
        if (receiveCurrency === WalletCurrency.Usd) {
            navigation.setOptions({ title: LL.RedeemBitcoinScreen.usdTitle() });
        }
        if (receiveCurrency === WalletCurrency.Btc) {
            navigation.setOptions({ title: LL.RedeemBitcoinScreen.title() });
        }
    }, [receiveCurrency, navigation, LL]);
    var _f = useState(minWithdrawableSatoshis), unitOfAccountAmount = _f[0], setUnitOfAccountAmount = _f[1];
    var convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    if (!convertMoneyAmount) {
        console.log("convertMoneyAmount is undefined");
        return null;
    }
    var btcMoneyAmount = convertMoneyAmount(unitOfAccountAmount, WalletCurrency.Btc);
    var validAmount = btcMoneyAmount.amount !== null &&
        btcMoneyAmount.amount <= maxWithdrawableSatoshis.amount &&
        btcMoneyAmount.amount >= minWithdrawableSatoshis.amount;
    var navigate = function () {
        if (receiveCurrency !== WalletCurrency.Btc) {
            return;
        }
        btcWalletId &&
            navigation.replace("redeemBitcoinResult", {
                callback: callback,
                domain: domain,
                k1: k1,
                defaultDescription: defaultDescription,
                minWithdrawableSatoshis: minWithdrawableSatoshis,
                maxWithdrawableSatoshis: maxWithdrawableSatoshis,
                receivingWalletDescriptor: {
                    id: btcWalletId,
                    currency: receiveCurrency,
                },
                unitOfAccountAmount: unitOfAccountAmount,
                settlementAmount: btcMoneyAmount,
                displayAmount: convertMoneyAmount(btcMoneyAmount, DisplayCurrency),
            });
    };
    return (<Screen preset="scroll" style={styles.contentContainer}>
      {usdWalletId && (<View style={styles.tabRow}>
          <TouchableWithoutFeedback onPress={function () { return setReceiveCurrency(WalletCurrency.Btc); }}>
            <View>
              <Text>BTC</Text>
            </View>
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={function () { return setReceiveCurrency(WalletCurrency.Usd); }}>
            <View>
              <Text>USD</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>)}
      <View style={[styles.inputForm, styles.container]}>
        {defaultDescription && (<Text {...testProps("description")} style={styles.withdrawableDescriptionText}>
            {defaultDescription}
          </Text>)}
        <Text style={styles.withdrawableAmountToRedeemText}>
          {LL.RedeemBitcoinScreen.amountToRedeemFrom({ domain: domain })}
        </Text>
        <View style={styles.currencyInputContainer}>
          <AmountInput walletCurrency={receiveCurrency} unitOfAccountAmount={unitOfAccountAmount} setAmount={setUnitOfAccountAmount} maxAmount={maxWithdrawableSatoshis} minAmount={minWithdrawableSatoshis} convertMoneyAmount={convertMoneyAmount} canSetAmount={amountIsFlexible}/>
          {amountIsFlexible && (<Text style={unitOfAccountAmount.amount <= maxWithdrawableSatoshis.amount &&
                unitOfAccountAmount.amount >= minWithdrawableSatoshis.amount
                ? styles.infoText
                : styles.withdrawalErrorText}>
              {LL.RedeemBitcoinScreen.minMaxRange({
                minimumAmount: formatMoneyAmount({
                    moneyAmount: minWithdrawableSatoshis,
                }),
                maximumAmount: formatMoneyAmount({
                    moneyAmount: maxWithdrawableSatoshis,
                }),
            })}
            </Text>)}
        </View>

        <GaloyPrimaryButton title={LL.RedeemBitcoinScreen.redeemBitcoin()} disabled={!validAmount} onPress={navigate}/>
      </View>
    </Screen>);
};
export default RedeemBitcoinDetailScreen;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        tabRow: {
            flexDirection: "row",
            flexWrap: "nowrap",
            justifyContent: "center",
            marginTop: 14,
        },
        container: {
            marginTop: 14,
            marginLeft: 20,
            marginRight: 20,
        },
        inputForm: {
            marginVertical: 20,
        },
        currencyInputContainer: {
            padding: 20,
            borderRadius: 10,
        },
        infoText: {
            color: colors.grey2,
            fontSize: 14,
        },
        withdrawalErrorText: {
            color: colors.error,
            fontSize: 14,
        },
        withdrawableDescriptionText: {
            fontSize: 16,
            textAlign: "center",
        },
        withdrawableAmountToRedeemText: {
            fontSize: 16,
            textAlign: "center",
        },
        currencyInput: {
            flexDirection: "column",
            flex: 1,
        },
        toggle: {
            justifyContent: "flex-end",
        },
        button: {
            height: 60,
            borderRadius: 10,
            marginTop: 40,
        },
        contentContainer: {
            padding: 20,
            flexGrow: 1,
        },
    });
});
//# sourceMappingURL=redeem-bitcoin-detail-screen.js.map