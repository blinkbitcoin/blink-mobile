import { useEffect, useState } from "react"
import { Keyboard } from "react-native"

import { isIos } from "@app/utils/helper"

/**
 * Whether the system keyboard is on screen. iOS answers as the keyboard starts to move,
 * so layout can follow it; Android only reports once the keyboard has settled.
 */
export const useKeyboardVisible = (): boolean => {
  const [isVisible, setIsVisible] = useState(Keyboard.isVisible())

  useEffect(() => {
    const showSub = Keyboard.addListener(
      isIos ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsVisible(true),
    )
    const hideSub = Keyboard.addListener(
      isIos ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsVisible(false),
    )
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return isVisible
}
