import React from "react";
import { View } from "react-native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { WalletCurrency } from "@app/graphql/generated";
var BTC_TEXT = "BTC";
var USD_TEXT = "USD";
var DEFAULT_TEXT_SIZE = "p3";
var CONTAINER_SIZES = {
    small: { horizontal: 8, vertical: 4 },
    medium: { horizontal: 12, vertical: 5 },
    large: { horizontal: 16, vertical: 6 },
};
export var GaloyCurrencyBubbleText = function (_a) {
    var currency = _a.currency, textSize = _a.textSize, _b = _a.highlighted, highlighted = _b === void 0 ? true : _b, _c = _a.containerSize, containerSize = _c === void 0 ? "small" : _c;
    var colors = useTheme().theme.colors;
    var isBtc = currency === WalletCurrency.Btc;
    return (<ContainerBubble text={isBtc ? BTC_TEXT : USD_TEXT} textSize={textSize} highlighted={highlighted} color={highlighted ? (isBtc ? colors.white : colors._white) : colors._white} backgroundColor={highlighted ? (isBtc ? colors.primary : colors._green) : colors.grey3} containerSize={containerSize}/>);
};
var ContainerBubble = function (_a) {
    var text = _a.text, textSize = _a.textSize, color = _a.color, backgroundColor = _a.backgroundColor, _b = _a.containerSize, containerSize = _b === void 0 ? "small" : _b;
    var styles = useStyles({ backgroundColor: backgroundColor, containerSize: containerSize, color: color });
    return (<View style={styles.container}>
      <Text type={textSize || DEFAULT_TEXT_SIZE} style={styles.text}>
        {text}
      </Text>
    </View>);
};
var useStyles = makeStyles(function (_theme, _a) {
    var backgroundColor = _a.backgroundColor, containerSize = _a.containerSize, color = _a.color;
    var sizes = CONTAINER_SIZES[containerSize];
    return {
        container: {
            backgroundColor: backgroundColor,
            paddingHorizontal: sizes.horizontal,
            paddingVertical: sizes.vertical,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
        },
        text: {
            color: color,
            fontWeight: "bold",
        },
    };
});
//# sourceMappingURL=galoy-currency-bubble-text.js.map