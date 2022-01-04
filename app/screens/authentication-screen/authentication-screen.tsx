import * as React from "react"
import { RouteProp, useFocusEffect } from "@react-navigation/native"
import { Alert, Image, View } from "react-native"
import { Button } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import { useApolloClient } from "@apollo/client"

import { Screen } from "../../components/screen"
import { color } from "../../theme"
import { palette } from "../../theme/palette"
import { translate } from "../../i18n"
import KeyStoreWrapper from "../../utils/storage/secureStorage"
import BiometricWrapper from "../../utils/biometricAuthentication"
import type { ScreenType } from "../../types/jsx"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "../../utils/enum"
import { showModalClipboardIfValidPayment } from "../../utils/clipboard"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { StackNavigationProp } from "@react-navigation/stack"
import useToken from "../../utils/use-token"

import BitcoinJungleLogo from "../get-started-screen/BitcoinJungleLogo.png"
import useLogout from "../../hooks/use-logout"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  Logo: {
    marginTop: 24,
    maxHeight: "50%",
    maxWidth: "50%",
  },

  bottom: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 36,
    width: "100%",
  },

  button: {
    backgroundColor: palette.white,
    borderRadius: 24,
  },

  buttonAlternate: {
    backgroundColor: palette.lightBlue,
    borderRadius: 24,
  },

  buttonAlternateTitle: {
    color: palette.white,
  },

  buttonContainer: {
    marginVertical: 12,
    width: "80%",
  },

  buttonTitle: {
    color: color.primary,
    fontWeight: "bold",
  },

  container: {
    alignItems: "center",
    flex: 1,
    width: "100%",
  },
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "authentication">
  route: RouteProp<RootStackParamList, "authentication">
}

export const AuthenticationScreen: ScreenType = ({ route, navigation }: Props) => {
  const client = useApolloClient()
  const { hasToken, tokenNetwork } = useToken()
  const { logout } = useLogout()
  const { myPubKey, username } = useMainQuery()
  const { screenPurpose, isPinEnabled } = route.params

  useFocusEffect(() => {
    attemptAuthentication()
  })

  const attemptAuthentication = () => {
    let description
    if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
      description = translate("AuthenticationScreen.authenticationDescription")
    } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
      description = translate("AuthenticationScreen.setUpAuthenticationDescription")
    }
    // Presents the OS specific authentication prompt
    BiometricWrapper.authenticate(
      description,
      handleAuthenticationSuccess,
      handleAuthenticationFailure,
    )
  }

  const handleAuthenticationSuccess = async () => {
    if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
      KeyStoreWrapper.resetPinAttempts()
    } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
      KeyStoreWrapper.setIsBiometricsEnabled()
    }
    navigation.replace("Primary")
    hasToken &&
      showModalClipboardIfValidPayment({
        client,
        network: tokenNetwork,
        myPubKey,
        username,
      })
  }

  const handleAuthenticationFailure = () => {
    // This is called when a user cancels or taps out of the authentication prompt,
    // so no action is necessary.
  }

  const logoutAndNavigateToPrimary = async () => {
    await logout()
    Alert.alert(translate("common.loggedOut"), "", [
      {
        text: translate("common.ok"),
        onPress: () => {
          navigation.replace("Primary")
        },
      },
    ])
  }

  let pinButtonContent
  let alternateContent

  if (isPinEnabled) {
    pinButtonContent = (
      <Button
        title={translate("AuthenticationScreen.usePin")}
        buttonStyle={styles.buttonAlternate}
        titleStyle={styles.buttonAlternateTitle}
        onPress={() =>
          navigation.navigate("pin", { screenPurpose: PinScreenPurpose.AuthenticatePin })
        }
        containerStyle={styles.buttonContainer}
      />
    )
  } else {
    pinButtonContent = null
  }

  if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
    alternateContent = (
      <>
        {pinButtonContent}
        <Button
          title={translate("common.logout")}
          buttonStyle={styles.buttonAlternate}
          titleStyle={styles.buttonAlternateTitle}
          onPress={() => logoutAndNavigateToPrimary()}
          containerStyle={styles.buttonContainer}
        />
      </>
    )
  } else if (screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication) {
    alternateContent = (
      <Button
        title={translate("AuthenticationScreen.skip")}
        buttonStyle={styles.buttonAlternate}
        titleStyle={styles.buttonAlternateTitle}
        onPress={() => navigation.replace("Primary")}
        containerStyle={styles.buttonContainer}
      />
    )
  } else {
    alternateContent = null
  }

  return (
    <Screen
      style={styles.container}
      backgroundColor={palette.offWhite}
      statusBar="light-content"
    >
      <Image style={styles.Logo} source={BitcoinJungleLogo} resizeMode="contain" />
      <View style={styles.bottom}>
        <Button
          title={(() => {
            if (screenPurpose === AuthenticationScreenPurpose.Authenticate) {
              return translate("AuthenticationScreen.unlock")
            } else if (
              screenPurpose === AuthenticationScreenPurpose.TurnOnAuthentication
            ) {
              return translate("AuthenticationScreen.setUp")
            } else {
              return ""
            }
          })()}
          buttonStyle={styles.button}
          titleStyle={styles.buttonTitle}
          onPress={() => attemptAuthentication()}
          containerStyle={styles.buttonContainer}
        />
        {alternateContent}
      </View>
    </Screen>
  )
}
