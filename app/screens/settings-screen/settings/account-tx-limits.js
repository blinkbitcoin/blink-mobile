import React from "react";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var TxLimits = function () {
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    return (<SettingsRow title={LL.common.transactionLimits()} leftIcon="information-circle-outline" action={function () { return navigate("transactionLimitsScreen"); }}/>);
};
//# sourceMappingURL=account-tx-limits.js.map