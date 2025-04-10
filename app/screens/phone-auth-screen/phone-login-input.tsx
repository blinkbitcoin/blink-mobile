import {
  CountryCode as PhoneNumberCountryCode,
  getCountryCallingCode,
} from "libphonenumber-js/mobile"
import * as React from "react"
import { useEffect, useState } from "react"
import { ActivityIndicator, View, Linking, Platform } from "react-native"
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
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme, Text, Input } from "@rneui/themed"
import { BLINK_DEEP_LINK_PREFIX } from "@app/config"

import { Screen } from "../../components/screen"
import type { PhoneValidationStackParamList } from "../../navigation/stack-param-lists"
import {
  ErrorType,
  RequestPhoneCodeStatus,
  useRequestPhoneCodeLogin,
} from "./request-phone-code-login"

const DEFAULT_COUNTRY_CODE = "SV"
const PLACEHOLDER_PHONE_NUMBER = "123-456-7890"

const TELEGRAM_BOT_ID = 5130895329
const TELEGRAM_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAweXJKoO7pm6oRUuO+vir
VdQlAEKE6qXAzfF7o7m2WaHBCOQok5h7R2xzUffjKfuco2qQUUsoMqfd8XKFZ703
YkbH0xvuCmbe3vE/8kGL8IXDVGicv7O3OpRecEZocy5HQUOfritlzXU2WAcFSqt5
vWh6Ej6nFLtntcGBf747I4tZjae4J8XkQg0zf59mlIAQG3PVStEdJnDyskWpQH0Q
HuJCrkxMdq0OHNrzS//8OXb6UgRZYRSUCL7ZBO2kpK3RU/gprcvStlh3ZJUNt59P
P1Dl+JcSvvWQM07rmi8UxIH67jVL8qz4rD9G9iV4BpHAO7rwA3AEEwMs55lX8LUQ
HQIDAQAB
-----END PUBLIC KEY-----`
const TELEGRAM_RETURN_URL = BLINK_DEEP_LINK_PREFIX + "/auth/telegram"

// Helper function to generate a random nonce
const generateNonce = (length = 32) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  const randomValues = new Uint8Array(length)

  // Use crypto.getRandomValues if available (for better security)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length]
    }
  } else {
    // Fallback to Math.random (less secure)
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }

  return result
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
  telegramButton: {
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

const DisableCountriesForAccountCreation = ["US"]

export type PhoneLoginInitiateType =
  (typeof PhoneLoginInitiateType)[keyof typeof PhoneLoginInitiateType]
type PhoneLoginInitiateScreenProps = {
  route: RouteProp<PhoneValidationStackParamList, "phoneLoginInitiate">
}
export const PhoneLoginInitiateScreen: React.FC<PhoneLoginInitiateScreenProps> = ({
  route,
}) => {
  const { appConfig } = useAppConfig()
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramError, setTelegramError] = useState<string | null>(null)
  const [currentNonce, setCurrentNonce] = useState<string>("")

  const styles = useStyles()

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

  const isDisabledCountryAndCreateAccount =
    screenType === PhoneLoginInitiateType.CreateAccount &&
    phoneInputInfo?.countryCode &&
    DisableCountriesForAccountCreation.includes(phoneInputInfo.countryCode)

  // Handle Telegram Passport authentication
  const handleTelegramAuth = async () => {
    setTelegramLoading(true)
    setTelegramError(null)

    try {
      // Generate a fresh nonce for this request
      const nonce = generateNonce()
      setCurrentNonce(nonce) // Store it for verification when Telegram returns

      // Create a scope object that only requests phone_number
      const scope = {
        data: ["phone_number"],
        v: 1,
      }

      // Parameters for Telegram Passport
      const params = {
        bot_id: TELEGRAM_BOT_ID,
        scope: scope,
        public_key: TELEGRAM_PUBLIC_KEY,
        nonce: nonce,
        callback_url: TELEGRAM_RETURN_URL,
      }

      // For React Native, create a proper URL to launch the Telegram app with Passport
      const telegramUrl = `tg://resolve?domain=telegrampassport&bot_id=${params.bot_id}&scope=${encodeURIComponent(JSON.stringify(params.scope))}&public_key=${encodeURIComponent(params.public_key)}&nonce=${encodeURIComponent(params.nonce)}&callback_url=${encodeURIComponent(params.callback_url)}`

      // Check if the URL can be opened
      const canOpen = true //await Linking.canOpenURL(telegramUrl)

      if (canOpen) {
        // Open Telegram app
        await Linking.openURL(telegramUrl)
      } else {
        // Fallback if Telegram app is not installed - open web version
        const webTelegramUrl = `https://telegram.me/telegrampassport?bot_id=${params.bot_id}&scope=${encodeURIComponent(JSON.stringify(params.scope))}&public_key=${encodeURIComponent(params.public_key)}&nonce=${encodeURIComponent(params.nonce)}&callback_url=${encodeURIComponent(params.callback_url)}`
        await Linking.openURL(webTelegramUrl)
      }
    } catch (err) {
      setTelegramError("Failed to open Telegram. Please make sure the app is installed.")
      console.error("Telegram auth error:", err)
    } finally {
      setTelegramLoading(false)
    }
  }

  // Set up deep link handler for Telegram return
  useEffect(() => {
    // Function to handle deep links from Telegram
    const handleDeepLink = (event) => {
      console.error("============ EVENT: ", event)
      const { url } = event

      if (url.includes("auth/telegram")) {
        // Parse the incoming URL parameters from Telegram
        const urlParams = new URL(url)
        const params = new URLSearchParams(urlParams.search)

        // Get the encrypted Telegram Passport data
        const telegramData = params.get("tgAuthResult")

        if (telegramData) {
          // In a real implementation, you would:
          // 1. Send this encrypted data to your backend along with the stored nonce
          // 2. Backend decrypts using your private key (corresponding to the public key used for request)
          // 3. Backend verifies the nonce matches what was sent
          // 4. Extract the phone number from the decrypted data

          console.log("Received encrypted Telegram data:", telegramData)
          console.log("Verifying with nonce:", currentNonce)

          // For demo purposes, we're showing a success navigation
          // In production, you should verify the data on your server first

          // You would typically make an API call here:
          // const response = await yourApiService.verifyTelegramPassport({
          //   telegramData: telegramData,
          //   nonce: currentNonce
          // });
          // if (response.verified && response.phoneNumber) {
          //   navigation.navigate("phoneLoginValidate", {
          //     type: screenType,
          //     phone: response.phoneNumber,
          //     channel: "Telegram"
          //   });
          // }

          // For now, we'll just navigate with placeholder data
          navigation.navigate("phoneLoginValidate", {
            type: screenType,
            phone: "Verified via Telegram", // You would use the actual decrypted phone here
            channel: "Telegram",
          })
        }
      }
    }

    // Add event listener for deep links
    const linkingSubscription = Linking.addEventListener("url", handleDeepLink)

    // Check for initial URL (in case app was opened from a deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url })
      }
    })

    // Clean up
    return () => {
      linkingSubscription.remove()
    }
  }, [navigation, screenType])

  useEffect(() => {
    if (status === RequestPhoneCodeStatus.SuccessRequestingCode) {
      setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber)
      navigation.navigate("phoneLoginValidate", {
        type: screenType,
        phone: validatedPhoneNumber || "",
        channel: phoneCodeChannel,
      })
    }
  }, [status, phoneCodeChannel, validatedPhoneNumber, navigation, setStatus, screenType])

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
  if (!isSmsSupported && !isWhatsAppSupported) {
    errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry()
  }
  if (isDisabledCountryAndCreateAccount) {
    errorMessage = LL.PhoneLoginInitiateScreen.errorUnsupportedCountry()
  }
  if (telegramError) {
    errorMessage = telegramError
  }

  let PrimaryButton = undefined
  let SecondaryButton = undefined
  let TelegramButton = undefined

  // Add Telegram button
  TelegramButton = (
    <GaloySecondaryButton
      title="Get Phone Number via Telegram"
      containerStyle={styles.telegramButton}
      loading={telegramLoading}
      onPress={handleTelegramAuth}
      disabled={isDisabledCountryAndCreateAccount}
      icon={{
        name: "paper-plane",
        type: "font-awesome",
        size: 15,
        color: "white",
      }}
    />
  )

  switch (true) {
    case isSmsSupported && isWhatsAppSupported:
      PrimaryButton = (
        <GaloyPrimaryButton
          title={LL.PhoneLoginInitiateScreen.sms()}
          loading={captchaLoading && phoneCodeChannel === PhoneCodeChannelType.Sms}
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Sms)}
          disabled={isDisabledCountryAndCreateAccount}
        />
      )
      SecondaryButton = (
        <GaloySecondaryButton
          title={LL.PhoneLoginInitiateScreen.whatsapp()}
          containerStyle={styles.whatsAppButton}
          loading={captchaLoading && phoneCodeChannel === PhoneCodeChannelType.Whatsapp}
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Whatsapp)}
          disabled={isDisabledCountryAndCreateAccount}
        />
      )
      break
    case isSmsSupported && !isWhatsAppSupported:
      PrimaryButton = (
        <GaloyPrimaryButton
          title={LL.PhoneLoginInitiateScreen.sms()}
          loading={captchaLoading && phoneCodeChannel === PhoneCodeChannelType.Sms}
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Sms)}
          disabled={isDisabledCountryAndCreateAccount}
        />
      )
      break
    case !isSmsSupported && isWhatsAppSupported:
      PrimaryButton = (
        <GaloyPrimaryButton
          title={LL.PhoneLoginInitiateScreen.whatsapp()}
          loading={captchaLoading && phoneCodeChannel === PhoneCodeChannelType.Whatsapp}
          onPress={() => userSubmitPhoneNumber(PhoneCodeChannelType.Whatsapp)}
          disabled={isDisabledCountryAndCreateAccount}
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
          <Text type={"p1"}>{LL.PhoneLoginInitiateScreen.header()}</Text>
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
            {...testProps("telephoneNumber")}
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
        <View style={styles.infoContainer}>
          <GaloyInfo>
            You can also use Telegram Passport to securely share your phone number without
            manual entry
          </GaloyInfo>
        </View>
        <View style={styles.buttonsContainer}>
          {TelegramButton}
          {SecondaryButton}
          {PrimaryButton}
        </View>
      </View>
    </Screen>
  )
}
