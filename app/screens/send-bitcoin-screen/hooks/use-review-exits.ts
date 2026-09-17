import { useCallback } from "react"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { CommonActions, StackActions, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

/** Every screen a send can pass through before review, in any order it was reached. */
const SEND_FLOW_ROUTES: ReadonlySet<string> = new Set([
  "sendBitcoinDestination",
  "scanningQRCode",
  "merchantSelection",
  "sendBitcoinDetails",
  "sendBitcoinConfirmation",
])

/**
 * The two ways out of review when an error stops the send (blink-wip#1278, ruling
 * 2026-09-17). Nothing has been sent when either is offered.
 */
export const useReviewExits = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Back to amount entry with the amount cleared; destination, wallet and note stay. */
  const changeAmount = useCallback(() => {
    navigation.dispatch(
      StackActions.popTo(
        "sendBitcoinDetails",
        { resetAmountAt: Date.now() },
        { merge: true },
      ),
    )
  }, [navigation])

  /**
   * To the first step of the send flow with nothing entered. A send reached by scanning
   * has no destination screen in the stack, so the flow is replaced by a new one rather
   * than popped back to.
   */
  const startOver = useCallback(() => {
    navigation.dispatch((state) => {
      const firstSendRoute = state.routes.findIndex(({ name }) =>
        SEND_FLOW_ROUTES.has(name),
      )
      const kept =
        firstSendRoute === -1 ? state.routes : state.routes.slice(0, firstSendRoute)
      const routes = [...kept, { name: "sendBitcoinDestination" as const }]

      return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
    })
  }, [navigation])

  return { changeAmount, startOver }
}
