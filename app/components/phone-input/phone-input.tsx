import parsePhoneNumber, {
  AsYouType,
  CountryCode as PhoneNumberCountryCode,
  getCountryCallingCode,
} from "libphonenumber-js/mobile"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { View, TouchableOpacity, TextInput, StyleProp, ViewStyle } from "react-native"
import CountryPicker, {
  CountryCode,
  DARK_THEME,
  DEFAULT_THEME,
  Flag,
} from "react-native-country-picker-modal"
import { Input, makeStyles, Text, useTheme } from "@rn-vui/themed"
import { testProps } from "@app/utils/testProps"
import useDeviceLocation from "@app/hooks/use-device-location"
import { useSupportedCountriesQuery } from "@app/graphql/generated"
import { IconNode } from "@rn-vui/base"

const DEFAULT_COUNTRY_CODE = "SV"
const PLACEHOLDER_PHONE_NUMBER = "123-456-7890"

export type PhoneInputInfo = {
  countryCode: CountryCode
  countryCallingCode: string
  formattedPhoneNumber: string
  rawPhoneNumber: string
  phoneNumberWithCode: string
  phoneNumberWithoutCode: string
}

export type PhoneInputProps = {
  value: string
  onChangeText: (info: string) => void
  onChangeInfo?: (info: PhoneInputInfo | null) => void
  rightIcon?: IconNode
  isDisabled?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onSubmitEditing?: () => void
  inputContainerStyle?: StyleProp<ViewStyle>
  bgColor?: string
}

export const getPhoneNumberWithoutCode = (
  number: string,
  countryCallingCode?: string,
) => {
  const code = `+${countryCallingCode}`
  const phoneNumber =
    number.startsWith(code && "+") && number.length > code.length * 2
      ? `${number.slice(code.length)}`
      : number
  return phoneNumber
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  onChangeInfo,
  rightIcon,
  isDisabled,
  onFocus,
  onBlur,
  onSubmitEditing,
  inputContainerStyle,
  bgColor,
}) => {
  const {
    theme: { mode: themeMode },
  } = useTheme()
  const styles = useStyles({ bgColor })

  const { data } = useSupportedCountriesQuery()

  const [countryCode, setCountryCode] = useState<PhoneNumberCountryCode | undefined>()
  const phoneInputRef = useRef<TextInput>(null)
  const { countryCode: detectedCountryCode } = useDeviceLocation()

  const { allSupportedCountries } = useMemo(() => {
    const allSupportedCountries = (data?.globals?.supportedCountries.map(
      (country) => country.id,
    ) || []) as CountryCode[]

    return {
      allSupportedCountries,
    }
  }, [data?.globals, detectedCountryCode])

  // setting default country code from IP
  useEffect(() => {
    if (detectedCountryCode) {
      setCountryCode(detectedCountryCode)
    }
  }, [detectedCountryCode])

  const handleCountrySelect = (country: { cca2: string }) => {
    setCountryCode(country.cca2 as PhoneNumberCountryCode)
    setTimeout(() => {
      phoneInputRef.current?.focus()
    }, 100)
  }

  const handleCountryPickerClose = () => {
    setTimeout(() => {
      phoneInputRef.current?.focus()
    }, 300)
  }

  const setPhoneNumber = (number: string) => {
    const parsedPhoneNumber = parsePhoneNumber(number, countryCode)
    if (parsedPhoneNumber?.country) {
      setCountryCode(parsedPhoneNumber.country)
    }
    onChangeText(number)
  }

  const phoneInputInfo = useMemo((): PhoneInputInfo | null => {
    if (!countryCode) return null
    const countryCallingCode = getCountryCallingCode(countryCode)

    const info = {
      countryCode: countryCode as CountryCode,
      formattedPhoneNumber: new AsYouType(countryCode).input(value),
      countryCallingCode,
      rawPhoneNumber: value,
      phoneNumberWithoutCode: getPhoneNumberWithoutCode(value, countryCode),
      phoneNumberWithCode: value
        ? `+${countryCallingCode}${getPhoneNumberWithoutCode(value, countryCallingCode)}`
        : "",
    }
    return info
  }, [countryCode, value])

  useEffect(() => {
    if (onChangeInfo) onChangeInfo(phoneInputInfo)
  }, [phoneInputInfo, onChangeInfo])

  return (
    <View style={styles.inputContainer}>
      <CountryPicker
        theme={themeMode === "dark" ? DARK_THEME : DEFAULT_THEME}
        countryCode={(phoneInputInfo?.countryCode || DEFAULT_COUNTRY_CODE) as CountryCode}
        countryCodes={allSupportedCountries as CountryCode[]}
        onSelect={handleCountrySelect}
        onClose={handleCountryPickerClose}
        renderFlagButton={({ countryCode, onOpen }) => {
          return (
            countryCode && (
              <TouchableOpacity
                style={[
                  styles.countryPickerButtonStyle,
                  isDisabled && styles.disabledInput,
                ]}
                onPress={onOpen}
              >
                <Flag countryCode={countryCode} flagSize={24} />
                <Text type="p1">
                  +{getCountryCallingCode(countryCode as PhoneNumberCountryCode)}
                </Text>
              </TouchableOpacity>
            )
          )
        }}
        withCallingCodeButton={true}
        withFilter={true}
        filterProps={{
          autoFocus: true,
        }}
        withCallingCode={true}
      />
      <Input
        {...testProps("telephoneNumber")}
        ref={phoneInputRef}
        placeholder={PLACEHOLDER_PHONE_NUMBER}
        containerStyle={styles.inputComponentContainerStyle}
        inputContainerStyle={[
          styles.inputContainerStyle,
          isDisabled && styles.disabledInput,
          inputContainerStyle && inputContainerStyle,
        ]}
        renderErrorMessage={false}
        textContentType="telephoneNumber"
        keyboardType="phone-pad"
        value={value}
        onChangeText={setPhoneNumber}
        autoFocus={false}
        rightIcon={rightIcon}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }, props: { bgColor?: string }) => ({
  inputContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 60,
  },
  countryPickerButtonStyle: {
    backgroundColor: props.bgColor ? props.bgColor : colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: props.bgColor ? props.bgColor : colors.grey5,
    borderRadius: 8,
  },
  disabledInput: { opacity: 0.6 },
}))
