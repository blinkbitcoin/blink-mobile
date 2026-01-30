import React from "react";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var SwitchAccountSetting = function () {
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    return (<SettingsRow title={LL.AccountScreen.switchAccount()} leftGaloyIcon="refresh" action={function () { return navigate("profileScreen"); }}/>);
};
//# sourceMappingURL=multi-account.js.map