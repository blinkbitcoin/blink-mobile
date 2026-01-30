/**
 * This component is the top banner on the settings screen
 * It shows the user their own username with a people icon
 * If the user isn't logged in, it shows Login or Create Account
 * Later on, this will support switching between accounts
 */
import React from "react";
import { View } from "react-native";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { AccountLevel, useLevel } from "@app/graphql/level-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { Text, makeStyles, useTheme, Skeleton } from "@rn-vui/themed";
import { useAppConfig } from "@app/hooks";
export var AccountBanner = function () {
    var _a, _b;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var lnAddressHostname = useAppConfig().appConfig.galoyInstance.lnAddressHostname;
    var navigation = useNavigation();
    var currentLevel = useLevel().currentLevel;
    var isUserLoggedIn = currentLevel !== AccountLevel.NonAuth;
    var _c = useSettingsScreenQuery({ fetchPolicy: "cache-first" }), data = _c.data, loading = _c.loading;
    var hasUsername = Boolean((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username);
    var lnAddress = "".concat((_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.username, "@").concat(lnAddressHostname);
    var usernameTitle = hasUsername ? lnAddress : LL.common.blinkUser();
    if (loading)
        return <Skeleton style={styles.outer} animation="pulse"/>;
    return (<TouchableWithoutFeedback onPress={function () {
            return !isUserLoggedIn &&
                navigation.reset({
                    index: 0,
                    routes: [{ name: "getStarted" }],
                });
        }}>
      <View style={styles.outer}>
        <View style={styles.iconContainer}>
          <AccountIcon size={25}/>
        </View>
        <Text type="p2">
          {isUserLoggedIn ? usernameTitle : LL.SettingsScreen.logInOrCreateAccount()}
        </Text>
      </View>
    </TouchableWithoutFeedback>);
};
export var AccountIcon = function (_a) {
    var size = _a.size;
    var colors = useTheme().theme.colors;
    return <GaloyIcon name="user" size={size} backgroundColor={colors.grey4}/>;
};
var useStyles = makeStyles(function (theme) { return ({
    outer: {
        height: 70,
        padding: 4,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        columnGap: 12,
    },
    switch: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    iconContainer: {
        backgroundColor: theme.colors.grey4,
        borderRadius: 100,
        padding: 3,
    },
}); });
//# sourceMappingURL=banner.js.map