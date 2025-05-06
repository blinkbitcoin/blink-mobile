import * as React from "react"
import { useEffect, useState } from "react"
import { Alert, StatusBar, Text, View } from "react-native"
import { Button, Icon } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
// import Icon from "react-native-vector-icons/Feather"
import { useApolloClient } from "@apollo/client"

import { Screen } from "../../components/screen"
import { palette } from "../../theme/palette"
import { translate } from "../../i18n"
import KeyStoreWrapper from "../../utils/storage/secureStorage"
import type { ScreenType } from "../../types/jsx"
import { PinScreenPurpose } from "../../utils/enum"
import { sleep } from "../../utils/sleep"
import { showModalClipboardIfValidPayment } from "../../utils/clipboard"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp } from "@react-navigation/native"
import useToken from "../../utils/use-token"
import useLogout from "../../hooks/use-logout"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  bottomSpacer: {
    flex: 1,
  },

  circleContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
  },

  circles: {
    flex: 2,
    flexDirection: "row",
  },

  container: {
    alignItems: "center",
    flex: 1,
    width: "100%",
  },

  emptyCircle: {
    backgroundColor: palette.lightBlue,
    borderColor: palette.white,
    borderRadius: 16 / 2,
    borderWidth: 2,
    height: 16,
    width: 16,
  },

  filledCircle: {
    backgroundColor: palette.white,
    borderRadius: 16 / 2,
    height: 16,
    width: 16,
  },

  helperText: {
    color: palette.white,
    fontSize: 20,
  },

  helperTextContainer: {
    flex: 1,
  },

  pinPad: {
    alignItems: "center",
    flexDirection: "column",
    flex: 6,
  },

  pinPadButton: {
    backgroundColor: palette.lightBlue,
    flex: 1,
    height: "95%",
    width: "95%",
  },

  pinPadButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 100,
  },

  pinPadButtonIcon: {
    color: palette.white,
    fontSize: 32,
    marginRight: "20%",
  },

  pinPadButtonTitle: {
    color: palette.white,
    fontSize: 26,
    fontWeight: "bold",
    marginLeft: "40%",
    marginRight: "40%",
  },

  pinPadRow: {
    flex: 1,
    flexDirection: "row",
    marginLeft: 32,
    marginRight: 32,
  },

  topSpacer: {
    flex: 1,
  },
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "pin">
  route: RouteProp<RootStackParamList, "pin">
}

