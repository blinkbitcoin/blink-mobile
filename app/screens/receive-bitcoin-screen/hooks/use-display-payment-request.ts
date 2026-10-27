import { useEffect, useRef } from "react"

import type { ReceivePaymentRequestState } from "../payment/request-state.types"
import { getLightningAddress } from "@app/utils/pay-links"

import { truncateMiddle } from "../payment/helpers"
import { Invoice } from "../payment/index.types"

type RequestState = ReceivePaymentRequestState

type OnchainDisplayState = {
  address: string | null
  failed: boolean
}

type DisplayPaymentRequestReturn = {
  displayPaymentRequest: string
  showActions: boolean
}

export const useDisplayPaymentRequest = (
  request: RequestState,
  isOnChainPage: boolean,
  onchain: OnchainDisplayState,
): DisplayPaymentRequestReturn => {
  const { type: requestType, canUsePaycode, info, lnAddressHostname } = request
  const { address: onchainAddress, failed: onchainFailed } = onchain

  // Each rail falls back only to its own last value: a Lightning request must never
  // stand in for a Bitcoin address, and a failed on-chain load has nothing to show.
  const prevByRail = useRef({ onchain: "", lightning: "" })
  const rail = isOnChainPage ? "onchain" : "lightning"
  const hasNoFallback = isOnChainPage && onchainFailed

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
  const fallback = hasNoFallback ? "" : prevByRail.current[rail]
  const displayPaymentRequest = activePaymentRequest || fallback

  useEffect(() => {
    if (activePaymentRequest) prevByRail.current[rail] = activePaymentRequest
    else if (hasNoFallback) prevByRail.current.onchain = ""
  }, [activePaymentRequest, rail, hasNoFallback])

  return { displayPaymentRequest, showActions }
}
