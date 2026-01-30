import { useCallback } from "react";
import Clipboard from "@react-native-clipboard/clipboard";
import { useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import { SettingsGroup } from "../group";
import { SettingsRow } from "../row";
var ACCOUNT_ID_MASK = "\u2022".repeat(20);
export var AccountId = function () {
    var _a, _b;
    var _c = useSettingsScreenQuery(), data = _c.data, loading = _c.loading;
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var accountId = ((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.id) || "";
    var last6digitsOfAccountId = accountId === null || accountId === void 0 ? void 0 : accountId.slice(-6).toUpperCase();
    var maskedAccountId = "".concat(ACCOUNT_ID_MASK, " ").concat(last6digitsOfAccountId);
    var copyToClipboard = useCallback(function () {
        Clipboard.setString(accountId);
        toastShow({
            message: function (translations) {
                return translations.AccountScreen.copiedAccountId();
            },
            type: "success",
            LL: LL,
        });
    }, [LL, accountId]);
    var AccountIdRow = function () { return (<SettingsRow loading={loading} title={maskedAccountId} action={null} rightIcon={<GaloyIcon name="copy-paste" size={20} color={colors.primary}/>} rightIconAction={copyToClipboard}/>); };
    AccountIdRow.displayName = "AccountIdRow";
    return <SettingsGroup name={LL.AccountScreen.accountId()} items={[AccountIdRow]}/>;
};
//# sourceMappingURL=id.js.map