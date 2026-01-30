import React from "react";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
import { useLevel } from "@app/graphql/level-context";
export var AccountLevelSetting = function () {
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    var level = useLevel().currentLevel;
    return (<SettingsRow title={"".concat(LL.common.yourAccount(), ": ").concat(LL.AccountScreen.level({ level: level }))} leftGaloyIcon="user" action={function () {
            navigate("accountScreen");
        }}/>);
};
//# sourceMappingURL=account-level.js.map