/**
 * This component is the top banner on the settings screen
 * It shows the user their own username with a people icon
 * If the user isn't logged in, it shows Login or Create Account
 * Later on, this will support switching between accounts
 */
import React from "react";
import { View } from "react-native";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { AccountLevel, useLevel } from "@app/graphql/level-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { Text, makeStyles, Skeleton, Avatar } from "@rn-vui/themed";
import { useAppConfig } from "@app/hooks";
export var AccountBannerVertical = function () {
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
        <Avatar size={80} rounded title={isUserLoggedIn
            ? usernameTitle.charAt(0)
            : LL.SettingsScreen.logInOrCreateAccount().charAt(0)} containerStyle={styles.containerStyle} titleStyle={styles.titleStyle}/>
        <View style={styles.textContainer}>
          <Text type="p2">
            {isUserLoggedIn ? usernameTitle : LL.SettingsScreen.logInOrCreateAccount()}
          </Text>
          <Text type="p2">{LL.AccountScreen.level({ level: currentLevel })}</Text>
        </View>
      </View>
    </TouchableWithoutFeedback>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        outer: {
            padding: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            rowGap: 15,
        },
        switch: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        textContainer: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            rowGap: 1,
        },
        containerStyle: {
            backgroundColor: colors.grey5,
        },
        titleStyle: {
            color: colors.primary,
            fontWeight: "bold",
            fontSize: 50,
            includeFontPadding: false,
        },
    });
});
//# sourceMappingURL=banner-vertical.js.map