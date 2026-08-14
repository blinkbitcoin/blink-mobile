import React from "react"
import { StyleProp, TouchableOpacity, ViewStyle } from "react-native"
import {
  CountryCode as PhoneNumberCountryCode,
  getCountryCallingCode,
} from "libphonenumber-js/mobile"
import CountryPicker, {
  CountryCode,
  DARK_THEME,
  DEFAULT_THEME,
  Flag,
} from "react-native-country-picker-modal"
import { Text, useTheme } from "@rn-vui/themed"

const FLAG_SIZE = 24

/**
 * Props the library declares through `Component.defaultProps`, which React 19 no longer
 * applies to function components. Every one of them arrives undefined instead, and the
 * flags vanish without a single error: `Flag` returns null when `withFlagButton` is unset,
 * the country list drops its flag column without `withFlag`, and an unset `withEmoji`
 * sends the picker to fetch flag images from a remote host rather than reading the emoji
 * data it already ships. Declaring them here keeps the answer in one place, so a fourth
 * caller cannot be born flagless the way the three before it were.
 */
const LIBRARY_FLAG_DEFAULTS = {
  withEmoji: true,
  withFlag: true,
} as const

const FLAG_BUTTON_DEFAULTS = {
  withEmoji: true,
  withFlagButton: true,
} as const

export type CountryCodePickerProps = {
  countryCode?: CountryCode
  countryCodes: CountryCode[]
  onSelect: (country: { cca2: string }) => void
  onClose?: () => void
  buttonStyle?: StyleProp<ViewStyle>
}

/**
 * The country code button and its picker, shared by every phone field. Callers supply
 * what genuinely differs between them, the selection handlers and the button style, and
 * never the flag configuration.
 */
export const CountryCodePicker: React.FC<CountryCodePickerProps> = ({
  countryCode,
  countryCodes,
  onSelect,
  onClose,
  buttonStyle,
}) => {
  const {
    theme: { mode: themeMode },
  } = useTheme()

  const isDarkMode = themeMode === "dark"

  /**
   * The library reads the country list once, in an effect keyed on neither the list nor
   * the codes, and an empty list means every country. Mounting before the supported ones
   * have arrived would therefore leave the modal offering all of them for good, so the
   * list itself decides the identity of the subtree that reads it.
   */
  const countryListKey = countryCodes.join()

  return (
    <CountryPicker
      key={countryListKey}
      {...LIBRARY_FLAG_DEFAULTS}
      theme={isDarkMode ? DARK_THEME : DEFAULT_THEME}
      countryCode={countryCode as CountryCode}
      countryCodes={countryCodes}
      onSelect={onSelect}
      onClose={onClose}
      renderFlagButton={({ countryCode: buttonCountryCode, onOpen }) =>
        buttonCountryCode ? (
          <TouchableOpacity style={buttonStyle} onPress={onOpen}>
            <Flag
              {...FLAG_BUTTON_DEFAULTS}
              countryCode={buttonCountryCode}
              flagSize={FLAG_SIZE}
            />
            <Text type="p1">
              +{getCountryCallingCode(buttonCountryCode as PhoneNumberCountryCode)}
            </Text>
          </TouchableOpacity>
        ) : null
      }
      withCallingCodeButton={true}
      withFilter={true}
      filterProps={{ autoFocus: true }}
      withCallingCode={true}
    />
  )
}
