import { useEffect } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { isBackwardAction, RootStackParamList } from "@app/navigation/stack-param-lists"

/** How long a code check may hold the user's ways back: a request that never settles
 *  must not keep them on the screen for good. */
export const CODE_CHECK_HOLD_MS = 20_000

type CodeCheckHoldCallbacks = {
  /** Once the ways back are held. */
  onHold?: () => void
  /** Once they are let go, on the answer or past the time. */
  onRelease?: () => void
}

/**
 * While a code is checked, the user's own ways back are refused: the header arrow and
 * the hardware back through the navigator, and the swipe, which the native stack cannot
 * refuse, switched off. A reset the app dispatches itself, a logout or an account
 * switch, still goes through, and so does the user once a check has taken too long to
 * answer. The callbacks must keep their identity across renders, or the hold restarts.
 */
export const useCodeCheckHold = (
  isChecking: boolean,
  { onHold, onRelease }: CodeCheckHoldCallbacks = {},
): void => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    if (!isChecking) return
    navigation.setOptions({ gestureEnabled: false })
    onHold?.()
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isBackwardAction(event.data.action)) return
      event.preventDefault()
    })
    let isHeld = true
    const release = () => {
      if (!isHeld) return
      isHeld = false
      unsubscribe()
      navigation.setOptions({ gestureEnabled: true })
      onRelease?.()
    }
    const timeout = setTimeout(release, CODE_CHECK_HOLD_MS)
    return () => {
      clearTimeout(timeout)
      release()
    }
  }, [isChecking, navigation, onHold, onRelease])
}
