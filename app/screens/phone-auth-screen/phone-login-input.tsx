import { CountryCode as PhoneNumberCountryCode } from "libphonenumber-js/mobile"
import * as React from "react"
import { useEffect, useRef } from "react"
import { ActivityIndicator, View } from "react-native"
import { CountryCode } from "react-native-country-picker-modal"

import { CountryCodePicker } from "@app/components/phone-input/country-code-picker"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { ContactSupportButton } from "@app/components/contact-support-button/contact-support-button"
import { PhoneCodeChannelType } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme, Text, Input } from "@rn-vui/themed"
import type { InputRef } from "@app/types/themed-input"

import { Screen } from "../../components/screen"
import { PhoneChannelButton } from "./phone-channel-buttons"
import { PhoneLoginInitiateType } from "./phone-login-initiate-type"
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
  /** No `flex` here on purpose: the phone field beside it already takes the row's free
   *  space, so growing this button too would split the row in half and leave the number
   *  too narrow to read. A flag and a calling code come to a little under `minWidth` at
   *  the default text size, so in practice the floor is the width, and what it buys is a
   *  button that does not twitch between a "+1" and a "+503". */
  countryPickerButtonStyle: {
    minWidth: 110,
    borderColor: colors.primary5,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
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

const DisableCountriesForAccountCreation = [""]
type PhoneLoginInitiateScreenProps = {
  route: RouteProp<PhoneValidationStackParamList, "phoneLoginInitiate">
}
export const PhoneLoginInitiateScreen: React.FC<PhoneLoginInitiateScreenProps> = ({
  route,
}) => {
  const { appConfig } = useAppConfig()

  const styles = useStyles()

  const phoneInputRef = useRef<InputRef>(null)

  const navigation =
    useNavigation<
      NativeStackNavigationProp<PhoneValidationStackParamList, "phoneLoginInitiate">
    >()

  const {
    theme: { colors },
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
          <CountryCodePicker
            countryCode={
              (phoneInputInfo?.countryCode || DEFAULT_COUNTRY_CODE) as CountryCode
            }
            countryCodes={supportedCountries as CountryCode[]}
            onSelect={handleCountrySelect}
            onClose={handleCountryPickerClose}
            buttonStyle={styles.countryPickerButtonStyle}
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
