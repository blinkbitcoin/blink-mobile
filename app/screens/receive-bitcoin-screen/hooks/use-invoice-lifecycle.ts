import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import { WalletCurrency } from "@app/graphql/generated"
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context"
import { useCountdown } from "@app/hooks"

import {
  GeneratePaymentRequestMutations,
  Invoice,
  PaymentRequest,
  PaymentRequestState,
  PaymentRequestCreationData,
} from "../payment/index.types"
import { createPaymentRequest } from "../payment/payment-request"

export const useInvoiceLifecycle = (
  prcd: PaymentRequestCreationData<WalletCurrency> | null,
  mutations: GeneratePaymentRequestMutations,
) => {
  const [pr, setPR] = useState<PaymentRequest | null>(null)

  useLayoutEffect(() => {
    if (prcd) {
      setPR(createPaymentRequest({ mutations, creationData: prcd }))
    }
  }, [prcd, mutations])

  useEffect(() => {
    if (pr && pr.state === PaymentRequestState.Idle) {
      setPR((current) => current && current.setState(PaymentRequestState.Loading))
      pr.generateRequest().then((newPR) =>
        setPR((currentPR) => {
          if (currentPR?.creationData === newPR.creationData) return newPR
          return currentPR
        }),
      )
    }
  }, [pr])

  const regenerateInvoice = useCallback(() => {
    setPR((current) => current && current.setState(PaymentRequestState.Idle))
  }, [])

  const lastHash = useLnUpdateHashPaid()
  useEffect(() => {
    if (
      pr?.state === PaymentRequestState.Created &&
      pr.info?.data?.invoiceType === Invoice.Lightning &&
      lastHash === pr.info.data.paymentHash
    ) {
      setPR((current) => current && current.setState(PaymentRequestState.Paid))
      ReactNativeHapticFeedback.trigger("notificationSuccess", {
        ignoreAndroidSystemSettings: true,
      })
    }
  }, [lastHash, pr])

  const expiresAt =
    pr?.info?.data?.invoiceType === Invoice.Lightning && pr.info?.data?.expiresAt
      ? pr.info.data.expiresAt
      : null

  const { remainingSeconds: expiresInSeconds, isExpired } = useCountdown(expiresAt)

  useEffect(() => {
    if (isExpired) {
      setPR((current) => current && current.setState(PaymentRequestState.Expired))
    }
  }, [isExpired])

  return { pr, regenerateInvoice, expiresInSeconds }
}
