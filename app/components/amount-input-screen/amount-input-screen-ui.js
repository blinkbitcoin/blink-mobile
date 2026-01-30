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
import * as React from "react";
import { View } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed";
import { GaloyErrorBox } from "../atomic/galoy-error-box";
import { GaloyIconButton } from "../atomic/galoy-icon-button";
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button";
import { CurrencyKeyboard } from "../currency-keyboard";
export var AmountInputScreenUI = function (_a) {
    var primaryCurrencySymbol = _a.primaryCurrencySymbol, primaryCurrencyFormattedAmount = _a.primaryCurrencyFormattedAmount, primaryCurrencyCode = _a.primaryCurrencyCode, secondaryCurrencySymbol = _a.secondaryCurrencySymbol, secondaryCurrencyFormattedAmount = _a.secondaryCurrencyFormattedAmount, secondaryCurrencyCode = _a.secondaryCurrencyCode, errorMessage = _a.errorMessage, onKeyPress = _a.onKeyPress, onPaste = _a.onPaste, onToggleCurrency = _a.onToggleCurrency, onSetAmountPress = _a.onSetAmountPress, setAmountDisabled = _a.setAmountDisabled, goBack = _a.goBack, _b = _a.compact, compact = _b === void 0 ? false : _b;
    var LL = useI18nContext().LL;
    var styles = useStyles(compact);
    var theme = useTheme().theme;
    return (<View style={styles.amountInputScreenContainer}>
      <View style={styles.headerContainer}>
        <Text type={"h1"}>{LL.AmountInputScreen.enterAmount()}</Text>
        <GaloyIconButton iconOnly={true} size={"medium"} name="close" onPress={goBack}/>
      </View>
      <View style={styles.bodyContainer}>
        <View style={styles.amountContainer}>
          <View style={styles.primaryAmountContainer}>
            {primaryCurrencySymbol && (<Text style={styles.primaryCurrencySymbol}>{primaryCurrencySymbol}</Text>)}
            <Input value={primaryCurrencyFormattedAmount} showSoftInputOnFocus={false} onChangeText={function (e) {
            // remove commas for ease of calculation later on
            var val = e.replaceAll(",", "");
            // TODO adjust for currencies that use commas instead of decimals
            // test for string input that can be either numerical or float
            if (/^\d*\.?\d*$/.test(val.trim())) {
                var num = Number(val);
                onPaste(num);
            }
        }} containerStyle={styles.primaryNumberContainer} inputStyle={styles.primaryNumberText} placeholder="0" placeholderTextColor={theme.colors.grey3} inputContainerStyle={styles.primaryNumberInputContainer} renderErrorMessage={false}/>
            <Text style={styles.primaryCurrencyCodeText}>{primaryCurrencyCode}</Text>
          </View>
          {Boolean(secondaryCurrencyFormattedAmount) && (<>
              <View style={styles.swapContainer}>
                <View style={styles.horizontalLine}/>
                <GaloyIconButton size={"large"} name="transfer" onPress={onToggleCurrency}/>
                <View style={styles.horizontalLine}/>
              </View>
              <View style={styles.secondaryAmountContainer}>
                <Text style={styles.secondaryAmountText}>
                  {secondaryCurrencySymbol}
                  {secondaryCurrencyFormattedAmount}
                </Text>
                <Text style={styles.secondaryAmountCurrencyCodeText}>
                  {secondaryCurrencyCode}
                </Text>
              </View>
            </>)}
        </View>
        <View style={styles.infoContainer}>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage}/>}
        </View>
        <View style={styles.keyboardContainer}>
          <CurrencyKeyboard onPress={onKeyPress} compact={compact}/>
        </View>
        <GaloyPrimaryButton disabled={!onSetAmountPress || setAmountDisabled} onPress={onSetAmountPress} title={LL.AmountInputScreen.setAmount()}/>
      </View>
    </View>);
};
var useStyles = makeStyles(function (_a, compact) {
    var colors = _a.colors;
    return ({
        amountInputScreenContainer: {
            flex: 1,
        },
        headerContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomColor: colors.primary4,
            borderBottomWidth: 1,
        },
        amountContainer: {
            marginBottom: 16,
        },
        primaryNumberContainer: {
            flex: 1,
        },
        primaryAmountContainer: {
            flexDirection: "row",
            alignItems: "center",
        },
        primaryCurrencySymbol: {
            fontSize: 28,
            lineHeight: 32,
            fontWeight: "bold",
        },
        primaryNumberText: {
            fontSize: 28,
            lineHeight: 32,
            flex: 1,
            fontWeight: "bold",
        },
        primaryNumberInputContainer: {
            borderBottomWidth: 0,
        },
        primaryCurrencyCodeText: {
            fontSize: 28,
            lineHeight: 32,
            fontWeight: "bold",
            textAlign: "right",
        },
        secondaryAmountContainer: {
            flexDirection: "row",
        },
        secondaryAmountText: {
            fontSize: 18,
            lineHeight: 24,
            fontWeight: "bold",
            flex: 1,
        },
        secondaryAmountCurrencyCodeText: {
            fontSize: 18,
            lineHeight: 24,
            fontWeight: "bold",
        },
        swapContainer: {
            alignItems: "center",
            flexDirection: "row",
            marginVertical: 8,
        },
        horizontalLine: {
            borderBottomColor: colors.primary4,
            borderBottomWidth: 1,
            flex: 1,
        },
        infoContainer: {
            flex: 1,
            justifyContent: "flex-start",
        },
        bodyContainer: {
            flex: 1,
            padding: 24,
        },
        buttonContainer: {},
        keyboardContainer: __assign({ marginBottom: 30 }, (compact
            ? { alignSelf: "stretch", paddingHorizontal: 20 }
            : { paddingHorizontal: 16 })),
    });
});
//# sourceMappingURL=amount-input-screen-ui.js.map