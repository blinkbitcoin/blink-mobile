import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { WalletCurrency } from "@app/graphql/generated"
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context"
import { useCountdown } from "@app/hooks"

import {
  GeneratePaymentRequestAdapters,
  Invoice,
  PaymentRequest,
  PaymentRequestState,
  PaymentRequestCreationData,
} from "../payment/index.types"
import { createPaymentRequest } from "../payment/payment-request"

const getLightningInvoiceData = (paymentRequest: PaymentRequest | null) => {
  const data = paymentRequest?.info?.data
  if (data?.invoiceType === Invoice.Lightning) return data

  return undefined
}

export const useInvoiceLifecycle = (
  prcd: PaymentRequestCreationData<WalletCurrency> | null,
  adapters: GeneratePaymentRequestAdapters | null,
) => {
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)
  const lastHash = useLnUpdateHashPaid()

  const lightningInvoice = getLightningInvoiceData(paymentRequest)
  const isCreated = paymentRequest?.state === PaymentRequestState.Created
  const isPaid = isCreated && lightningInvoice?.paymentHash === lastHash
  const expiresAt = lightningInvoice?.expiresAt ?? null

  const { remainingSeconds: expiresInSeconds, isExpired } = useCountdown(expiresAt)

  useLayoutEffect(() => {
    if (prcd && adapters) {
      setPaymentRequest(createPaymentRequest({ adapters, creationData: prcd }))
    }
  }, [prcd, adapters])

  useEffect(() => {
    if (!paymentRequest || paymentRequest.state !== PaymentRequestState.Idle) return
    setPaymentRequest(
      (current) => current && current.setState(PaymentRequestState.Loading),
    )
    paymentRequest.generateRequest().then((next) =>
      setPaymentRequest((current) => {
        if (current?.creationData === next.creationData) return next
        return current
      }),
    )
  }, [paymentRequest])

  useEffect(() => {
    if (!isPaid) return
    setPaymentRequest((current) => current && current.setState(PaymentRequestState.Paid))
    ReactNativeHapticFeedback.trigger("notificationSuccess", {
      ignoreAndroidSystemSettings: true,
    })
  }, [isPaid])

  useEffect(() => {
    if (!isExpired) return
    setPaymentRequest(
      (current) => current && current.setState(PaymentRequestState.Expired),
    )
  }, [isExpired])

  const regenerateInvoice = useCallback(() => {
    setPaymentRequest((current) => current && current.setState(PaymentRequestState.Idle))
  }, [])

  return { paymentRequest, regenerateInvoice, expiresInSeconds }
}
