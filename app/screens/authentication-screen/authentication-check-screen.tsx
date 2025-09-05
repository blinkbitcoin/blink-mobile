import * as React from "react"
import { useEffect } from "react"
import { View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { useApolloClient } from "@apollo/client"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { updateDeviceSessionCount } from "@app/graphql/client-only-query"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"

import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg"
import AppLogoLightMode from "../../assets/logo/blink-logo-light.svg"
import { Screen } from "../../components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import BiometricWrapper from "../../utils/biometricAuthentication"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "../../utils/enum"
import KeyStoreWrapper from "../../utils/storage/secureStorage"

export const AuthenticationCheckScreen: React.FC = () => {
  const client = useApolloClient()
  const styles = useStyles()
  const {
    theme: { mode },
  } = useTheme()
  const AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "authenticationCheck">>()
  const isAuthed = useIsAuthed()
  const { setAppUnlocked } = useAuthenticationContext()

  useEffect(() => {
    ;(async () => {
      const isPinEnabled = await KeyStoreWrapper.getIsPinEnabled()

      if (
        (await BiometricWrapper.isSensorAvailable()) &&
        (await KeyStoreWrapper.getIsBiometricsEnabled())
      ) {
        navigation.replace("authentication", {
          screenPurpose: AuthenticationScreenPurpose.Authenticate,
          isPinEnabled,
        })
      } else if (isPinEnabled) {
        navigation.replace("pin", { screenPurpose: PinScreenPurpose.AuthenticatePin })
      } else {
        setAppUnlocked()
        updateDeviceSessionCount(client)
        navigation.replace("Primary")
      }
    })()
  }, [isAuthed, navigation, setAppUnlocked, client])

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.logoWrapper}>
          <View style={styles.logoContainer}>
            <AppLogo width={"100%"} height={"100%"} />
          </View>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
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
  },
  logoContainer: {
    width: 288,
    height: 288,
  },
}))
