import React from "react";
import { useColorSchemeQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../row";
export var ThemeSetting = function () {
    var _a;
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    var colorSchemeData = useColorSchemeQuery();
    var colorScheme = LL.SettingsScreen.setByOs();
    switch ((_a = colorSchemeData === null || colorSchemeData === void 0 ? void 0 : colorSchemeData.data) === null || _a === void 0 ? void 0 : _a.colorScheme) {
        case "light":
            colorScheme = LL.ThemeScreen.setToLight();
            break;
        case "dark":
            colorScheme = LL.ThemeScreen.setToDark();
            break;
    }
    return (<SettingsRow title={"".concat(LL.SettingsScreen.theme(), ": ").concat(colorScheme)} leftIcon="brush-outline" action={function () { return navigate("theme"); }}/>);
};
//# sourceMappingURL=preferences-theme.js.map