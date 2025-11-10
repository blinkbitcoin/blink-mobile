import * as React from "react"
import { Alert, View } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg"
import AppLogoLightMode from "../../assets/logo/blink-logo-light.svg"
import { Screen } from "../../components/screen"
import useLogout from "../../hooks/use-logout"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import BiometricWrapper from "../../utils/biometricAuthentication"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "../../utils/enum"
import KeyStoreWrapper from "../../utils/storage/secureStorage"

type Props = {
  route: RouteProp<RootStackParamList, "authentication">
}

export const AuthenticationScreen: React.FC<Props> = ({ route }) => {
  const {
    theme: { mode },
  } = useTheme()
  const AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "authentication">>()

  const styles = useStyles()
  const { logout } = useLogout()
  const { screenPurpose, isPinEnabled } = route.params
  const { setAppUnlocked } = useAuthenticationContext()
  const { LL } = useI18nContext()

  const handleAuthenticationSuccess = React.useCallback(async () => {
    if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
      KeyStoreWrapper.resetPinAttempts()
    } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
      KeyStoreWrapper.setIsBiometricsEnabled()
    }
    setAppUnlocked()
    navigation.replace("Primary")
  }, [navigation, screenPurpose, setAppUnlocked])

  const attemptAuthentication = React.useCallback(() => {
    let description = "attemptAuthentication. should not be displayed?"
    if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
      description = LL.AuthenticationScreen.authenticationDescription()
    } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
      description = LL.AuthenticationScreen.setUpAuthenticationDescription()
    }
    // Presents the OS specific authentication prompt
    BiometricWrapper.authenticate(description, handleAuthenticationSuccess, () => {})
  }, [screenPurpose, handleAuthenticationSuccess, LL.AuthenticationScreen])

  React.useEffect(() => {
    attemptAuthentication()
    // only run this on first visit to screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logoutAndNavigateToLanding = async () => {
    await logout()
    Alert.alert(LL.common.logout(), LL.common.loggedOut(), [
      {
        text: LL.common.ok(),
        onPress: () => {
          navigation.replace("getStarted")
        },
      },
    ])
  }

  const confirmLogout = () => {
    Alert.alert(LL.common.confirm(), LL.AuthenticationScreen.confirmLogout(), [
      {
        text: LL.common.cancel(),
      },
      {
        text: LL.common.confirm(),
        onPress: logoutAndNavigateToLanding,
      },
    ])
  }

  let PinButtonContent
  let AlternateContent

  if (isPinEnabled) {
    PinButtonContent = (
      <GaloySecondaryButton
        title={LL.AuthenticationScreen.usePin()}
        onPress={() =>
          navigation.navigate("pin", { screenPurpose: PinScreenPurpose.AuthenticatePin })
        }
        containerStyle={styles.buttonContainer}
      />
    )
  } else {
    PinButtonContent = null
  }

  if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
    AlternateContent = (
      <>
        {PinButtonContent}
        <GaloySecondaryButton
          title={LL.common.logout()}
          onPress={confirmLogout}
          containerStyle={styles.buttonContainer}
        />
      </>
    )
  } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
    AlternateContent = (
      <GaloySecondaryButton
        title={LL.AuthenticationScreen.skip()}
        onPress={() => navigation.replace("Primary")}
        containerStyle={styles.buttonContainer}
      />
    )
  } else {
    AlternateContent = null
  }

  let buttonTitle = ""
  if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
    buttonTitle = LL.AuthenticationScreen.unlock()
  } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
    buttonTitle = LL.AuthenticationScreen.setUp()
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.logoWrapper}>
          <View style={styles.logoContainer}>
            <AppLogo width={"100%"} height={"100%"} />
          </View>
        </View>
        <View style={styles.bottom}>
          <GaloyPrimaryButton
            title={buttonTitle}
            onPress={attemptAuthentication}
            containerStyle={styles.buttonContainer}
          />
          {AlternateContent}
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
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 36,
    width: "100%",
  },
  buttonContainer: {
    marginVertical: 12,
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
