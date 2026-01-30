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
import { View } from "react-native";
import { useTheme, Text, makeStyles } from "@rn-vui/themed";
import { WalletCurrency } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
export var CURRENCY_PILL_PADDING_HORIZONTAL = 8;
export var CURRENCY_PILL_BORDER_WIDTH = 1;
export var CURRENCY_PILL_TEXT_STYLE = {
    fontSize: 14,
    fontWeight: "bold",
};
export var CurrencyPill = function (_a) {
    var currency = _a.currency, label = _a.label, _b = _a.highlighted, highlighted = _b === void 0 ? true : _b, _c = _a.containerSize, containerSize = _c === void 0 ? "small" : _c, containerStyle = _a.containerStyle, onLayout = _a.onLayout;
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var getCurrencyProps = function () {
        switch (currency) {
            case WalletCurrency.Btc:
                return {
                    defaultText: LL.common.bitcoin(),
                    color: highlighted ? colors.white : colors._white,
                    backgroundColor: highlighted ? colors.primary : colors.grey3,
                };
            case WalletCurrency.Usd:
                return {
                    defaultText: LL.common.dollar(),
                    color: highlighted ? colors._white : colors._white,
                    backgroundColor: highlighted ? colors._green : colors.grey3,
                };
            default:
                return {
                    defaultText: currency === "ALL" ? LL.common.all() : "ALL",
                    color: colors.primary,
                    backgroundColor: colors.transparent,
                    borderColor: colors.primary,
                };
        }
    };
    var currencyProps = getCurrencyProps();
    var text = label !== null && label !== void 0 ? label : currencyProps.defaultText;
    return (<ContainerBubble text={text} color={currencyProps.color} backgroundColor={currencyProps.backgroundColor} borderColor={currencyProps.borderColor} containerSize={containerSize} containerStyle={containerStyle} onLayout={onLayout}/>);
};
var ContainerBubble = function (_a) {
    var text = _a.text, color = _a.color, backgroundColor = _a.backgroundColor, _b = _a.containerSize, containerSize = _b === void 0 ? "small" : _b, borderColor = _a.borderColor, containerStyle = _a.containerStyle, onLayout = _a.onLayout;
    var styles = useStyles({ backgroundColor: backgroundColor, containerSize: containerSize, color: color, borderColor: borderColor });
    return (<View style={[styles.container, containerStyle]} onLayout={onLayout}>
      <Text type="p3" style={styles.text}>
        {text}
      </Text>
    </View>);
};
var useStyles = makeStyles(function (_theme, _a) {
    var backgroundColor = _a.backgroundColor, containerSize = _a.containerSize, color = _a.color, borderColor = _a.borderColor;
    return ({
        container: {
            backgroundColor: backgroundColor,
            paddingHorizontal: CURRENCY_PILL_PADDING_HORIZONTAL,
            paddingVertical: 7,
            minWidth: containerSize === "small" ? 40 : containerSize === "medium" ? 60 : 80,
            minHeight: containerSize === "small" ? 20 : containerSize === "medium" ? 30 : 40,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            borderColor: borderColor !== null && borderColor !== void 0 ? borderColor : "transparent",
            borderWidth: CURRENCY_PILL_BORDER_WIDTH,
            flexShrink: 0,
        },
        text: __assign({ color: color }, CURRENCY_PILL_TEXT_STYLE),
    });
});
//# sourceMappingURL=currency-pill.js.map