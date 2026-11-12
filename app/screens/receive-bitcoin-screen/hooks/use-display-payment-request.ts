import { useEffect, useRef } from "react"

import type { ReceivePaymentRequestState } from "../payment/request-state.types"
import { getLightningAddress } from "@app/utils/pay-links"

import { truncateMiddle } from "../payment/helpers"
import { Invoice } from "../payment/index.types"

type RequestState = ReceivePaymentRequestState

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

  // Only Lightning falls back to its last value, to bridge an invoice being replaced.
  // An on-chain address that is not held right now may belong to another wallet, and
  // a Lightning request must never stand in for a Bitcoin address.
  const prevLightning = useRef("")

  // The on-chain row stays put while an address loads, fails or changes wallet, so the
  // layout does not jump; the screen disables what has nothing to act on, and New retries.
  const showActions = isOnChainPage || requestType !== Invoice.PayCode || canUsePaycode

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

  const onchainDisplay = onchainAddress ? truncateMiddle(onchainAddress) : ""
  const displayPaymentRequest = isOnChainPage
    ? onchainDisplay
    : readablePaymentRequest || prevLightning.current

  useEffect(() => {
    if (readablePaymentRequest) prevLightning.current = readablePaymentRequest
  }, [readablePaymentRequest])

  return { displayPaymentRequest, showActions }
}
