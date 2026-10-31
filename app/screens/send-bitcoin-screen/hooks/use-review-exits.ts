import { useCallback } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { CommonActions, StackActions, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import type { ErrorMsgAction } from "../error-msg-action"

/** Every screen a send can pass through before review, in any order it was reached. */
const SEND_FLOW_ROUTES: ReadonlySet<string> = new Set([
  "sendBitcoinDestination",
  "scanningQRCode",
  "merchantSelection",
  "sendBitcoinDetails",
  "sendBitcoinConfirmation",
])

/**
 * The ways out of review when an error stops the send (blink-wip#1278, provisional
 * ruling 2026-09-17), and the sheet action for each.
 */
export const useReviewExits = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()

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

  const goHome = useCallback(
    () => navigation.dispatch(StackActions.popToTop()),
    [navigation],
  )

  /** The error message sheet's button for an action. */
  const actionButton = useCallback(
    (action: ErrorMsgAction) => {
      switch (action) {
        case "changeAmount":
          return {
            primaryLabel: LL.SendBitcoinConfirmationScreen.changeAmount(),
            onPrimaryPress: changeAmount,
          }
        case "tryAgain":
          return {
            primaryLabel: LL.SendBitcoinConfirmationScreen.tryAgain(),
            onPrimaryPress: startOver,
          }
        case "home":
          return {
            primaryLabel: LL.SendBitcoinConfirmationScreen.home(),
            onPrimaryPress: goHome,
          }
      }
    },
    [LL, changeAmount, startOver, goHome],
  )

  return { changeAmount, startOver, goHome, actionButton }
}
