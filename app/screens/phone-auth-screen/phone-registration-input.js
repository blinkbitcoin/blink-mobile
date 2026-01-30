import { getCountryCallingCode, } from "libphonenumber-js/mobile";
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import CountryPicker, { DARK_THEME, DEFAULT_THEME, Flag, } from "react-native-country-picker-modal";
import { TouchableOpacity } from "react-native-gesture-handler";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyInfo } from "@app/components/atomic/galoy-info";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button";
import { PhoneCodeChannelType } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles, useTheme, Text, Input } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { ErrorType, RequestPhoneCodeStatus, useRequestPhoneCodeRegistration, } from "./request-phone-code-registration";
var DEFAULT_COUNTRY_CODE = "SV";
var PLACEHOLDER_PHONE_NUMBER = "123-456-7890";
export var PhoneRegistrationInitiateScreen = function () {
    var styles = useStyles();
    var _a = useTheme().theme, colors = _a.colors, themeMode = _a.mode;
    var _b = useRequestPhoneCodeRegistration(), userSubmitPhoneNumber = _b.userSubmitPhoneNumber, status = _b.status, setPhoneNumber = _b.setPhoneNumber, isSmsSupported = _b.isSmsSupported, isWhatsAppSupported = _b.isWhatsAppSupported, phoneInputInfo = _b.phoneInputInfo, phoneCodeChannel = _b.phoneCodeChannel, error = _b.error, setCountryCode = _b.setCountryCode, supportedCountries = _b.supportedCountries;
    var LL = useI18nContext().LL;
    if (status === RequestPhoneCodeStatus.LoadingCountryCode) {
        return (<Screen>
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={colors.primary}/>
        </View>
      </Screen>);
    }
    var errorMessage;
    if (error) {
        switch (error) {
            case ErrorType.RequestCodeError:
                errorMessage = LL.PhoneRegistrationInitiateScreen.errorRequestingCode();
                break;
            case ErrorType.TooManyAttemptsError:
                errorMessage = LL.errors.tooManyRequestsPhoneCode();
                break;
            case ErrorType.InvalidPhoneNumberError:
                errorMessage = LL.PhoneRegistrationInitiateScreen.errorInvalidPhoneNumber();
                break;
            case ErrorType.UnsupportedCountryError:
                errorMessage = LL.PhoneRegistrationInitiateScreen.errorUnsupportedCountry();
                break;
        }
    }
    if (!isSmsSupported && !isWhatsAppSupported) {
        errorMessage = LL.PhoneRegistrationInitiateScreen.errorUnsupportedCountry();
    }
    var PrimaryButton = undefined;
    var SecondaryButton = undefined;
    switch (true) {
        case isSmsSupported && isWhatsAppSupported:
            PrimaryButton = (<GaloyPrimaryButton title={LL.PhoneRegistrationInitiateScreen.sms()} loading={status === RequestPhoneCodeStatus.RequestingCode &&
                    phoneCodeChannel === PhoneCodeChannelType.Sms} onPress={function () { return userSubmitPhoneNumber(PhoneCodeChannelType.Sms); }}/>);
            SecondaryButton = (<GaloySecondaryButton title={LL.PhoneRegistrationInitiateScreen.whatsapp()} containerStyle={styles.whatsAppButton} loading={status === RequestPhoneCodeStatus.RequestingCode &&
                    phoneCodeChannel === PhoneCodeChannelType.Whatsapp} onPress={function () { return userSubmitPhoneNumber(PhoneCodeChannelType.Whatsapp); }}/>);
            break;
        case isSmsSupported && !isWhatsAppSupported:
            PrimaryButton = (<GaloyPrimaryButton title={LL.PhoneRegistrationInitiateScreen.sms()} loading={status === RequestPhoneCodeStatus.RequestingCode &&
                    phoneCodeChannel === PhoneCodeChannelType.Sms} onPress={function () { return userSubmitPhoneNumber(PhoneCodeChannelType.Sms); }}/>);
            break;
        case !isSmsSupported && isWhatsAppSupported:
            PrimaryButton = (<GaloyPrimaryButton title={LL.PhoneRegistrationInitiateScreen.whatsapp()} loading={status === RequestPhoneCodeStatus.RequestingCode &&
                    phoneCodeChannel === PhoneCodeChannelType.Whatsapp} onPress={function () { return userSubmitPhoneNumber(PhoneCodeChannelType.Whatsapp); }}/>);
            break;
    }
    var info = undefined;
    if ((phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.countryCode) && phoneInputInfo.countryCode === "AR") {
        info = LL.PhoneLoginInitiateScreen.infoArgentina();
    }
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"p1"}>{LL.PhoneRegistrationInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <CountryPicker theme={themeMode === "dark" ? DARK_THEME : DEFAULT_THEME} countryCode={((phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.countryCode) || DEFAULT_COUNTRY_CODE)} countryCodes={supportedCountries} onSelect={function (country) { return setCountryCode(country.cca2); }} renderFlagButton={function (_a) {
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
          <Input placeholder={PLACEHOLDER_PHONE_NUMBER} containerStyle={styles.inputComponentContainerStyle} inputContainerStyle={styles.inputContainerStyle} renderErrorMessage={false} textContentType="telephoneNumber" keyboardType="phone-pad" value={phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.rawPhoneNumber} onChangeText={setPhoneNumber} autoFocus={true}/>
        </View>
        {info && (<View style={styles.infoContainer}>
            <GaloyInfo>{info}</GaloyInfo>
          </View>)}
        {errorMessage && (<View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage}/>
            <ContactSupportButton containerStyle={styles.contactSupportButton}/>
          </View>)}

        <View style={styles.buttonsContainer}>
          {SecondaryButton}
          {PrimaryButton}
        </View>
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
        buttonsContainer: {
            flex: 1,
            justifyContent: "flex-end",
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
        whatsAppButton: {
            marginBottom: 20,
        },
        contactSupportButton: {
            marginTop: 10,
        },
        loadingView: { flex: 1, justifyContent: "center", alignItems: "center" },
    });
});
//# sourceMappingURL=phone-registration-input.js.map