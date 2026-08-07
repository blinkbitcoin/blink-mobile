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
 * SECRET_MENU_TAP_THRESHOLD presses. Gated to development builds: in release
 * builds the developer screen route is not registered, so the trigger is inert.
 */
export const useSecretMenuTrigger = () => {
  const { navigate } = useNavigation<SecretMenuNavigationProp>()
  const [tapCount, setTapCount] = React.useState(0)

  React.useEffect(() => {
    if (__DEV__ && tapCount >= SECRET_MENU_TAP_THRESHOLD) {
      navigate("developerScreen")
      setTapCount(0)
    }
  }, [navigate, tapCount])

  return React.useCallback(() => setTapCount((count) => count + 1), [])
}
