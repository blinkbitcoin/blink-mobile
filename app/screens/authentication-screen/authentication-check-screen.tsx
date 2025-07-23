import * as React from "react"
import { useEffect } from "react"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg"
import AppLogoLightMode from "../../assets/logo/app-logo-light.svg"
import { Screen } from "../../components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import BiometricWrapper from "../../utils/biometricAuthentication"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "../../utils/enum"
import KeyStoreWrapper from "../../utils/storage/secureStorage"

export const AuthenticationCheckScreen: React.FC = () => {
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
        navigation.replace("Primary")
      }
    })()
  }, [isAuthed, navigation, setAppUnlocked])

  return (
    <Screen style={styles.container}>
      <AppLogo width={"100%"} height={"60%"} />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    alignItems: "center",
    flex: 1,
    width: "100%",
  },
}))
