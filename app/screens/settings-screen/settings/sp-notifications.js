import React from "react";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var NotificationSetting = function () {
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    return (<SettingsRow title={"".concat(LL.common.notifications(), ": ").concat(LL.common.some())} leftIcon="notifications-outline" action={function () { return navigate("notificationSettingsScreen"); }}/>);
};
//# sourceMappingURL=sp-notifications.js.map