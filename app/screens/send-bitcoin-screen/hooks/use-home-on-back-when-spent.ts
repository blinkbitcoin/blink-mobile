import { useEffect } from "react"

import { StackActions, useNavigation } from "@react-navigation/native"

const BACKWARD_ACTIONS = ["GO_BACK", "POP"]

/**
 * Once a send is spent, every screen behind review can build a new payment (a new amount
 * mints a new key, and some rails carry no key at all), so going back could pay twice.
 * Back goes Home instead: the header arrow, the Android hardware back and the iOS swipe.
 *
 * Only backward actions are redirected. The reset to the completed screen, and any reset
 * this screen did not cause, go through as they are.
 */
export const useHomeOnBackWhenSpent = (isSendSpent: boolean) => {
  const navigation = useNavigation()

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isSendSpent })
    if (!isSendSpent) return

    return navigation.addListener("beforeRemove", (event) => {
      if (!BACKWARD_ACTIONS.includes(event.data.action.type)) return
      event.preventDefault()
      navigation.dispatch(StackActions.popToTop())
    })
  }, [navigation, isSendSpent])
}
