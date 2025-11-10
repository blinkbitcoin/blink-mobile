import React from "react"
import { Pressable, View } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { logGetStartedAction } from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg"
import AppLogoLightMode from "../../assets/logo/blink-logo-light.svg"
import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import useAppCheckToken from "./use-device-token"
import { PhoneLoginInitiateType } from "../phone-auth-screen"

export const GetStartedScreen: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "getStarted">>()

  const styles = useStyles()

  const [secretMenuCounter, setSecretMenuCounter] = React.useState(0)
  React.useEffect(() => {
    if (secretMenuCounter > 2) {
      navigation.navigate("developerScreen")
      setSecretMenuCounter(0)
    }
  }, [navigation, secretMenuCounter])

  const {
    theme: { mode },
  } = useTheme()
  const AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode

  const { LL } = useI18nContext()

  const { deviceAccountEnabled } = useFeatureFlags()

  const appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled })

  const handleCreateAccount = () => {
    logGetStartedAction({
      action: "create_device_account",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })

    navigation.navigate("acceptTermsAndConditions", { flow: "trial" })
  }

  const handleLogin = () => {
    logGetStartedAction({
      action: "log_in",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })
    navigation.navigate("login", {
      type: PhoneLoginInitiateType.Login,
    })
  }

  const {
    appConfig: {
      galoyInstance: { id },
    },
  } = useAppConfig()

  const NonProdInstanceHint =
    id === "Main" ? null : (
      <View style={styles.textInstance}>
        <Text type={"h2"} color={theme.darkColors?._orange}>
          {id}
        </Text>
      </View>
    )

  return (
    <Screen headerShown={false}>
      <View style={styles.container}>
        {NonProdInstanceHint}
        <View style={styles.logoWrapper} pointerEvents="box-none">
          <Pressable
            onPress={() => setSecretMenuCounter(secretMenuCounter + 1)}
            style={styles.logoContainer}
            {...testProps("logo-button")}
          >
            <AppLogo width={"100%"} height={"100%"} />
          </Pressable>
        </View>
        <View style={styles.bottom}>
          <GaloyPrimaryButton
            title={LL.GetStartedScreen.createAccount()}
            onPress={handleCreateAccount}
          />
          <GaloySecondaryButton
            title={LL.GetStartedScreen.login()}
            onPress={handleLogin}
            containerStyle={styles.secondaryButtonContainer}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
  bottom: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "flex-end",
  },

  secondaryButtonContainer: {
    marginVertical: 15,
  },
  logoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  logoContainer: {
    width: 288,
    height: 288,
  },
  textInstance: {
    justifyContent: "center",
    flexDirection: "row",
    textAlign: "center",
    marginTop: 24,
    marginBottom: -24,
  },
}))
