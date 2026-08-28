import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, Text, TouchableOpacity, View } from "react-native"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSafeAreaInsets } from "react-native-safe-area-context"
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

/** Distance from the screen's top-left corner to the dismiss control. */
const DISMISS_INSET = 16

export const PinScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "pin">>()
  const insets = useSafeAreaInsets()

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
  const isAuthenticate = screenPurpose === PinScreenPurpose.AuthenticatePin
  const isChallenge = screenPurpose === PinScreenPurpose.ChallengePin
  /** Both purposes verify a PIN the user already set, so both answer to the one
   *  shared attempt budget and its escalating lockout. Only SetPin is exempt —
   *  there is nothing to be wrong about yet. */
  const isVerifyingExistingPin = isAuthenticate || isChallenge
  /** Settings jobs and a caller's challenge are both dismissable — the back
   *  gesture already leaves them, and this is its visible counterpart on the
   *  screen, which carries no header to go back with — the route is pushed, not
   *  presented as a modal, so it reads as back rather than dismiss. The app lock
   *  renders none: a way out of it is the one thing it must not offer. */
  const isDismissable = !isAuthenticate
  const [enteredPIN, setEnteredPIN] = useState("")
  const [helperText, setHelperText] = useState(() => {
    if (screenPurpose === PinScreenPurpose.SetPin) return LL.PinScreen.setPin()
    if (isChallenge) return LL.PinScreen.enterPin()
    return ""
  })
  const [previousPIN, setPreviousPIN] = useState("")
  const challengeResolvedRef = useRef(false)

  /** Dismissal is a decline: a challenge can be swiped or backed away (gestures stay on
   *  for non-resume pin screens, and the BackHandler swallow is isResume-gated), and the
   *  caller must hear about it exactly once. Success and lockout mark the ref before
   *  they navigate, so the pop they trigger stays silent here. */
  useEffect(() => {
    if (!isChallenge) return undefined
    return navigation.addListener("beforeRemove", (e) => {
      if (challengeResolvedRef.current) return
      challengeResolvedRef.current = true
      /** Only a pop-family removal is the user declining (swipe and header back
       *  dispatch POP, hardware back GO_BACK). A RESET is a removal the challenge
       *  doesn't own — the lockout's logout unmounts the caller too, so a decline
       *  callback would fire into a screen that no longer exists. */
      const actionType = e.data.action.type
      const isPopFamilyRemoval =
        actionType === "POP" || actionType === "POP_TO_TOP" || actionType === "GO_BACK"
      if (!isPopFamilyRemoval) return
      /** Deferred: this listener runs inside the removing pop's dispatch, so a
       *  goBack the caller issues in response would coalesce with the pop
       *  already in flight and be swallowed — stranding the caller on its
       *  pending screen. Next tick, the stack has settled and it pops cleanly. */
      setTimeout(() => onChallengeFailure?.(), 0)
    })
  }, [isChallenge, navigation, onChallengeFailure])

  /** Set only on the terminal outcomes, where the screen is about to go away. */
  const [farewellText, setFarewellText] = useState("")
  /** A transient notice that is about the storage, not about the entry, so it
   *  gets its own line instead of replacing the attempts-remaining one. */
  const [noticeText, setNoticeText] = useState("")

  const endSession = useCallback(
    async (message: string) => {
      setEnteredPIN("")
      setFarewellText(message)
      try {
        await logout()
        await sleep(1000)
      } catch {
        /** Swallowed, not rethrown: usePinLockout awaits this from a floating
         *  promise, so a rejection would surface as an unhandled one. */
      } finally {
        /** In a finally so a rejected logout cannot strand the screen. A
         *  challenge caller is already marked resolved by the removal this
         *  reset performs, so a screen that never left would leave it waiting
         *  on a callback that can no longer fire. */
        navigation.reset({
          index: 0,
          routes: [{ name: "Primary" }],
        })
      }
    },
    [logout, navigation],
  )

  /** The challenge's success answer: tell the caller before leaving, and mark it
   *  resolved so the pop this triggers is not also read as a decline. */
  const resolveChallenge = () => {
    challengeResolvedRef.current = true
    onChallengeSuccess?.()
    navigation.goBack()
  }

  const lockout = usePinLockout({
    enabled: isVerifyingExistingPin,
    onUnlocked: () => {
      /** A challenge answers its caller and steps back; it must never unlock the
       *  app, which is a different question that this screen was not asked. */
      if (isChallenge) {
        resolveChallenge()
        return
      }
      completeUnlock(() =>
        navigation.reset({
          index: 0,
          routes: [{ name: "Primary" }],
        }),
      )
    },
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

    if (isVerifyingExistingPin) {
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
    if (!isVerifyingExistingPin) return helperText
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
      {/* Last child on purpose: an absolute view earlier in the tree is painted
          under, and hit-tested behind, every sibling that follows it — and the
          top spacer covers exactly the corner this sits in. */}
      {isDismissable ? (
        <TouchableOpacity
          style={[styles.dismiss, { top: insets.top + DISMISS_INSET }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={LL.common.back()}
          testID="pinScreenDismiss"
        >
          {/* caret-left at 20, the same back affordance the webview header uses.
              Not arrow-left: that glyph is the backspace on this very keypad. */}
          <GaloyIcon name="caret-left" size={20} color="white" />
        </TouchableOpacity>
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  bottomSpacer: {
    flex: 1,
  },

  /** Absolute, so adding it cannot shift the keypad's flex layout. The screen is
   *  header-less by design, so this sits where a header back would — and the
   *  safe-area top inset is added at render, because this Screen's SafeAreaView
   *  does not pad the top edge and the corner is where a notch lands. */
  dismiss: {
    position: "absolute",
    left: DISMISS_INSET,
    padding: 8,
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
