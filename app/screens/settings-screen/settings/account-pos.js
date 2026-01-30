import React from "react";
import { Linking } from "react-native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { SettingsRow } from "../row";
import { useTheme } from "@rn-vui/themed";
export var AccountPOS = function () {
    var _a;
    var appConfig = useAppConfig().appConfig;
    var colors = useTheme().theme.colors;
    var posUrl = appConfig.galoyInstance.posUrl;
    var LL = useI18nContext().LL;
    var _b = useSettingsScreenQuery(), data = _b.data, loading = _b.loading;
    if (!((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username))
        return <></>;
    var pos = "".concat(posUrl, "/").concat(data.me.username);
    return (<SettingsRow loading={loading} title={LL.SettingsScreen.pos()} subtitleShorter={data.me.username.length > 22} leftGaloyIcon="calculator" rightIcon={<GaloyIcon name="link" size={20} color={colors.primary}/>} action={function () {
            Linking.openURL(pos);
        }}/>);
};
//# sourceMappingURL=account-pos.js.map