import { useCallback } from "react"
import { Alert } from "react-native"
import fetch from "cross-fetch"

import { useI18nContext } from "@app/i18n/i18n-react"

import { ReceiveDestination } from "../../send-bitcoin-screen/payment-destination/index.types"
import { Invoice, PaymentRequest } from "../payment/index.types"

export const useLnurlWithdraw = (pr: PaymentRequest | null | undefined) => {
  const { LL } = useI18nContext()

  const receiveViaNFC = useCallback(
    async (destination: ReceiveDestination) => {
      if (
        pr?.info?.data?.invoiceType !== Invoice.Lightning ||
        !pr.info.data.paymentRequest
      ) {
        Alert.alert(LL.RedeemBitcoinScreen.error())
        return
      }

      const { callback, k1 } = destination.validDestination

      const urlObject = new URL(callback)
      const searchParams = urlObject.searchParams
      searchParams.set("k1", k1)
      searchParams.set("pr", pr.info.data.paymentRequest)

      const url = urlObject.toString()

      const result = await fetch(url)
      if (!result.ok) {
        console.error(result.text(), "error with submitting withdrawalRequest")
        Alert.alert(LL.RedeemBitcoinScreen.submissionError())
        return
      }

      const lnurlResponse = await result.json()
      if (lnurlResponse?.status?.toLowerCase() !== "ok") {
        console.error(lnurlResponse, "error with redeeming")
        Alert.alert(LL.RedeemBitcoinScreen.redeemingError(), lnurlResponse.reason)
      }
    },
    [LL.RedeemBitcoinScreen, pr],
  )

  return receiveViaNFC
}
