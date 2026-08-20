import * as React from "react"
import { useCallback, useState } from "react"
import { Alert, Text, View } from "react-native"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Button } from "@rn-vui/base"
import { makeStyles } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

import { useUnlockScreen } from "./unlock-screen"
import { usePinLockout } from "./use-pin-lockout"

import { Screen } from "../../components/screen"
import useLogout from "../../hooks/use-logout"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { PinScreenPurpose } from "../../utils/enum"
import { sleep } from "../../utils/sleep"
import KeyStoreWrapper from "../../utils/storage/secureStorage"

type Props = {
  route: RouteProp<RootStackParamList, "pin">
}

/** The number of digits an entry holds, and so the number of circles above the
 *  keypad. One name for what used to be three separate literals. */
const PIN_LENGTH = 4

export const PinScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "pin">>()

  const { logout } = useLogout()
  const { screenPurpose, isResume = false } = route.params
  const { completeUnlock } = useUnlockScreen({ isResume })
  const { LL } = useI18nContext()
  const isAuthenticate = screenPurpose === PinScreenPurpose.AuthenticatePin
  const [enteredPIN, setEnteredPIN] = useState("")
  const [helperText, setHelperText] = useState(
    screenPurpose === PinScreenPurpose.SetPin ? LL.PinScreen.setPin() : "",
  )
  const [previousPIN, setPreviousPIN] = useState("")
  /** Set only on the terminal outcomes, where the screen is about to go away. */
  const [farewellText, setFarewellText] = useState("")
  /** A transient notice that is about the storage, not about the entry, so it
   *  gets its own line instead of replacing the attempts-remaining one. */
  const [noticeText, setNoticeText] = useState("")

  const endSession = useCallback(
    async (message: string) => {
      setEnteredPIN("")
      setFarewellText(message)
      await logout()
      await sleep(1000)
      navigation.reset({
        index: 0,
        routes: [{ name: "Primary" }],
      })
    },
    [logout, navigation],
  )

  const lockout = usePinLockout({
    enabled: isAuthenticate,
    onUnlocked: () =>
      completeUnlock(() =>
        navigation.reset({
          index: 0,
          routes: [{ name: "Primary" }],
        }),
      ),
    onWrongPin: () => setEnteredPIN(""),
    onUnreadable: () => {
      setEnteredPIN("")
      setNoticeText(LL.PinScreen.pinUnreadable())
    },
    onExhausted: () => endSession(LL.PinScreen.tooManyAttempts()),
    onUnrecorded: () => endSession(LL.PinScreen.lockoutUnavailable()),
  })

  const handleCompletedPinForSetPin = (newEnteredPIN: string) => {
    if (previousPIN.length === 0) {
      setPreviousPIN(newEnteredPIN)
      setHelperText(LL.PinScreen.verifyPin())
      setEnteredPIN("")
    } else {
      verifyPINCodeMatches(newEnteredPIN)
    }
  }

  const addDigit = (digit: string) => {
    if (!lockout.canAcceptInput()) return
    if (enteredPIN.length >= PIN_LENGTH) return

    setNoticeText("")
    const newEnteredPIN = enteredPIN + digit
    setEnteredPIN(newEnteredPIN)
    if (newEnteredPIN.length < PIN_LENGTH) return

    if (isAuthenticate) {
      lockout.submit(newEnteredPIN)
    } else if (screenPurpose === PinScreenPurpose.SetPin) {
      handleCompletedPinForSetPin(newEnteredPIN)
    }
  }

  // Asks the guard rather than relying on the button's `disabled` prop: that
  // prop comes from a render that may predate the verification in flight,
  // which is exactly how a backspace used to slip a second attempt through.
  const removeDigit = () => {
    if (!lockout.canAcceptInput()) return
    setEnteredPIN((pin) => pin.slice(0, -1))
  }

  const verifyPINCodeMatches = async (newEnteredPIN: string) => {
    if (previousPIN !== newEnteredPIN) {
      returnToSetPin()
      return
    }

    await lockout.runGuarded(async () => {
      if (await KeyStoreWrapper.setPin(previousPIN)) {
        await KeyStoreWrapper.clearPinFailureState()
        navigation.goBack()
      } else {
        returnToSetPin()
        Alert.alert(LL.PinScreen.storePinFailed())
      }
    })
  }

  const returnToSetPin = () => {
    setPreviousPIN("")
    setHelperText(LL.PinScreen.setPinFailedMatch())
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
          disabled={lockout.isInputDisabled}
          disabledStyle={styles.pinPadButton}
          disabledTitleStyle={styles.pinPadButtonTitleDisabled}
          title={digit}
          onPress={() => addDigit(digit)}
        />
      </View>
    )
  }

  // The attempt count is derived from what the lockout hook read back from
  // storage, so it survives a relaunch instead of living in its own state.
  const attemptsText = () => {
    if (farewellText) return farewellText
    if (!isAuthenticate) return helperText
    if (lockout.attemptsRemaining === null) return helperText
    return lockout.attemptsRemaining === 1
      ? LL.PinScreen.oneAttemptRemaining()
      : LL.PinScreen.attemptsRemaining({
          attemptsRemaining: lockout.attemptsRemaining,
        })
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.topSpacer} />
      <View style={styles.circles}>
        {Array.from({ length: PIN_LENGTH }, (_, digit) => (
          <React.Fragment key={digit}>{circleComponentForDigit(digit)}</React.Fragment>
        ))}
      </View>
      <View style={styles.helperTextContainer}>
        {/* Both lines, so a countdown never hides how many tries are left. */}
        <Text style={styles.helperText}>{attemptsText()}</Text>
        {noticeText ? <Text style={styles.helperText}>{noticeText}</Text> : null}
        {lockout.isLocked ? (
          <Text style={styles.helperText}>
            {LL.PinScreen.tryAgainIn({ seconds: lockout.remainingSeconds })}
          </Text>
        ) : null}
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
              testID="pinPadBackspace"
              buttonStyle={styles.pinPadButton}
              disabled={lockout.isInputDisabled}
              disabledStyle={styles.pinPadButton}
              icon={<GaloyIcon name="arrow-left" size={32} color="white" />}
              onPress={removeDigit}
            />
          </View>
        </View>
      </View>
      <View style={styles.bottomSpacer} />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  bottomSpacer: {
    flex: 1,
  },

  circleContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "25%",
  },

  circles: {
    flex: 2,
    flexDirection: "row",
    width: "33.33%",
  },

  container: {
    alignItems: "center",
    flex: 1,
    width: "100%",
    backgroundColor: colors.primary,
  },

  emptyCircle: {
    backgroundColor: colors.primary,
    borderColor: colors.white,
    borderRadius: 16 / 2,
    borderWidth: 2,
    height: 16,
    width: 16,
  },

  filledCircle: {
    backgroundColor: colors.white,
    borderRadius: 16 / 2,
    height: 16,
    width: 16,
  },

  helperText: {
    color: colors.white,
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
    backgroundColor: colors.primary,
    width: "100%",
    height: "100%",
  },

  pinPadButtonContainer: {
    width: "33.33%",
  },

  pinPadButtonIcon: {
    color: colors.white,
    fontSize: 32,
  },

  pinPadButtonTitle: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "500",
  },

  pinPadButtonTitleDisabled: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "500",
    opacity: 0.4,
  },

  pinPadRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: "10%",
  },

  topSpacer: {
    flex: 1,
  },
}))