export const PinScreen: ScreenType = ({ route, navigation }: Props) => {
  const client = useApolloClient()
  const { hasToken, tokenNetwork } = useToken()
  const { logout } = useLogout()
  const { myPubKey, username } = useMainQuery()
  const { screenPurpose } = route.params

  const [enteredPIN, setEnteredPIN] = useState("")
  const [helperText, setHelperText] = useState(
    screenPurpose === PinScreenPurpose.SetPin ? translate("PinScreen.setPin") : "",
  )
  const [previousPIN, setPreviousPIN] = useState("")
  const [pinAttempts, setPinAttempts] = useState(0)

  const MAX_PIN_ATTEMPTS = 3

  useEffect(() => {
    ;(async () => {
      setPinAttempts(await KeyStoreWrapper.getPinAttemptsOrZero())
    })()
  }, [])

  const handleCompletedPinForAuthenticatePin = async (newEnteredPIN: string) => {
    if (newEnteredPIN === (await KeyStoreWrapper.getPinOrEmptyString())) {
      KeyStoreWrapper.resetPinAttempts()
      navigation.reset({
        index: 0,
        routes: [{ name: "Primary" }],
      })
      hasToken &&
        showModalClipboardIfValidPayment({
          client,
          network: tokenNetwork,
          myPubKey,
          username,
        })
    } else {
      if (pinAttempts < MAX_PIN_ATTEMPTS - 1) {
        const newPinAttempts = pinAttempts + 1
        KeyStoreWrapper.setPinAttempts(newPinAttempts.toString())
        setPinAttempts(newPinAttempts)
        setEnteredPIN("")
        if (newPinAttempts === MAX_PIN_ATTEMPTS - 1) {
          setHelperText(translate("PinScreen.oneAttemptRemaining"))
        } else {
          const attemptsRemaining = MAX_PIN_ATTEMPTS - newPinAttempts
          setHelperText(translate("PinScreen.attemptsRemaining", { attemptsRemaining }))
        }
      } else {
        setHelperText(translate("PinScreen.tooManyAttempts"))
        await logout()
        await sleep(1000)
        navigation.reset({
          index: 0,
          routes: [{ name: "Primary" }],
        })
      }
    }
  }

  const handleCompletedPinForSetPin = (newEnteredPIN: string) => {
    if (previousPIN.length === 0) {
      setPreviousPIN(newEnteredPIN)
      setHelperText(translate("PinScreen.verifyPin"))
      setEnteredPIN("")
    } else {
      verifyPINCodeMathes(newEnteredPIN)
    }
  }

  const addDigit = (digit: string) => {
    if (enteredPIN.length < 4) {
      const newEnteredPIN = enteredPIN + digit
      setEnteredPIN(newEnteredPIN)

      if (newEnteredPIN.length === 4) {
        if (screenPurpose === PinScreenPurpose.AuthenticatePin) {
          handleCompletedPinForAuthenticatePin(newEnteredPIN)
        } else if (screenPurpose === PinScreenPurpose.SetPin) {
          handleCompletedPinForSetPin(newEnteredPIN)
        }
      }
    }
  }

  const verifyPINCodeMathes = async (newEnteredPIN: string) => {
    if (previousPIN === newEnteredPIN) {
      if (await KeyStoreWrapper.setPin(previousPIN)) {
        KeyStoreWrapper.resetPinAttempts()
        navigation.goBack()
      } else {
        returnToSetPin()
        Alert.alert(translate("PinScreen.storePinFailed"))
      }
    } else {
      returnToSetPin()
    }
  }

  const returnToSetPin = () => {
    setPreviousPIN("")
    setHelperText(translate("PinScreen.setPinFailedMatch"))
    setEnteredPIN("")
  }

  const circleComponentForDigit = (digit: number) => {
    return (
      <View style={styles.circleContainer}>
        <View
          style={enteredPIN.length > digit ? styles.filledCircle : styles.emptyCircle}
        />
      </View>
    )
  }

  const buttonComponentForDigit = (digit: string) => {
    return (
      <View style={styles.pinPadButtonContainer}>
        <Button
          buttonStyle={styles.pinPadButton}
          titleStyle={styles.pinPadButtonTitle}
          title={digit}
          onPress={() => addDigit(digit)}
        />
      </View>
    )
  }

  return (
    <Screen style={styles.container} backgroundColor={palette.lightBlue}>
      <StatusBar backgroundColor={palette.lightBlue} barStyle="light-content" />
      <View style={styles.topSpacer} />
      <View style={styles.circles}>
        {circleComponentForDigit(0)}
        {circleComponentForDigit(1)}
        {circleComponentForDigit(2)}
        {circleComponentForDigit(3)}
      </View>
      <View style={styles.helperTextContainer}>
        <Text style={styles.helperText}>{helperText}</Text>
      </View>
      <View style={styles.pinPad}>
        <View style={styles.pinPadRow}>
          {buttonComponentForDigit("1")}
          {buttonComponentForDigit("2")}
          {buttonComponentForDigit("3")}
        </View>
        <View style={styles.pinPadRow}>
          {buttonComponentForDigit("4")}
          {buttonComponentForDigit("5")}
          {buttonComponentForDigit("6")}
        </View>
        <View style={styles.pinPadRow}>
          {buttonComponentForDigit("7")}
          {buttonComponentForDigit("8")}
          {buttonComponentForDigit("9")}
        </View>
        <View style={styles.pinPadRow}>
          <View style={styles.pinPadButtonContainer} />
          {buttonComponentForDigit("0")}
          <View style={styles.pinPadButtonContainer}>
            <Button
              buttonStyle={styles.pinPadButton}
              icon={<Icon style={styles.pinPadButtonIcon} name="delete" />}
              onPress={() => setEnteredPIN(enteredPIN.slice(0, -1))}
            />
          </View>
        </View>
      </View>
      <View style={styles.bottomSpacer} />
    </Screen>
  )
}
