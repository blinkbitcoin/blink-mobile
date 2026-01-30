import React, { useState } from "react";
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import { SettingsRow } from "../row";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useTheme } from "@rn-vui/themed";
export var AccountLNAddress = function () {
    var _a, _b, _c;
    var appConfig = useAppConfig().appConfig;
    var colors = useTheme().theme.colors;
    var hostName = appConfig.galoyInstance.lnAddressHostname;
    var _d = useState(false), isModalShown = _d[0], setModalShown = _d[1];
    var toggleModalVisibility = function () { return setModalShown(function (x) { return !x; }); };
    var _e = useSettingsScreenQuery(), data = _e.data, loading = _e.loading;
    var LL = useI18nContext().LL;
    var hasUsername = Boolean((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username);
    var lnAddress = "".concat((_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.username, "@").concat(hostName);
    return (<>
      <SettingsRow loading={loading} title={hasUsername ? lnAddress : LL.SettingsScreen.setYourLightningAddress()} subtitleShorter={(((_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.username) || "").length > 22} leftGaloyIcon="lightning-address" rightIcon={hasUsername ? (<GaloyIcon name="copy-paste" size={20} color={colors.primary}/>) : undefined} action={function () {
            if (hasUsername) {
                Clipboard.setString(lnAddress);
                toastShow({
                    type: "success",
                    message: function (translations) {
                        return translations.GaloyAddressScreen.copiedLightningAddressToClipboard();
                    },
                    LL: LL,
                });
            }
            else {
                toggleModalVisibility();
            }
        }}/>
      <SetLightningAddressModal isVisible={isModalShown} toggleModal={toggleModalVisibility}/>
    </>);
};
//# sourceMappingURL=account-ln-address.js.map