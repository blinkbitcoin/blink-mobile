import React from "react";
import { WalletCurrency } from "@app/graphql/generated";
import { useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../galoy-icon";
export var GaloyCurrencyBubble = function (_a) {
    var currency = _a.currency, overrideIconSize = _a.iconSize, _b = _a.highlighted, highlighted = _b === void 0 ? true : _b;
    var colors = useTheme().theme.colors;
    var iconSize = overrideIconSize || 24;
    return currency === WalletCurrency.Btc ? (<GaloyIcon name="bitcoin" size={iconSize} color={highlighted ? colors.white : colors._white} backgroundColor={highlighted ? colors.primary : colors.grey3}/>) : (<GaloyIcon name="dollar" size={iconSize} color={colors._white} backgroundColor={highlighted ? colors._green : colors.grey3}/>);
};
//# sourceMappingURL=galoy-currency-bubble.js.map