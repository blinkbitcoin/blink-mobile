import {
  CountryCode as PhoneNumberCountryCode,
  getCountryCallingCode,
} from "libphonenumber-js/mobile"
import * as React from "react"
import { useEffect, useRef } from "react"
import { ActivityIndicator, View, TextInput } from "react-native"
import CountryPicker, {
  CountryCode,
  DARK_THEME,
  DEFAULT_THEME,
  Flag,
} from "react-native-country-picker-modal"
import { TouchableOpacity } from "react-native-gesture-handler"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button"
import { PhoneCodeChannelType } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme, Text, Input } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { PhoneChannelButton } from "./phone-channel-buttons"
import type { PhoneValidationStackParamList } from "../../navigation/stack-param-lists"
import {
  ErrorType,
  RequestPhoneCodeStatus,
  useRequestPhoneCodeLogin,
} from "./request-phone-code-login"

const DEFAULT_COUNTRY_CODE = "SV"
const PLACEHOLDER_PHONE_NUMBER = "123-456-7890"

const useStyles = makeStyles(({ colors }) => ({
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
}))

export const PhoneLoginInitiateType = {
  Login: "Login",
  CreateAccount: "CreateAccount",
} as const

const DisableCountriesForAccountCreation = [""]

export type PhoneLoginInitiateType =
  (typeof PhoneLoginInitiateType)[keyof typeof PhoneLoginInitiateType]
type PhoneLoginInitiateScreenProps = {
  route: RouteProp<PhoneValidationStackParamList, "phoneLoginInitiate">
}
export const PhoneLoginInitiateScreen: React.FC<PhoneLoginInitiateScreenProps> = ({
  route,
}) => {
  const { appConfig } = useAppConfig()

  const styles = useStyles()

  const phoneInputRef = useRef<TextInput>(null)

  const navigation =
    useNavigation<
      StackNavigationProp<PhoneValidationStackParamList, "phoneLoginInitiate">
    >()

  const {
    theme: { colors, mode: themeMode },
  } = useTheme()

  const {
    userSubmitPhoneNumber,
    captchaLoading,
    status,
    setPhoneNumber,
    isTelegramSupported,
    isSmsSupported,
    isWhatsAppSupported,
    phoneInputInfo,
    phoneCodeChannel,
    error,
    validatedPhoneNumber,
    setStatus,
    setCountryCode,
    supportedCountries,
    loadingSupportedCountries,
  } = useRequestPhoneCodeLogin()

  const { LL } = useI18nContext()

  const screenType = route.params.type
  const phoneChannel = route.params.channel
  const onboarding = route.params.onboarding

  const isDisabledCountryAndCreateAccount =
    screenType === PhoneLoginInitiateType.CreateAccount &&
    phoneInputInfo?.countryCode &&
    DisableCountriesForAccountCreation.includes(phoneInputInfo.countryCode)

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

  useEffect(() => {
    if (status !== RequestPhoneCodeStatus.SuccessRequestingCode) return

    setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber)

    if (phoneCodeChannel === PhoneCodeChannelType.Telegram) {
      navigation.navigate("telegramLoginValidate", {
        phone: validatedPhoneNumber || "",
        type: screenType,
        onboarding,
      })
      return
    }

    navigation.navigate("phoneLoginValidate", {
      type: screenType,
      phone: validatedPhoneNumber || "",
      channel: phoneCodeChannel,
      onboarding,
    })
  }, [
    status,
    phoneCodeChannel,
    validatedPhoneNumber,
    navigation,
    setStatus,
    screenType,
    onboarding,
  ])

  useEffect(() => {
    if (!appConfig || appConfig.galoyInstance.id !== "Local") {
      return
    }

    setTimeout(() => setPhoneNumber("66667777"), 0)
    // we intentionally do not want to add setPhoneNumber so that we can use other phone if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appConfig])

  if (status === RequestPhoneCodeStatus.LoadingCountryCode || loadingSupportedCountries) {
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
      case ErrorType.FailedCaptchaError:
        errorMessage = LL.PhoneLoginInitiateScreen.errorRequestingCaptcha()
        break
      case ErrorType.RequestCodeError:
        errorMessage = LL.PhoneLoginInitiateScreen.errorRequestingCode()
        break
      case ErrorType.TooManyAttemptsError:
        errorMessage = LL.errors.tooManyRequestsPhoneCode()
        break
      case ErrorType.InvalidPhoneNumberError:
        errorMessage = LL.PhoneLoginInitiateScreen.errorInvalidPhoneNumber()
        break
      case ErrorType.UnsupportedCountryError:
        errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry()
        break
    }
  }
  if (!isSmsSupported && !isWhatsAppSupported && !isTelegramSupported) {
    errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry()
  }
  if (isDisabledCountryAndCreateAccount) {
    errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry()
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
          <Text type={"h2"}>{LL.PhoneLoginInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <CountryPicker
            theme={themeMode === "dark" ? DARK_THEME : DEFAULT_THEME}
            countryCode={
              (phoneInputInfo?.countryCode || DEFAULT_COUNTRY_CODE) as CountryCode
            }
            countryCodes={supportedCountries as CountryCode[]}
            onSelect={handleCountrySelect}
            onClose={handleCountryPickerClose}
            renderFlagButton={({ countryCode, onOpen }) => {
              return (
                countryCode && (
                  <TouchableOpacity
                    testID="Country Picker"
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
            {...testProps("telephoneNumber")}
            ref={phoneInputRef}
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
        <PhoneChannelButton
          phoneCodeChannel={phoneChannel}
          captchaLoading={captchaLoading}
          isDisabled={isDisabledCountryAndCreateAccount}
          submit={userSubmitPhoneNumber}
          customStyle={styles.bottom}
        />
      </View>
    </Screen>
  )
}
