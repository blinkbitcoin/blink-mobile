var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import React, { useState } from "react";
import ContentLoader, { Rect } from "react-content-loader/native";
import { Pressable, View } from "react-native";
import { gql } from "@apollo/client";
import { useWalletOverviewScreenQuery, WalletCurrency } from "@app/graphql/generated";
import { useHideAmount } from "@app/graphql/hide-amount-context";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts";
import { testProps } from "@app/utils/testProps";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
import { useNavigation } from "@react-navigation/native";
import { NotificationBadge } from "@app/components/notification-badge";
import { CurrencyPill, useEqualPillWidth } from "../atomic/currency-pill";
var Loader = function () {
    var styles = useStyles();
    return (<View style={styles.loaderContainer}>
      <ContentLoader height={45} width={"60%"} speed={1.2} backgroundColor={styles.loaderBackground.color} foregroundColor={styles.loaderForefound.color}>
        <Rect x="0" y="0" rx="4" ry="4" width="100%" height="100%"/>
      </ContentLoader>
    </View>);
};
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query walletOverviewScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"], ["\n  query walletOverviewScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"])));
var WalletOverview = function (_a) {
    var _b, _c, _d, _e;
    var loading = _a.loading, setIsStablesatModalVisible = _a.setIsStablesatModalVisible, wallets = _a.wallets, _f = _a.showBtcNotification, showBtcNotification = _f === void 0 ? false : _f, _g = _a.showUsdNotification, showUsdNotification = _g === void 0 ? false : _g;
    var _h = useHideAmount(), hideAmount = _h.hideAmount, switchMemoryHideAmount = _h.switchMemoryHideAmount;
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var _j = useDisplayCurrency(), formatMoneyAmount = _j.formatMoneyAmount, displayCurrency = _j.displayCurrency, moneyAmountToDisplayCurrencyString = _j.moneyAmountToDisplayCurrencyString;
    var btcInDisplayCurrencyFormatted = "$0.00";
    var usdInDisplayCurrencyFormatted = "$0.00";
    var btcInUnderlyingCurrency = "0 sat";
    var usdInUnderlyingCurrency = undefined;
    var hasWallets = wallets && wallets.length > 0;
    var data = useWalletOverviewScreenQuery({ skip: !isAuthed || hasWallets }).data;
    var resolvedWallets = hasWallets ? wallets : (_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets;
    if (isAuthed) {
        var btcWallet = getBtcWallet(resolvedWallets);
        var usdWallet = getUsdWallet(resolvedWallets);
        var btcWalletBalance = toBtcMoneyAmount((_d = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance) !== null && _d !== void 0 ? _d : NaN);
        var usdWalletBalance = toUsdMoneyAmount((_e = usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance) !== null && _e !== void 0 ? _e : NaN);
        btcInDisplayCurrencyFormatted = moneyAmountToDisplayCurrencyString({
            moneyAmount: btcWalletBalance,
            isApproximate: true,
        });
        usdInDisplayCurrencyFormatted = moneyAmountToDisplayCurrencyString({
            moneyAmount: usdWalletBalance,
            isApproximate: displayCurrency !== WalletCurrency.Usd,
        });
        btcInUnderlyingCurrency = formatMoneyAmount({ moneyAmount: btcWalletBalance });
        if (displayCurrency !== WalletCurrency.Usd) {
            usdInUnderlyingCurrency = formatMoneyAmount({ moneyAmount: usdWalletBalance });
        }
    }
    var openTransactionHistory = function (currencyFilter) {
        if (!resolvedWallets || resolvedWallets.length === 0)
            return;
        navigation.navigate("transactionHistory", {
            wallets: resolvedWallets,
            currencyFilter: currencyFilter,
        });
    };
    var _k = useState(false), pressedBtc = _k[0], setPressedBtc = _k[1];
    var _l = useState(false), pressedUsd = _l[0], setPressedUsd = _l[1];
    var _m = useEqualPillWidth(), pillWidthStyle = _m.widthStyle, onPillLayout = _m.onPillLayout;
    return (<View style={styles.container}>
      <View style={styles.myAccounts}>
        <Text type="p1" bold {...testProps(LL.HomeScreen.myAccounts())}>
          {LL.HomeScreen.myAccounts()}
        </Text>
        <Pressable onPress={switchMemoryHideAmount}>
          <GaloyIcon name={hideAmount ? "eye-slash" : "eye"} size={24}/>
        </Pressable>
      </View>

      <View style={[styles.separator, styles.titleSeparator]}/>

      <Pressable onPressIn={function () { return setPressedBtc(true); }} onPressOut={function () { return setPressedBtc(false); }} onPress={function () {
            openTransactionHistory(WalletCurrency.Btc);
        }}>
        <View style={styles.displayTextView}>
          <View style={styles.currency}>
            <View style={styles.bubbleWrapper} pointerEvents="box-none">
              <View style={pressedBtc && styles.pressedOpacity}>
                <CurrencyPill currency={WalletCurrency.Btc} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(WalletCurrency.Btc)}/>
              </View>
              <NotificationBadge visible={showBtcNotification}/>
            </View>
          </View>
          {loading ? (<Loader />) : hideAmount ? (<Text>****</Text>) : (<View style={[styles.hideableArea, pressedBtc && styles.pressedOpacity]}>
              <Text type="p1" bold {...testProps("bitcoin-balance")}>
                {btcInUnderlyingCurrency}
              </Text>
              <Text type="p3">{btcInDisplayCurrencyFormatted}</Text>
            </View>)}
        </View>
      </Pressable>

      <View style={styles.separator}/>

      <Pressable onPressIn={function () { return setPressedUsd(true); }} onPressOut={function () { return setPressedUsd(false); }} onPress={function () {
            openTransactionHistory(WalletCurrency.Usd);
        }}>
        <View style={styles.displayTextView}>
          <View style={styles.currency}>
            <View style={styles.bubbleWrapper} pointerEvents="box-none">
              <View style={pressedUsd && styles.pressedOpacity}>
                <CurrencyPill currency={WalletCurrency.Usd} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(WalletCurrency.Usd)}/>
              </View>
              <NotificationBadge visible={showUsdNotification}/>
            </View>
            <Pressable onPress={function () { return setIsStablesatModalVisible(true); }}>
              <GaloyIcon color={colors.grey1} name="question" size={18}/>
            </Pressable>
          </View>
          {loading ? (<Loader />) : (<View style={[styles.hideableArea, pressedUsd && styles.pressedOpacity]}>
              {!hideAmount && (<>
                  {usdInUnderlyingCurrency ? (<Text type="p1" bold>
                      {usdInUnderlyingCurrency}
                    </Text>) : null}
                  <Text {...testProps("stablesats-balance")} type={usdInUnderlyingCurrency ? "p3" : "p1"} bold={!usdInUnderlyingCurrency}>
                    {usdInDisplayCurrencyFormatted}
                  </Text>
                </>)}
              {hideAmount && <Text>****</Text>}
            </View>)}
        </View>
      </Pressable>
    </View>);
};
export default WalletOverview;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: colors.grey5,
            display: "flex",
            flexDirection: "column",
            borderRadius: 12,
            padding: 12,
        },
        loaderBackground: {
            color: colors.loaderBackground,
        },
        loaderForefound: {
            color: colors.loaderForeground,
        },
        myAccounts: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        displayTextView: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            height: 45,
            marginVertical: 4,
            marginTop: 5,
        },
        separator: {
            height: 1,
            backgroundColor: colors.grey4,
            marginVertical: 2,
        },
        titleSeparator: {
            marginTop: 12,
        },
        currency: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            columnGap: 10,
        },
        bubbleWrapper: {
            position: "relative",
        },
        hideableArea: {
            alignItems: "flex-end",
        },
        loaderContainer: {
            flex: 1,
            justifyContent: "flex-end",
            alignItems: "flex-end",
            height: 45,
            marginTop: 5,
        },
        pressedOpacity: { opacity: 0.7 },
    });
});
var templateObject_1;
//# sourceMappingURL=wallet-overview.js.map