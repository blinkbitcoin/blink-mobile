import { useCallback } from "react"
import { BackHandler } from "react-native"

import { useFocusEffect } from "@react-navigation/native"

/** Intercepts the Android hardware back while the screen is focused: the migration
 *  has no return path from the commit point, so back either no-ops or redirects. */
export const useHardwareBackGuard = (onBack?: () => void) => {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        onBack?.()
        return true
      })
      return () => subscription.remove()
    }, [onBack]),
  )
}
