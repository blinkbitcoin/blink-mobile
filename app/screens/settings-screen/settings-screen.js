var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { ScrollView } from "react-native-gesture-handler";
import React, { useEffect } from "react";
import { TouchableOpacity } from "react-native";
import { gql } from "@apollo/client";
import { Icon, makeStyles, Text } from "@rn-vui/themed";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@app/components/screen";
import { useI18nContext } from "@app/i18n/i18n-react";
import { VersionComponent } from "@app/components/version";
import { useLevel } from "@app/graphql/level-context";
import { useUnacknowledgedNotificationCountQuery } from "@app/graphql/generated";
import { AccountBanner } from "./account/banner";
import { EmailSetting } from "./account/settings/email";
import { PhoneSetting } from "./account/settings/phone";
import { SettingsGroup } from "./group";
import { DefaultWallet } from "./settings/account-default-wallet";
import { AccountLevelSetting } from "./settings/account-level";
import { AccountLNAddress } from "./settings/account-ln-address";
import { PhoneLnAddress } from "./settings/phone-ln-address";
import { AccountPOS } from "./settings/account-pos";
import { TxLimits } from "./settings/account-tx-limits";
import { ApiAccessSetting } from "./settings/advanced-api-access";
import { ExportCsvSetting } from "./settings/advanced-export-csv";
import { JoinCommunitySetting } from "./settings/community-join";
import { NeedHelpSetting } from "./settings/community-need-help";
import { CurrencySetting } from "./settings/preferences-currency";
import { LanguageSetting } from "./settings/preferences-language";
import { ThemeSetting } from "./settings/preferences-theme";
import { NotificationSetting } from "./settings/sp-notifications";
import { OnDeviceSecuritySetting } from "./settings/sp-security";
import { TotpSetting } from "./totp";
import { AccountStaticQR } from "./settings/account-static-qr";
import { SwitchAccountSetting } from "./settings/multi-account";
// All queries in settings have to be set here so that the server is not hit with
// multiple requests for each query
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query UnacknowledgedNotificationCount {\n    me {\n      id\n      unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount\n    }\n  }\n\n  query SettingsScreen {\n    me {\n      id\n      username\n      language\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n\n      # Authentication Stuff needed for account screen\n      totpEnabled\n      phone\n      email {\n        address\n        verified\n      }\n    }\n  }\n"], ["\n  query UnacknowledgedNotificationCount {\n    me {\n      id\n      unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount\n    }\n  }\n\n  query SettingsScreen {\n    me {\n      id\n      username\n      language\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n\n      # Authentication Stuff needed for account screen\n      totpEnabled\n      phone\n      email {\n        address\n        verified\n      }\n    }\n  }\n"])));
export var SettingsScreen = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var isAtLeastLevelOne = useLevel().isAtLeastLevelOne;
    var unackNotificationCount = useUnacknowledgedNotificationCountQuery({
        fetchPolicy: "cache-and-network",
    }).data;
    var items = {
        account: [AccountLevelSetting, TxLimits, SwitchAccountSetting],
        waysToGetPaid: [AccountLNAddress, PhoneLnAddress, AccountPOS, AccountStaticQR],
        loginMethods: [EmailSetting, PhoneSetting],
        preferences: [
            NotificationSetting,
            DefaultWallet,
            CurrencySetting,
            LanguageSetting,
            ThemeSetting,
        ],
        securityAndPrivacy: [TotpSetting, OnDeviceSecuritySetting],
        advanced: [ExportCsvSetting, ApiAccessSetting],
        community: [NeedHelpSetting, JoinCommunitySetting],
    };
    var navigation = useNavigation();
    useEffect(function () {
        var _a;
        var count = ((_a = unackNotificationCount === null || unackNotificationCount === void 0 ? void 0 : unackNotificationCount.me) === null || _a === void 0 ? void 0 : _a.unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount) || 0;
        navigation.setOptions({
            headerRight: function () { return (<TouchableOpacity onPress={function () { return navigation.navigate("notificationHistory"); }}>
          <Icon style={styles.headerRight} name="notifications-outline" type="ionicon"/>
          {count !== 0 && (<Text type="p4" style={styles.notificationCount} testID="notification-badge"/>)}
        </TouchableOpacity>); },
        });
    }, [navigation, styles, unackNotificationCount]);
    return (<Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        <AccountBanner />
        <SettingsGroup name={LL.common.account()} items={items.account}/>
        <SettingsGroup name={LL.SettingsScreen.addressScreen()} items={items.waysToGetPaid}/>
        {isAtLeastLevelOne && (<SettingsGroup name={LL.AccountScreen.loginMethods()} items={items.loginMethods}/>)}
        <SettingsGroup name={LL.common.preferences()} items={items.preferences}/>
        <SettingsGroup name={LL.common.securityAndPrivacy()} items={items.securityAndPrivacy}/>
        <SettingsGroup name={LL.common.advanced()} items={items.advanced}/>
        <SettingsGroup name={LL.common.support()} items={items.community}/>
        <VersionComponent />
      </ScrollView>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        outer: {
            marginTop: 5,
            paddingHorizontal: 12,
            paddingBottom: 20,
            display: "flex",
            flexDirection: "column",
            rowGap: 18,
        },
        headerRight: {
            marginRight: 12,
        },
        notificationCount: {
            position: "absolute",
            right: 9,
            top: -3,
            color: colors._darkGrey,
            backgroundColor: colors.black,
            textAlign: "center",
            verticalAlign: "middle",
            height: 14,
            width: 14,
            borderRadius: 9,
            overflow: "hidden",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=settings-screen.js.map