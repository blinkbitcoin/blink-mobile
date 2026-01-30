import React, { useState, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { OptionSelector } from "@app/components/option-selector";
import AppLogoDarkMode from "@app/assets/logo/app-logo-dark.svg";
import AppLogoLightMode from "@app/assets/logo/blink-logo-light.svg";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Screen } from "@app/components/screen";
import { PhoneLoginInitiateType, useRequestPhoneCodeLogin } from "../phone-auth-screen";
export var LoginChannels;
(function (LoginChannels) {
    LoginChannels["Telegram"] = "TELEGRAM";
    LoginChannels["Sms"] = "SMS";
    LoginChannels["Whatsapp"] = "WHATSAPP";
    LoginChannels["Email"] = "EMAIL";
})(LoginChannels || (LoginChannels = {}));
export var LoginMethodScreen = function (_a) {
    var _b, _c;
    var route = _a.route;
    var insets = useSafeAreaInsets();
    var styles = useStyles(insets);
    var LL = useI18nContext().LL;
    var mode = useTheme().theme.mode;
    var navigation = useNavigation();
    var _d = useRequestPhoneCodeLogin(), isTelegramSupported = _d.isTelegramSupported, isSmsSupported = _d.isSmsSupported, isWhatsAppSupported = _d.isWhatsAppSupported, loadingSupportedCountries = _d.loadingSupportedCountries;
    var _e = useState(), selected = _e[0], setSelected = _e[1];
    var AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode;
    var _f = route.params, type = _f.type, onboarding = _f.onboarding;
    var loginChanneltitles = (_b = {},
        _b[LoginChannels.Telegram] = LL.LoginMethodScreen.useTelegram(),
        _b[LoginChannels.Sms] = LL.LoginMethodScreen.useSms(),
        _b[LoginChannels.Whatsapp] = LL.LoginMethodScreen.useWhatsapp(),
        _b[LoginChannels.Email] = LL.LoginMethodScreen.useEmail(),
        _b);
    var setUpChanneltitles = (_c = {},
        _c[LoginChannels.Telegram] = LL.LoginMethodScreen.setupTelegram(),
        _c[LoginChannels.Sms] = LL.LoginMethodScreen.setupSms(),
        _c[LoginChannels.Whatsapp] = LL.LoginMethodScreen.setupWhatsapp(),
        _c[LoginChannels.Email] = LL.LoginMethodScreen.setupEmail(),
        _c);
    var handleSubmit = function () {
        if (!selected)
            return;
        if (selected === LoginChannels.Email) {
            navigation.navigate("emailLoginInitiate");
            return;
        }
        navigation.navigate("phoneFlow", {
            screen: "phoneLoginInitiate",
            params: {
                type: type,
                onboarding: onboarding,
                channel: selected,
                title: onboarding ? setUpChanneltitles[selected] : loginChanneltitles[selected],
            },
        });
    };
    var handleSelect = function (channel) {
        if (channel)
            setSelected(channel);
    };
    var options = useMemo(function () { return [
        {
            label: LL.support.telegram(),
            value: LoginChannels.Telegram,
            icon: "telegram-simple",
            active: isTelegramSupported,
            recommended: true,
        },
        {
            label: LL.support.sms(),
            value: LoginChannels.Sms,
            ionicon: "call-outline",
            active: isSmsSupported,
        },
        {
            label: LL.support.whatsapp(),
            value: LoginChannels.Whatsapp,
            ionicon: "logo-whatsapp",
            active: isWhatsAppSupported,
        },
        {
            label: LL.support.email(),
            value: LoginChannels.Email,
            ionicon: "mail-outline",
            active: type === PhoneLoginInitiateType.Login,
        },
    ]; }, [LL.support, isTelegramSupported, isSmsSupported, isWhatsAppSupported, type]);
    return (<Screen style={styles.screenStyle}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppLogo style={styles.logo}/>
          <Text type="h2" style={styles.title}>
            {LL.LoginMethodScreen.title()}
          </Text>
          <OptionSelector selected={selected} onSelect={handleSelect} options={options} loading={loadingSupportedCountries}/>
        </View>

        <View style={styles.bottom}>
          {selected && (<GaloyPrimaryButton title={loginChanneltitles[selected]} onPress={handleSubmit} disabled={!selected} containerStyle={styles.buttonContainer}/>)}
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            flex: 1,
        },
        content: {
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 20,
        },
        header: {
            paddingTop: 20,
        },
        logo: {
            alignSelf: "center",
            width: "100%",
            height: 80,
            marginBottom: 16,
        },
        title: {
            textAlign: "center",
            marginBottom: 24,
            color: colors.grey0,
        },
        buttonContainer: {
            marginVertical: 6,
        },
        bottom: {
            flex: 1,
            justifyContent: "flex-end",
            paddingBottom: 10,
        },
    });
});
//# sourceMappingURL=login-method-screen.js.map