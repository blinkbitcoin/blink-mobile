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
import React from "react";
import { Text, View } from "react-native";
import { makeStyles, useTheme } from "@rn-vui/themed";
var useStyles = makeStyles(function () { return ({
    currencyTag: {
        borderRadius: 10,
        height: 30,
        width: 50,
        justifyContent: "center",
        alignItems: "center",
    },
    currencyText: {
        fontSize: 12,
    },
}); });
export var CurrencyTag = function (_a) {
    var walletCurrency = _a.walletCurrency;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var currencyStyling = {
        BTC: {
            textColor: colors.white,
            backgroundColor: colors.primary,
        },
        USD: {
            textColor: colors.black,
            backgroundColor: colors._green,
        },
    };
    return (<View style={__assign(__assign({}, styles.currencyTag), { backgroundColor: currencyStyling[walletCurrency].backgroundColor })}>
      <Text style={__assign(__assign({}, styles.currencyText), { color: currencyStyling[walletCurrency].textColor })}>
        {walletCurrency}
      </Text>
    </View>);
};
//# sourceMappingURL=currency-tag.js.map