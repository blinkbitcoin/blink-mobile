import React from "react";
import Clipboard from "@react-native-clipboard/clipboard";
import { useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useLoginMethods } from "@app/screens/settings-screen/account/login-methods-hook";
import { useAppConfig } from "@app/hooks";
import { toastShow } from "@app/utils/toast";
import { SettingsRow } from "../row";
export var PhoneLnAddress = function () {
    var appConfig = useAppConfig().appConfig;
    var colors = useTheme().theme.colors;
    var hostName = appConfig.galoyInstance.lnAddressHostname;
    var _a = useLoginMethods(), loading = _a.loading, phone = _a.phone, phoneVerified = _a.phoneVerified;
    var LL = useI18nContext().LL;
    if (!phoneVerified || !phone)
        return null;
    var lnAddress = "".concat(phone, "@").concat(hostName);
    return (<SettingsRow loading={loading} title={lnAddress} leftIcon="call-outline" rightIcon={<GaloyIcon name="copy-paste" size={20} color={colors.primary}/>} action={function () {
            Clipboard.setString(lnAddress);
            toastShow({
                type: "success",
                message: function (translations) {
                    return translations.GaloyAddressScreen.copiedLightningAddressToClipboard();
                },
                LL: LL,
            });
        }}/>);
};
//# sourceMappingURL=phone-ln-address.js.map