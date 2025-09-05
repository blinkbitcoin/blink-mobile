import {
  CountryCode as PhoneNumberCountryCode,
  getCountryCallingCode,
} from "libphonenumber-js/mobile"
import * as React from "react"
import { ActivityIndicator, View } from "react-native"
import CountryPicker, {
  CountryCode,
  DARK_THEME,
  DEFAULT_THEME,
  Flag,
} from "react-native-country-picker-modal"
import { TouchableOpacity } from "react-native-gesture-handler"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button"
import { PhoneCodeChannelType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, useTheme, Text, Input } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import {
  ErrorType,
  RequestPhoneCodeStatus,
  useRequestPhoneCodeRegistration,
} from "./request-phone-code-registration"

const DEFAULT_COUNTRY_CODE = "SV"
const PLACEHOLDER_PHONE_NUMBER = "123-456-7890"

export const PhoneRegistrationInitiateScreen: React.FC = () => {
  const styles = useStyles()

  const {
    theme: { colors, mode: themeMode },
  } = useTheme()

  const {
    userSubmitPhoneNumber,
    status,
    setPhoneNumber,
    isSmsSupported,
    isWhatsAppSupported,
    phoneInputInfo,
    phoneCodeChannel,
    error,
    setCountryCode,
    supportedCountries,
  } = useRequestPhoneCodeRegistration()

  const { LL } = useI18nContext()

  if (status === RequestPhoneCodeStatus.LoadingCountryCode) {
    return (
      <Screen>
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    )
  }

  let errorMessage: string | undefined
  if (error) {
    switch (error) {
      case ErrorType.RequestCodeError:
        errorMessage = LL.PhoneRegistrationInitiateScreen.errorRequestingCode()
        break
      case ErrorType.TooManyAttemptsError:
        errorMessage = LL.errors.tooManyRequestsPhoneCode()
        break
      case ErrorType.InvalidPhoneNumberError:
        errorMessage = LL.PhoneRegistrationInitiateScreen.errorInvalidPhoneNumber()
        break
      case ErrorType.UnsupportedCountryError:
        errorMessage = LL.PhoneRegistrationInitiateScreen.errorUnsupportedCountry()
        break
    }
  }
  if (!isSmsSupported && !isWhatsAppSupported) {
    errorMessage = LL.PhoneRegistrationInitiateScreen.errorUnsupportedCountry()
  }

  let PrimaryButton = undefined
  let SecondaryButton = undefined
  switch (true) {
    case isSmsSupported && isWhatsAppSupported:
      PrimaryButton = (
        <GaloyPrimaryButton
          title={LL.PhoneRegistrationInitiateScreen.sms()}
          loading={
            status === RequestPhoneCodeStatus.RequestingCode &&
            phoneCodeChannel === PhoneCodeChannelType.Sms
          }
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Sms)}
        />
      )
      SecondaryButton = (
        <GaloySecondaryButton
          title={LL.PhoneRegistrationInitiateScreen.whatsapp()}
          containerStyle={styles.whatsAppButton}
          loading={
            status === RequestPhoneCodeStatus.RequestingCode &&
            phoneCodeChannel === PhoneCodeChannelType.Whatsapp
          }
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Whatsapp)}
        />
      )
      break
    case isSmsSupported && !isWhatsAppSupported:
      PrimaryButton = (
        <GaloyPrimaryButton
          title={LL.PhoneRegistrationInitiateScreen.sms()}
          loading={
            status === RequestPhoneCodeStatus.RequestingCode &&
            phoneCodeChannel === PhoneCodeChannelType.Sms
          }
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Sms)}
        />
      )
      break
    case !isSmsSupported && isWhatsAppSupported:
      PrimaryButton = (
        <GaloyPrimaryButton
          title={LL.PhoneRegistrationInitiateScreen.whatsapp()}
          loading={
            status === RequestPhoneCodeStatus.RequestingCode &&
            phoneCodeChannel === PhoneCodeChannelType.Whatsapp
          }
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Whatsapp)}
        />
      )
      break
  }

  let info: string | undefined = undefined
  if (phoneInputInfo?.countryCode && phoneInputInfo.countryCode === "AR") {
    info = LL.PhoneLoginInitiateScreen.infoArgentina()
  }

  return (
    <Screen
      preset="scroll"
      style={styles.screenStyle}
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"p1"}>{LL.PhoneRegistrationInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <CountryPicker
            theme={themeMode === "dark" ? DARK_THEME : DEFAULT_THEME}
            countryCode={
              (phoneInputInfo?.countryCode || DEFAULT_COUNTRY_CODE) as CountryCode
            }
            countryCodes={supportedCountries as CountryCode[]}
            onSelect={(country) => setCountryCode(country.cca2 as PhoneNumberCountryCode)}
            renderFlagButton={({ countryCode, onOpen }) => {
              return (
                countryCode && (
                  <TouchableOpacity
                    style={styles.countryPickerButtonStyle}
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
            placeholder={PLACEHOLDER_PHONE_NUMBER}
            containerStyle={styles.inputComponentContainerStyle}
            inputContainerStyle={styles.inputContainerStyle}
            renderErrorMessage={false}
            textContentType="telephoneNumber"
            keyboardType="phone-pad"
            value={phoneInputInfo?.rawPhoneNumber}
            onChangeText={setPhoneNumber}
            autoFocus={true}
          />
        </View>
        {info && (
          <View style={styles.infoContainer}>
            <GaloyInfo>{info}</GaloyInfo>
          </View>
        )}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage} />
            <ContactSupportButton containerStyle={styles.contactSupportButton} />
          </View>
        )}

        <View style={styles.buttonsContainer}>
          {SecondaryButton}
          {PrimaryButton}
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
}))
