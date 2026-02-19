import { useEffect, useRef } from "react"

import { getLightningAddress } from "@app/utils/pay-links"

import { truncateMiddle } from "../payment/helpers"
import { Invoice } from "../payment/index.types"
import { usePaymentRequest } from "./use-payment-request"

type RequestState = NonNullable<ReturnType<typeof usePaymentRequest>>

type DisplayPaymentRequestReturn = {
  displayPaymentRequest: string
  showActions: boolean
}

export const useDisplayPaymentRequest = (
  request: RequestState,
  isOnChainPage: boolean,
  onchainAddress: string | null,
): DisplayPaymentRequestReturn => {
  const { type: requestType, canUsePaycode, info, lnAddressHostname } = request

  const prevPaymentRequest = useRef("")

  const showActions = isOnChainPage
    ? Boolean(onchainAddress)
    : requestType !== Invoice.PayCode || canUsePaycode

  const readablePaymentRequest = (() => {
    if (info?.data?.invoiceType === Invoice.Lightning)
      return truncateMiddle(info.data.getFullUriFn({}))
    if (requestType === Invoice.PayCode && info?.data?.invoiceType === Invoice.PayCode)
      return getLightningAddress(lnAddressHostname, info.data.username)
  })()

  const activePaymentRequest = isOnChainPage
    ? onchainAddress
      ? truncateMiddle(onchainAddress)
      : null
    : readablePaymentRequest
  const displayPaymentRequest = activePaymentRequest || prevPaymentRequest.current

  useEffect(() => {
    if (activePaymentRequest) prevPaymentRequest.current = activePaymentRequest
  }, [activePaymentRequest])

  return { displayPaymentRequest, showActions }
}
