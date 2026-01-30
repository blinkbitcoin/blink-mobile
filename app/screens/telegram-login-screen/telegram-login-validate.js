import React, { useEffect } from "react";
import { View } from "react-native";
import { makeStyles, Text } from "@rn-vui/themed";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Screen } from "@app/components/screen";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
import { TelegramLoginButton } from "@app/components/telegram-login";
import { useTelegramLogin, ErrorType } from "./telegram-auth";
export var TelegramLoginScreen = function (_a) {
    var route = _a.route;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var _b = useTelegramLogin(route.params.phone, route.params.onboarding), loading = _b.loading, error = _b.error, isPollingForAuth = _b.isPollingForAuth, handleTelegramLogin = _b.handleTelegramLogin;
    // Map useTelegramLogin errors
    var errorMessage;
    if (error) {
        switch (error) {
            case ErrorType.FetchParamsError:
                errorMessage = LL.TelegramValidationScreen.errorFetchParams();
                break;
            case ErrorType.FetchLoginError:
                errorMessage = LL.TelegramValidationScreen.errorFetchLogin();
                break;
            case ErrorType.TimeoutError:
                errorMessage = LL.TelegramValidationScreen.errorAuthTimeout();
                break;
            case ErrorType.OpenAppError:
                errorMessage = LL.TelegramValidationScreen.errorOpenAppError();
                break;
            default:
                errorMessage = typeof error === "string" ? error : undefined;
        }
    }
    // Run handleTelegramLogin once on screen mount
    useEffect(function () {
        handleTelegramLogin();
    }, [handleTelegramLogin]);
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardShouldPersistTaps="handled">
      <View>
        <Text type="h2" style={styles.text}>
          {LL.TelegramValidationScreen.text()}
        </Text>

        <Text type="p2" style={styles.description}>
          {LL.TelegramValidationScreen.description()}
        </Text>

        {errorMessage && (<View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage}/>
          </View>)}

        {isPollingForAuth && (<View style={styles.infoContainer}>
            <GaloyInfo>{LL.TelegramValidationScreen.waitingForAuthorization()}</GaloyInfo>
          </View>)}

        <TelegramLoginButton title={LL.TelegramValidationScreen.loginWithTelegram()} onPress={handleTelegramLogin} loading={loading || isPollingForAuth}/>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        text: {
            textAlign: "center",
            marginBottom: 10,
        },
        description: {
            textAlign: "center",
            color: colors.grey2,
            marginBottom: 30,
        },
        errorContainer: {
            marginBottom: 20,
        },
        infoContainer: {
            marginBottom: 20,
        },
    });
});
//# sourceMappingURL=telegram-login-validate.js.map