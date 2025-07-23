import React from "react"
import { Pressable, TouchableOpacity, View } from "react-native"

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
import AppLogoLightMode from "../../assets/logo/app-logo-light.svg"
import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { PhoneLoginInitiateType } from "../phone-auth-screen"
import useAppCheckToken from "./use-device-token"

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
      action: "log_in",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })
    navigation.navigate("acceptTermsAndConditions", { flow: "phone" })
  }

  const handleLoginWithPhone = () => {
    logGetStartedAction({
      action: "log_in",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })
    navigation.navigate("phoneFlow", {
      screen: "phoneLoginInitiate",
      params: { type: PhoneLoginInitiateType.Login },
    })
  }

  const handleExploreWallet = () => {
    logGetStartedAction({
      action: "explore_wallet",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })
    navigation.navigate("Primary")
  }

  const handleCreateDeviceAccount = async () => {
    logGetStartedAction({
      action: "create_device_account",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })

    navigation.navigate("acceptTermsAndConditions", { flow: "trial" })
  }

  const handleLoginWithEmail = async () => {
    logGetStartedAction({
      action: "login_with_email",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })

    navigation.navigate("emailLoginInitiate")
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
    <Screen>
      {NonProdInstanceHint}
      <Pressable
        onPress={() => setSecretMenuCounter(secretMenuCounter + 1)}
        style={styles.logoContainer}
        {...testProps("logo-button")}
      >
        <AppLogo width={"100%"} height={"100%"} />
      </Pressable>
      <View style={styles.bottom}>
        <GaloyPrimaryButton
          title={LL.GetStartedScreen.createAccount()}
          onPress={() => handleCreateAccount()}
          containerStyle={styles.buttonContainer}
        />
        {appCheckToken ? (
          <GaloySecondaryButton
            title={LL.GetStartedScreen.startTrialAccount()}
            onPress={handleCreateDeviceAccount}
          />
        ) : (
          <GaloySecondaryButton
            title={LL.GetStartedScreen.exploreWallet()}
            onPress={handleExploreWallet}
          />
        )}
        <View style={styles.loginFooterContainer}>
          <Text type="p2">{LL.GetStartedScreen.logBackInWith()} </Text>
          <TouchableOpacity activeOpacity={0.5} onPress={handleLoginWithPhone}>
            <Text type="p2" style={styles.buttonText}>
              {LL.common.phone()}
            </Text>
          </TouchableOpacity>
          <Text type="p2"> {LL.common.or()} </Text>
          <TouchableOpacity
            activeOpacity={0.5}
            onPress={handleLoginWithEmail}
            {...testProps("email-button")}
          >
            <Text type="p2" style={styles.buttonText}>
              {LL.common.email()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  bottom: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "flex-end",
    marginBottom: 36,
  },

  buttonContainer: {
    marginVertical: 6,
  },

  logoContainer: { width: "100%", height: "50%", marginTop: 50 },

  loginFooterContainer: {
    marginTop: 24,
    justifyContent: "center",
    flexDirection: "row",
  },

  textInstance: {
    justifyContent: "center",
    flexDirection: "row",
    textAlign: "center",
    marginTop: 24,
    marginBottom: -24,
  },

  buttonText: {
    textDecorationLine: "underline",
  },
}))
