import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Alert, Text, View } from "react-native"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Button } from "@rn-vui/base"
import { makeStyles } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

import { useUnlockScreen } from "./unlock-screen"

import { Screen } from "../../components/screen"
import useLogout from "../../hooks/use-logout"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { PinScreenPurpose } from "../../utils/enum"
import { sleep } from "../../utils/sleep"
import KeyStoreWrapper from "../../utils/storage/secureStorage"
import { testProps } from "../../utils/testProps"

type Props = {
  route: RouteProp<RootStackParamList, "pin">
}

export const PinScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "pin">>()

  const { logout } = useLogout()
  const {
    screenPurpose,
    isResume = false,
    onChallengeSuccess,
    onChallengeFailure,
  } = route.params
  /** Called for every purpose, deliberately: its side effects are inert outside the app
   *  lock — the back-press swallow is isResume-gated and completeUnlock is only invoked
   *  from the AuthenticatePin branch. Hooks can't be conditional; don't try. */
  const { completeUnlock } = useUnlockScreen({ isResume })
  const { LL } = useI18nContext()
  const [enteredPIN, setEnteredPIN] = useState("")
  const [helperText, setHelperText] = useState(() => {
    if (screenPurpose === PinScreenPurpose.SetPin) return LL.PinScreen.setPin()
    if (screenPurpose === PinScreenPurpose.ChallengePin) return LL.PinScreen.enterPin()
    return ""
  })
  const [previousPIN, setPreviousPIN] = useState("")

  const MAX_PIN_ATTEMPTS = 3

  /** Locked from the moment a 4th digit dispatches a completion handler until the
   *  attempt resolves, so nothing typed mid-decision (or during the lockout's
   *  logout window) can reach a handler that already made its call. */
  const inputLockedRef = useRef(false)

  /** Re-arms the keypad for another attempt; the lockout and success paths
   *  deliberately never call it — the screen is departing. */
  const resetPinInput = () => {
    inputLockedRef.current = false
    setEnteredPIN("")
  }

  const challengeResolvedRef = useRef(false)

  /** Dismissal is a decline: a challenge can be swiped or backed away (gestures stay on
   *  for non-resume pin screens, and the BackHandler swallow is isResume-gated), and the
   *  caller must hear about it exactly once. Success and lockout mark the ref before
   *  they navigate, so the pop they trigger stays silent here. */
  useEffect(() => {
    if (screenPurpose !== PinScreenPurpose.ChallengePin) return
    return navigation.addListener("beforeRemove", (e) => {
      if (challengeResolvedRef.current) return
      challengeResolvedRef.current = true
      /** Only a pop-family removal is the user declining (swipe and header back
       *  dispatch POP, hardware back GO_BACK). A RESET/REPLACE is a removal the
       *  challenge doesn't own — it unmounts the caller too, so a decline
       *  callback would fire into a screen that no longer exists. */
      const actionType = e.data.action.type
      if (
        actionType === "POP" ||
        actionType === "POP_TO_TOP" ||
        actionType === "GO_BACK"
      ) {
        onChallengeFailure?.()
      }
    })
  }, [screenPurpose, navigation, onChallengeFailure])

  /** Shared by the unlock and the challenge: the keystore counter is one budget of three
   *  guesses across both, and exhausting it ends the session the way the app lock does —
   *  failing softly at the cap would hand out a fresh guess per re-entry. */
  const handleWrongPin = async (pinAttempts: number) => {
    if (pinAttempts < MAX_PIN_ATTEMPTS - 1) {
      const newPinAttempts = pinAttempts + 1
      await KeyStoreWrapper.setPinAttempts(newPinAttempts.toString())
      resetPinInput()
      if (newPinAttempts === MAX_PIN_ATTEMPTS - 1) {
        setHelperText(LL.PinScreen.oneAttemptRemaining())
      } else {
        const attemptsRemaining = MAX_PIN_ATTEMPTS - newPinAttempts
        setHelperText(LL.PinScreen.attemptsRemaining({ attemptsRemaining }))
      }
    } else {
      setEnteredPIN("")
      setHelperText(LL.PinScreen.tooManyAttempts())
      try {
        await logout()
        await sleep(1000)
      } catch {
        /** Logout is best-effort here: the lockout's terminal answer is the reset
         *  below, and the challenge path marks challengeResolvedRef before calling
         *  us — a thrown error without the reset would strand the caller waiting
         *  on a callback that can no longer fire. */
      } finally {
        navigation.reset({
          index: 0,
          routes: [{ name: "Primary" }],
        })
      }
    }
  }

  const handleCompletedPinForAuthenticatePin = async (newEnteredPIN: string) => {
    if (newEnteredPIN === (await KeyStoreWrapper.getPinOrEmptyString())) {
      KeyStoreWrapper.resetPinAttempts()
      completeUnlock(() =>
        navigation.reset({
          index: 0,
          routes: [{ name: "Primary" }],
        }),
      )
    } else {
      await handleWrongPin(await KeyStoreWrapper.getPinAttemptsOrZero())
    }
  }

  const handleCompletedPinForChallenge = async (newEnteredPIN: string) => {
    if (newEnteredPIN === (await KeyStoreWrapper.getPinOrEmptyString())) {
      challengeResolvedRef.current = true
      KeyStoreWrapper.resetPinAttempts()
      onChallengeSuccess?.()
      navigation.goBack()
      return
    }
    const pinAttempts = await KeyStoreWrapper.getPinAttemptsOrZero()
    if (pinAttempts >= MAX_PIN_ATTEMPTS - 1) {
      /** The lockout reset unmounts the caller — that is the outcome, so the failure
       *  callback (whose only job is dismissing the gated screen) must stay quiet. */
      challengeResolvedRef.current = true
    }
    await handleWrongPin(pinAttempts)
  }

  const handleCompletedPinForSetPin = (newEnteredPIN: string) => {
    if (previousPIN.length === 0) {
      setPreviousPIN(newEnteredPIN)
      setHelperText(LL.PinScreen.verifyPin())
      resetPinInput()
    } else {
      verifyPINCodeMatches(newEnteredPIN)
    }
  }

  const addDigit = (digit: string) => {
    if (inputLockedRef.current) {
      return
    }
    if (enteredPIN.length < 4) {
      const newEnteredPIN = enteredPIN + digit
      setEnteredPIN(newEnteredPIN)

      if (newEnteredPIN.length === 4) {
        inputLockedRef.current = true
        if (screenPurpose === PinScreenPurpose.AuthenticatePin) {
          handleCompletedPinForAuthenticatePin(newEnteredPIN)
        } else if (screenPurpose === PinScreenPurpose.ChallengePin) {
          handleCompletedPinForChallenge(newEnteredPIN)
        } else if (screenPurpose === PinScreenPurpose.SetPin) {
          handleCompletedPinForSetPin(newEnteredPIN)
        }
      }
    }
  }

  const verifyPINCodeMatches = async (newEnteredPIN: string) => {
    if (previousPIN === newEnteredPIN) {
      if (await KeyStoreWrapper.setPin(previousPIN)) {
        KeyStoreWrapper.resetPinAttempts()
        navigation.goBack()
      } else {
        returnToSetPin()
        Alert.alert(LL.PinScreen.storePinFailed())
      }
    } else {
      returnToSetPin()
    }
  }

  const returnToSetPin = () => {
    setPreviousPIN("")
    setHelperText(LL.PinScreen.setPinFailedMatch())
    resetPinInput()
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
    <Screen style={styles.container}>
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
              {...testProps("pin-backspace")}
              buttonStyle={styles.pinPadButton}
              icon={<GaloyIcon name="arrow-left" size={32} color="white" />}
              onPress={() => {
                if (!inputLockedRef.current) {
                  setEnteredPIN(enteredPIN.slice(0, -1))
                }
              }}
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

  pinPadRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: "10%",
  },

  topSpacer: {
    flex: 1,
  },
}))
