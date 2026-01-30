import React from "react";
import { Pressable, View } from "react-native";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { useFeatureFlags } from "@app/config/feature-flags-context";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import theme from "@app/rne-theme/theme";
import { logGetStartedAction } from "@app/utils/analytics";
import { testProps } from "@app/utils/testProps";
import { useNavigation } from "@react-navigation/native";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg";
import AppLogoLightMode from "../../assets/logo/blink-logo-light.svg";
import { Screen } from "../../components/screen";
import useAppCheckToken from "./use-device-token";
import { PhoneLoginInitiateType } from "../phone-auth-screen";
export var GetStartedScreen = function () {
    var _a;
    var navigation = useNavigation();
    var styles = useStyles();
    var _b = React.useState(0), secretMenuCounter = _b[0], setSecretMenuCounter = _b[1];
    React.useEffect(function () {
        if (secretMenuCounter > 2) {
            navigation.navigate("developerScreen");
            setSecretMenuCounter(0);
        }
    }, [navigation, secretMenuCounter]);
    var mode = useTheme().theme.mode;
    var AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode;
    var LL = useI18nContext().LL;
    var deviceAccountEnabled = useFeatureFlags().deviceAccountEnabled;
    var appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled });
    var handleCreateAccount = function () {
        logGetStartedAction({
            action: "create_device_account",
            createDeviceAccountEnabled: Boolean(appCheckToken),
        });
        navigation.navigate("acceptTermsAndConditions", { flow: "trial" });
    };
    var handleLogin = function () {
        logGetStartedAction({
            action: "log_in",
            createDeviceAccountEnabled: Boolean(appCheckToken),
        });
        navigation.navigate("login", {
            type: PhoneLoginInitiateType.Login,
        });
    };
    var id = useAppConfig().appConfig.galoyInstance.id;
    var NonProdInstanceHint = id === "Main" ? null : (<View style={styles.textInstance}>
        <Text type={"h2"} color={(_a = theme.darkColors) === null || _a === void 0 ? void 0 : _a._orange}>
          {id}
        </Text>
      </View>);
    return (<Screen headerShown={false}>
      <View style={styles.container}>
        {NonProdInstanceHint}
        <View style={styles.logoWrapper} pointerEvents="box-none">
          <Pressable onPress={function () { return setSecretMenuCounter(secretMenuCounter + 1); }} style={styles.logoContainer} {...testProps("logo-button")}>
            <AppLogo width={"100%"} height={"100%"}/>
          </Pressable>
        </View>
        <View style={styles.bottom}>
          <GaloyPrimaryButton title={LL.GetStartedScreen.createAccount()} onPress={handleCreateAccount}/>
          <GaloySecondaryButton title={LL.GetStartedScreen.login()} onPress={handleLogin} containerStyle={styles.secondaryButtonContainer}/>
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    container: {
        flex: 1,
    },
    bottom: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "flex-end",
    },
    secondaryButtonContainer: {
        marginVertical: 15,
    },
    logoWrapper: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    logoContainer: {
        width: 288,
        height: 288,
    },
    textInstance: {
        justifyContent: "center",
        flexDirection: "row",
        textAlign: "center",
        marginTop: 24,
        marginBottom: -24,
    },
}); });
//# sourceMappingURL=get-started-screen.js.map