import { useCallback, useEffect } from "react"

import { StackActions, useNavigation } from "@react-navigation/native"

const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

/**
 * Home once a send has gone out: the Home tab, selected explicitly. `popToTop` alone would
 * keep `Primary`'s nested state, so a send started from a contact on People would land back
 * on that contact. Back after an attempt, Sent's Close and the error sheet's Home all
 * leave this way.
 */
export const homeAfterSendAction = () => StackActions.popTo("Primary", { screen: "Home" })

/** Sent's Close: the Home tab, wherever the send started from. */
export const useGoHomeAfterSend = () => {
  const navigation = useNavigation()
  return useCallback(() => navigation.dispatch(homeAfterSendAction()), [navigation])
}

/**
 * Once a send has reached the network it may land, and every screen behind review can
 * build a new payment: a new amount or wallet mints a new key, and some rails carry no
 * key at all. So from the first attempt on, back goes Home instead: the header arrow, the
 * Android hardware back and the iOS swipe. It reads `hasAttemptedSend` as the send hook
 * returns it, and stays on for the life of the mount, unless the send hook forgets an
 * attempt that went nowhere: back and the swipe are then given back.
 *
 * Only backward actions are redirected: the reset to the completed screen goes through as
 * it is. A `goBack` from the screen itself lands Home too, so review offers no Change
 * amount once a send was attempted.
 */
export const useHomeOnBackAfterSend = (hasAttemptedSend: boolean) => {
  const navigation = useNavigation()

  useEffect(() => {
    if (!hasAttemptedSend) return
    navigation.setOptions({ gestureEnabled: false })

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!BACKWARD_ACTIONS.includes(event.data.action.type)) return
      event.preventDefault()
      navigation.dispatch(homeAfterSendAction())
    })
    /** React runs every cleanup of a commit before its effects, so a hold that takes over
     *  in the same commit (Sent's) still has the last word on the swipe. */
    return () => {
      unsubscribe()
      navigation.setOptions({ gestureEnabled: true })
    }
  }, [navigation, hasAttemptedSend])
}
