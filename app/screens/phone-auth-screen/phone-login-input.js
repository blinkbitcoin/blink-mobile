import { getCountryCallingCode, } from "libphonenumber-js/mobile";
import * as React from "react";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import CountryPicker, { DARK_THEME, DEFAULT_THEME, Flag, } from "react-native-country-picker-modal";
import { TouchableOpacity } from "react-native-gesture-handler";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button";
import { PhoneCodeChannelType } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme, Text, Input } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { PhoneChannelButton } from "./phone-channel-buttons";
import { ErrorType, RequestPhoneCodeStatus, useRequestPhoneCodeLogin, } from "./request-phone-code-login";
var DEFAULT_COUNTRY_CODE = "SV";
var PLACEHOLDER_PHONE_NUMBER = "123-456-7890";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        inputContainer: {
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "stretch",
            minHeight: 48,
        },
        textContainer: {
            marginBottom: 20,
        },
        viewWrapper: { flex: 1 },
        activityIndicator: { marginTop: 12 },
        keyboardContainer: {
            paddingHorizontal: 10,
        },
        codeTextStyle: {},
        countryPickerButtonStyle: {
            minWidth: 110,
            borderColor: colors.primary5,
            borderWidth: 2,
            borderRadius: 8,
            paddingHorizontal: 10,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
        },
        bottom: {
            flex: 1,
            justifyContent: "flex-end",
            marginBottom: 14,
        },
        inputComponentContainerStyle: {
            flex: 1,
            marginLeft: 20,
            paddingLeft: 0,
            paddingRight: 0,
        },
        inputContainerStyle: {
            flex: 1,
            borderWidth: 2,
            borderBottomWidth: 2,
            paddingHorizontal: 10,
            borderColor: colors.primary5,
            borderRadius: 8,
        },
        errorContainer: {
            marginBottom: 20,
        },
        infoContainer: {
            marginBottom: 20,
        },
        contactSupportButton: {
            marginTop: 10,
        },
        loadingView: { flex: 1, justifyContent: "center", alignItems: "center" },
    });
});
export var PhoneLoginInitiateType = {
    Login: "Login",
    CreateAccount: "CreateAccount",
};
var DisableCountriesForAccountCreation = [""];
export var PhoneLoginInitiateScreen = function (_a) {
    var route = _a.route;
    var appConfig = useAppConfig().appConfig;
    var styles = useStyles();
    var phoneInputRef = useRef(null);
    var navigation = useNavigation();
    var _b = useTheme().theme, colors = _b.colors, themeMode = _b.mode;
    var _c = useRequestPhoneCodeLogin(), userSubmitPhoneNumber = _c.userSubmitPhoneNumber, captchaLoading = _c.captchaLoading, status = _c.status, setPhoneNumber = _c.setPhoneNumber, isTelegramSupported = _c.isTelegramSupported, isSmsSupported = _c.isSmsSupported, isWhatsAppSupported = _c.isWhatsAppSupported, phoneInputInfo = _c.phoneInputInfo, phoneCodeChannel = _c.phoneCodeChannel, error = _c.error, validatedPhoneNumber = _c.validatedPhoneNumber, setStatus = _c.setStatus, setCountryCode = _c.setCountryCode, supportedCountries = _c.supportedCountries, loadingSupportedCountries = _c.loadingSupportedCountries;
    var LL = useI18nContext().LL;
    var screenType = route.params.type;
    var phoneChannel = route.params.channel;
    var onboarding = route.params.onboarding;
    var isDisabledCountryAndCreateAccount = screenType === PhoneLoginInitiateType.CreateAccount &&
        (phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.countryCode) &&
        DisableCountriesForAccountCreation.includes(phoneInputInfo.countryCode);
    var handleCountrySelect = function (country) {
        setCountryCode(country.cca2);
        setTimeout(function () {
            var _a;
            (_a = phoneInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }, 100);
    };
    var handleCountryPickerClose = function () {
        setTimeout(function () {
            var _a;
            (_a = phoneInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }, 300);
    };
    useEffect(function () {
        if (status !== RequestPhoneCodeStatus.SuccessRequestingCode)
            return;
        setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber);
        if (phoneCodeChannel === PhoneCodeChannelType.Telegram) {
            navigation.navigate("telegramLoginValidate", {
                phone: validatedPhoneNumber || "",
                type: screenType,
                onboarding: onboarding,
            });
            return;
        }
        navigation.navigate("phoneLoginValidate", {
            type: screenType,
            phone: validatedPhoneNumber || "",
            channel: phoneCodeChannel,
            onboarding: onboarding,
        });
    }, [
        status,
        phoneCodeChannel,
        validatedPhoneNumber,
        navigation,
        setStatus,
        screenType,
        onboarding,
    ]);
    useEffect(function () {
        if (!appConfig || appConfig.galoyInstance.id !== "Local") {
            return;
        }
        setTimeout(function () { return setPhoneNumber("66667777"); }, 0);
        // we intentionally do not want to add setPhoneNumber so that we can use other phone if needed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appConfig]);
    if (status === RequestPhoneCodeStatus.LoadingCountryCode || loadingSupportedCountries) {
        return (<Screen>
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={colors.primary}/>
        </View>
      </Screen>);
    }
    var errorMessage;
    if (error) {
        switch (error) {
            case ErrorType.FailedCaptchaError:
                errorMessage = LL.PhoneLoginInitiateScreen.errorRequestingCaptcha();
                break;
            case ErrorType.RequestCodeError:
                errorMessage = LL.PhoneLoginInitiateScreen.errorRequestingCode();
                break;
            case ErrorType.TooManyAttemptsError:
                errorMessage = LL.errors.tooManyRequestsPhoneCode();
                break;
            case ErrorType.InvalidPhoneNumberError:
                errorMessage = LL.PhoneLoginInitiateScreen.errorInvalidPhoneNumber();
                break;
            case ErrorType.UnsupportedCountryError:
                errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry();
                break;
        }
    }
    if (!isSmsSupported && !isWhatsAppSupported && !isTelegramSupported) {
        errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry();
    }
    if (isDisabledCountryAndCreateAccount) {
        errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry();
    }
    var info = undefined;
    if ((phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.countryCode) && phoneInputInfo.countryCode === "AR") {
        info = LL.PhoneLoginInitiateScreen.infoArgentina();
    }
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"h2"}>{LL.PhoneLoginInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <CountryPicker theme={themeMode === "dark" ? DARK_THEME : DEFAULT_THEME} countryCode={((phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.countryCode) || DEFAULT_COUNTRY_CODE)} countryCodes={supportedCountries} onSelect={handleCountrySelect} onClose={handleCountryPickerClose} renderFlagButton={function (_a) {
            var countryCode = _a.countryCode, onOpen = _a.onOpen;
            return (countryCode && (<TouchableOpacity style={styles.countryPickerButtonStyle} onPress={onOpen}>
                    <Flag countryCode={countryCode} flagSize={24}/>
                    <Text type="p1">
                      +{getCountryCallingCode(countryCode)}
                    </Text>
                  </TouchableOpacity>));
        }} withCallingCodeButton={true} withFilter={true} filterProps={{
            autoFocus: true,
        }} withCallingCode={true}/>
          <Input {...testProps("telephoneNumber")} ref={phoneInputRef} placeholder={PLACEHOLDER_PHONE_NUMBER} containerStyle={styles.inputComponentContainerStyle} inputContainerStyle={styles.inputContainerStyle} renderErrorMessage={false} textContentType="telephoneNumber" keyboardType="phone-pad" value={phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.rawPhoneNumber} onChangeText={setPhoneNumber} autoFocus={true}/>
        </View>
        {info && (<View style={styles.infoContainer}>
            <GaloyInfo>{info}</GaloyInfo>
          </View>)}
        {errorMessage && (<View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage}/>
            <ContactSupportButton containerStyle={styles.contactSupportButton}/>
          </View>)}
        <PhoneChannelButton phoneCodeChannel={phoneChannel} captchaLoading={captchaLoading} isDisabled={isDisabledCountryAndCreateAccount} submit={userSubmitPhoneNumber} customStyle={styles.bottom}/>
      </View>
    </Screen>);
};
//# sourceMappingURL=phone-login-input.js.map