import * as React from "react"
import { useEffect } from "react"
import { Image } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
import { useApolloClient } from "@apollo/client"

import { Screen } from "../../components/screen"
import { palette } from "../../theme/palette"
import KeyStoreWrapper from "../../utils/storage/secureStorage"
import BiometricWrapper from "../../utils/biometricAuthentication"
import type { ScreenType } from "../../types/jsx"
import { AuthenticationScreenPurpose, PinScreenPurpose } from "../../utils/enum"
import { showModalClipboardIfValidPayment } from "../../utils/clipboard"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { StackNavigationProp } from "@react-navigation/stack"

import BitcoinJungleLogo from "../get-started-screen/BitcoinJungleLogo.png"
import useToken from "../../utils/use-token"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  Logo: {
    marginTop: 24,
    maxHeight: "50%",
    maxWidth: "50%",
  },

  container: {
    alignItems: "center",
    flex: 1,
    width: "100%",
  },
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "authenticationCheck">
}

export const AuthenticationCheckScreen: ScreenType = ({ navigation }: Props) => {
  const client = useApolloClient()
  const { hasToken, tokenNetwork } = useToken()
  const { myPubKey, username } = useMainQuery()
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
        navigation.replace("Primary")
        hasToken &&
          showModalClipboardIfValidPayment({
            client,
            network: tokenNetwork,
            myPubKey,
            username,
          })
      }
    })()
  }, [client, hasToken, navigation, tokenNetwork])

  return (
    <Screen
      style={styles.container}
      backgroundColor={palette.offWhite}
      statusBar="light-content"
    >
      <Image style={styles.Logo} source={BitcoinJungleLogo} resizeMode="contain" />
    </Screen>
  )
}
