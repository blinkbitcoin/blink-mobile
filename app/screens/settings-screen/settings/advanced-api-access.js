import React from "react";
import { useI18nContext } from "@app/i18n/i18n-react";
import { SettingsRow } from "../row";
import { useNavigation } from "@react-navigation/native";
export var ApiAccessSetting = function () {
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    return (<SettingsRow title={LL.SettingsScreen.apiAcess()} leftGaloyIcon="document-outline" action={function () { return navigate("apiScreen"); }}/>);
};
//# sourceMappingURL=advanced-api-access.js.map