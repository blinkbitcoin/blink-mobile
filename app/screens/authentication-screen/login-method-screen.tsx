import React, { useState, useMemo } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { OptionSelector, Option } from "@app/components/option-selector"
import AppLogoDarkMode from "@app/assets/logo/app-logo-dark.svg"
import AppLogoLightMode from "@app/assets/logo/blink-logo-light.svg"
import { PhoneCodeChannelType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Screen } from "@app/components/screen"

import { PhoneLoginInitiateType, useRequestPhoneCodeLogin } from "../phone-auth-screen"

export enum LoginChannels {
  Telegram = "TELEGRAM",
  Sms = "SMS",
  Whatsapp = "WHATSAPP",
  Email = "EMAIL",
}

type LoginMethodScreenProps = {
  route: RouteProp<RootStackParamList, "login">
}

export const LoginMethodScreen: React.FC<LoginMethodScreenProps> = ({ route }) => {
  const insets = useSafeAreaInsets()
  const styles = useStyles(insets)
  const { LL } = useI18nContext()
  const {
    theme: { mode },
  } = useTheme()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const {
    isTelegramSupported,
    isSmsSupported,
    isWhatsAppSupported,
    loadingSupportedCountries,
  } = useRequestPhoneCodeLogin()

  const [selected, setSelected] = useState<LoginChannels | undefined>()

  const AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode
  const { type, onboarding } = route.params

  const loginChanneltitles: Record<LoginChannels, string> = {
    [LoginChannels.Telegram]: LL.LoginMethodScreen.useTelegram(),
    [LoginChannels.Sms]: LL.LoginMethodScreen.useSms(),
    [LoginChannels.Whatsapp]: LL.LoginMethodScreen.useWhatsapp(),
    [LoginChannels.Email]: LL.LoginMethodScreen.useEmail(),
  }

  const setUpChanneltitles: Record<LoginChannels, string> = {
    [LoginChannels.Telegram]: LL.LoginMethodScreen.setupTelegram(),
    [LoginChannels.Sms]: LL.LoginMethodScreen.setupSms(),
    [LoginChannels.Whatsapp]: LL.LoginMethodScreen.setupWhatsapp(),
    [LoginChannels.Email]: LL.LoginMethodScreen.setupEmail(),
  }

  const handleSubmit = () => {
    if (!selected) return

    if (selected === LoginChannels.Email) {
      navigation.navigate("emailLoginInitiate")
      return
    }

    navigation.navigate("phoneFlow", {
      screen: "phoneLoginInitiate",
      params: {
        type,
        onboarding,
        channel: selected as PhoneCodeChannelType,
        title: onboarding ? setUpChanneltitles[selected] : loginChanneltitles[selected],
      },
    })
  }

  const handleSelect = (channel: string) => {
    if (channel) setSelected(channel as LoginChannels)
  }

  const options: Option[] = useMemo(
    () => [
      {
        label: LL.support.telegram(),
        value: LoginChannels.Telegram,
        icon: "telegram-simple",
        active: isTelegramSupported,
        recommended: true,
      },
      {
        label: LL.support.sms(),
        value: LoginChannels.Sms,
        ionicon: "call-outline",
        active: isSmsSupported,
      },
      {
        label: LL.support.whatsapp(),
        value: LoginChannels.Whatsapp,
        ionicon: "logo-whatsapp",
        active: isWhatsAppSupported,
      },
      {
        label: LL.support.email(),
        value: LoginChannels.Email,
        ionicon: "mail-outline",
        active: type === PhoneLoginInitiateType.Login,
      },
    ],
    [LL.support, isTelegramSupported, isSmsSupported, isWhatsAppSupported, type],
  )

  return (
    <Screen style={styles.screenStyle}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppLogo style={styles.logo} />
          <Text type="h2" style={styles.title}>
            {LL.LoginMethodScreen.title()}
          </Text>
          <OptionSelector
            selected={selected}
            onSelect={handleSelect}
            options={options}
            loading={loadingSupportedCountries}
          />
        </View>

        <View style={styles.bottom}>
          {selected && (
            <GaloyPrimaryButton
              title={loginChanneltitles[selected]}
              onPress={handleSubmit}
              disabled={!selected}
              containerStyle={styles.buttonContainer}
            />
          )}
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 20,
  },
  logo: {
    alignSelf: "center",
    width: "100%",
    height: 80,
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 24,
    color: colors.grey0,
  },
  buttonContainer: {
    marginVertical: 6,
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 10,
  },
}))
