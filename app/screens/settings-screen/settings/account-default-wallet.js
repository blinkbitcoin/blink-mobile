import React from "react";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { getBtcWallet } from "@app/graphql/wallets-utils";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var DefaultWallet = function () {
    var _a, _b, _c, _d;
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    var _e = useSettingsScreenQuery(), data = _e.data, loading = _e.loading;
    var btcWallet = getBtcWallet((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets);
    var btcWalletId = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.id;
    var defaultWalletId = (_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.defaultWalletId;
    var defaultWalletCurrency = defaultWalletId === btcWalletId ? LL.common.bitcoin() : LL.common.dollar();
    return (<SettingsRow loading={loading} title={"".concat(LL.DefaultWalletScreen.title(), ": ").concat(defaultWalletCurrency)} leftIcon="wallet-outline" action={function () {
            navigate("defaultWallet");
        }}/>);
};
//# sourceMappingURL=account-default-wallet.js.map