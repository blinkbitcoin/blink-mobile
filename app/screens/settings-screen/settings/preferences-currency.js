import React from "react";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var CurrencySetting = function () {
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    var displayCurrency = useDisplayCurrency().displayCurrency;
    return (<SettingsRow title={"".concat(LL.SettingsScreen.displayCurrency(), ": ").concat(displayCurrency)} leftIcon="cash-outline" action={function () { return navigate("currency"); }}/>);
};
//# sourceMappingURL=preferences-currency.js.map