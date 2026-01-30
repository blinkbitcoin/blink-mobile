import * as React from "react";
import { View } from "react-native";
import OnchainIcon from "@app/assets/icons-redesign/bitcoin.svg";
import DollarIcon from "@app/assets/icons-redesign/dollar.svg";
import LightningIcon from "@app/assets/icons-redesign/lightning.svg";
import { WalletCurrency } from "@app/graphql/generated";
import { useTheme } from "@rn-vui/themed";
export var IconTransaction = function (_a) {
    var walletCurrency = _a.walletCurrency, _b = _a.onChain, onChain = _b === void 0 ? false : _b, _c = _a.pending, pending = _c === void 0 ? false : _c;
    var colors = useTheme().theme.colors;
    switch (walletCurrency) {
        case WalletCurrency.Btc:
            if (onChain && pending)
                return <OnchainIcon color={colors.grey3}/>;
            if (onChain && !pending)
                return <OnchainIcon color={colors.primary}/>;
            return <LightningIcon color={colors.primary}/>;
        case WalletCurrency.Usd:
            return <DollarIcon color={colors.primary}/>;
        default:
            return <View />;
    }
};
//# sourceMappingURL=icon-transactions.js.map