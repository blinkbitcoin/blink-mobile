import { useEffect } from "react"

import { StackActions, useNavigation } from "@react-navigation/native"

const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

/**
 * Once a send has reached the network it may land, and every screen behind review can
 * build a new payment: a new amount or wallet mints a new key, and some rails carry no
 * key at all. So from the first attempt on, back goes Home instead: the header arrow, the
 * Android hardware back and the iOS swipe. It reads `hasAttemptedSend` as the send hook
 * returns it, and stays on for the life of the mount.
 *
 * Only backward actions are redirected. The reset to the completed screen and the error
 * sheet's own exits (Change amount, Try again, Home) go through as they are.
 */
export const useHomeOnBackAfterSend = (hasAttemptedSend: boolean) => {
  const navigation = useNavigation()

  useEffect(() => {
    if (!hasAttemptedSend) return
    navigation.setOptions({ gestureEnabled: false })

    return navigation.addListener("beforeRemove", (event) => {
      if (!BACKWARD_ACTIONS.includes(event.data.action.type)) return
      event.preventDefault()
      navigation.dispatch(StackActions.popToTop())
    })
  }, [navigation, hasAttemptedSend])
}
