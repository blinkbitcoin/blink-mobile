import * as React from "react"

import type { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"

type SecretMenuNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "getStarted" | "settings"
>

const SECRET_MENU_TAP_THRESHOLD = 3

/**
 * Returns an onPress handler that opens the developer screen after
 * SECRET_MENU_TAP_THRESHOLD presses. Two independent __DEV__ gates keep it
 * inert in release builds: the handler itself no-ops (so taps never dispatch
 * a navigate that react-navigation would drop with an unhandled-action
 * error), and root-navigator only registers the route in dev builds.
 *
 * The count lives in a ref, not state — it is never rendered, and taps must
 * not re-render the host screen.
 */
export const useSecretMenuTrigger = () => {
  const { navigate } = useNavigation<SecretMenuNavigationProp>()
  const tapCount = React.useRef(0)

  return React.useCallback(() => {
    if (!__DEV__) {
      return
    }
    tapCount.current += 1
    if (tapCount.current >= SECRET_MENU_TAP_THRESHOLD) {
      tapCount.current = 0
      navigate("developerScreen")
    }
  }, [navigate])
}
