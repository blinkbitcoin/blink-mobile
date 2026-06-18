import { useEffect, useRef } from "react"

import type { SelfCustodialPaymentRequestState } from "@app/self-custodial/hooks/types"
import { getLightningAddress } from "@app/utils/pay-links"

import { truncateMiddle } from "../payment/helpers"
import { Invoice } from "../payment/index.types"

type RequestState = SelfCustodialPaymentRequestState

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
    if (
      requestType === Invoice.PayCode &&
      info?.data?.invoiceType === Invoice.PayCode &&
      info.data.username
    )
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
