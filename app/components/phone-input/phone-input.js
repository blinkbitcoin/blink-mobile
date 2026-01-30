import parsePhoneNumber, { AsYouType, getCountryCallingCode, } from "libphonenumber-js/mobile";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import CountryPicker, { DARK_THEME, DEFAULT_THEME, Flag, } from "react-native-country-picker-modal";
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "@app/utils/testProps";
import useDeviceLocation from "@app/hooks/use-device-location";
import { useSupportedCountriesQuery } from "@app/graphql/generated";
var DEFAULT_COUNTRY_CODE = "SV";
var PLACEHOLDER_PHONE_NUMBER = "123-456-7890";
export var PhoneInput = function (_a) {
    var value = _a.value, onChangeText = _a.onChangeText, onChangeInfo = _a.onChangeInfo, rightIcon = _a.rightIcon, isDisabled = _a.isDisabled, keepCountryCode = _a.keepCountryCode, onFocus = _a.onFocus, onBlur = _a.onBlur, onSubmitEditing = _a.onSubmitEditing, inputContainerStyle = _a.inputContainerStyle, countryPickerButtonStyle = _a.countryPickerButtonStyle, bgColor = _a.bgColor;
    var themeMode = useTheme().theme.mode;
    var styles = useStyles({ bgColor: bgColor });
    var data = useSupportedCountriesQuery().data;
    var _b = useState(), countryCode = _b[0], setCountryCode = _b[1];
    var phoneInputRef = useRef(null);
    var detectedCountryCode = useDeviceLocation().countryCode;
    var allSupportedCountries = useMemo(function () {
        var _a;
        var allSupportedCountries = (((_a = data === null || data === void 0 ? void 0 : data.globals) === null || _a === void 0 ? void 0 : _a.supportedCountries.map(function (country) { return country.id; })) || []);
        return {
            allSupportedCountries: allSupportedCountries,
        };
    }, [data === null || data === void 0 ? void 0 : data.globals]).allSupportedCountries;
    useEffect(function () {
        if (detectedCountryCode) {
            setCountryCode(detectedCountryCode);
        }
    }, [detectedCountryCode]);
    useEffect(function () {
        if (value && countryCode) {
            if (keepCountryCode)
                return;
            var parsedPhoneNumber = parsePhoneNumber(value, countryCode);
            if ((parsedPhoneNumber === null || parsedPhoneNumber === void 0 ? void 0 : parsedPhoneNumber.country) && parsedPhoneNumber.country !== countryCode) {
                setCountryCode(parsedPhoneNumber.country);
            }
        }
    }, [value, countryCode, keepCountryCode]);
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
    var setPhoneNumber = function (number) {
        if (!keepCountryCode) {
            var parsedPhoneNumber = parsePhoneNumber(number, countryCode);
            if (parsedPhoneNumber === null || parsedPhoneNumber === void 0 ? void 0 : parsedPhoneNumber.country) {
                setCountryCode(parsedPhoneNumber.country);
            }
        }
        onChangeText(number);
    };
    var phoneInputInfo = useMemo(function () {
        if (!countryCode)
            return null;
        var countryCallingCode = getCountryCallingCode(countryCode);
        var info = {
            countryCode: countryCode,
            formattedPhoneNumber: new AsYouType(countryCode).input(value),
            countryCallingCode: countryCallingCode,
            rawPhoneNumber: value,
        };
        return info;
    }, [countryCode, value]);
    useEffect(function () {
        if (onChangeInfo)
            onChangeInfo(phoneInputInfo);
    }, [phoneInputInfo, onChangeInfo]);
    return (<View style={styles.inputContainer}>
      <CountryPicker theme={themeMode === "dark" ? DARK_THEME : DEFAULT_THEME} countryCode={((phoneInputInfo === null || phoneInputInfo === void 0 ? void 0 : phoneInputInfo.countryCode) || DEFAULT_COUNTRY_CODE)} countryCodes={allSupportedCountries} onSelect={handleCountrySelect} onClose={handleCountryPickerClose} renderFlagButton={function (_a) {
            var countryCode = _a.countryCode, onOpen = _a.onOpen;
            return (countryCode && (<TouchableOpacity style={[
                    styles.countryPickerButtonStyle,
                    isDisabled && styles.disabledInput,
                    countryPickerButtonStyle,
                ]} onPress={onOpen}>
                <Flag countryCode={countryCode} flagSize={24}/>
                <Text type="p1" style={{ includeFontPadding: false }}>
                  +{getCountryCallingCode(countryCode)}
                </Text>
              </TouchableOpacity>));
        }} withCallingCodeButton={true} withFilter={true} filterProps={{
            autoFocus: true,
        }} withCallingCode={true}/>
      <Input {...testProps("telephoneNumber")} ref={phoneInputRef} placeholder={PLACEHOLDER_PHONE_NUMBER} containerStyle={styles.inputComponentContainerStyle} inputContainerStyle={[
            styles.inputContainerStyle,
            isDisabled && styles.disabledInput,
            inputContainerStyle,
        ]} renderErrorMessage={false} textContentType="telephoneNumber" keyboardType="phone-pad" value={value} onChangeText={setPhoneNumber} autoFocus={false} rightIcon={rightIcon} onFocus={onFocus} onBlur={onBlur} onSubmitEditing={onSubmitEditing}/>
    </View>);
};
var useStyles = makeStyles(function (_a, props) {
    var colors = _a.colors;
    return ({
        inputContainer: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 60,
        },
        countryPickerButtonStyle: {
            backgroundColor: props.bgColor || colors.grey5,
            borderRadius: 8,
            paddingHorizontal: 15,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
        },
        inputComponentContainerStyle: {
            flex: 1,
            marginLeft: 20,
            paddingLeft: 0,
            paddingRight: 0,
        },
        inputContainerStyle: {
            flex: 1,
            borderWidth: 1,
            borderColor: colors.transparent,
            paddingHorizontal: 10,
            backgroundColor: props.bgColor || colors.grey5,
            borderRadius: 8,
        },
        disabledInput: { opacity: 0.6 },
    });
});
//# sourceMappingURL=phone-input.js.map