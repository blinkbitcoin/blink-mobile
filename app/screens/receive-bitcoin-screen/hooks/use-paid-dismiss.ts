import { useEffect, useRef } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { PaymentRequestState, PaymentRequestStateType } from "../payment/index.types"

const AUTO_DISMISS_DELAY = 5000

/**
 * Leaves the receive screen once its request is paid. A plain receive shows the success
 * badge for a few seconds first. A Dollar receive has already been announced by the time
 * its conversion settles, so it keeps the Converting view and goes straight to Home, where
 * the new balance is.
 */
export const usePaidDismiss = (state: PaymentRequestStateType | undefined) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const convertedRef = useRef(false)

  const isPaid = state === PaymentRequestState.Paid
  const isConverting = state === PaymentRequestState.Converting
  if (isConverting) convertedRef.current = true
  const paidAfterConversion = isPaid && convertedRef.current

  useEffect(() => {
    if (!isPaid) return
    if (paidAfterConversion) {
      // `navigate` would push a second Home over this screen, and Back would bring the
      // paid request back.
      navigation.popTo("Primary")
      return
    }
    const id = setTimeout(() => navigation.goBack(), AUTO_DISMISS_DELAY)
    return () => clearTimeout(id)
  }, [isPaid, paidAfterConversion, navigation])

  return {
    completed: isPaid && !paidAfterConversion,
    converting: isConverting || paidAfterConversion,
  }
}
