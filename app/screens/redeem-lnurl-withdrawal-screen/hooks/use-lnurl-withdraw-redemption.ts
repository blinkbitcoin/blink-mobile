import fetch from "cross-fetch"
import { useEffect, useState } from "react"
import { useApolloClient } from "@apollo/client"

import { HomeAuthedDocument, useLnInvoiceCreateMutation } from "@app/graphql/generated"
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context"
import { usePayments } from "@app/hooks/use-payments"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useTranslateSdkError } from "@app/self-custodial/hooks"
import { PaymentResultStatus } from "@app/types/payment"
import { AccountType } from "@app/types/wallet"
import { satsToMsats } from "@app/utils/amounts"

type WithdrawalInvoice = {
  paymentRequest: string
  paymentHash: string
}

type Params = {
  walletId: string | undefined
  amountSats: number
  callback: string
  k1: string
  defaultDescription: string
  minWithdrawableSatoshis: number
  maxWithdrawableSatoshis: number
}

export type LnurlWithdrawRedemption = {
  paid: boolean
  errorMessage: string
  lnServiceErrorReason: string
}

type AdapterParams = {
  enabled: boolean
  amountSats: number
  callback: string
  k1: string
  defaultDescription: string
  minWithdrawableSatoshis: number
  maxWithdrawableSatoshis: number
}

const useAdapterRedemption = ({
  enabled,
  amountSats,
  callback,
  k1,
  defaultDescription,
  minWithdrawableSatoshis,
  maxWithdrawableSatoshis,
}: AdapterParams): LnurlWithdrawRedemption => {
  const { lnurlWithdraw } = usePayments()
  const translateSdkError = useTranslateSdkError()
  const { LL } = useI18nContext()

  const [paid, setPaid] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!enabled || !lnurlWithdraw) return

    const controller = new AbortController()
    let cancelled = false

    const run = async () => {
      const result = await lnurlWithdraw({
        amountSats,
        callback,
        k1,
        defaultDescription,
        minWithdrawableMsats: satsToMsats(minWithdrawableSatoshis),
        maxWithdrawableMsats: satsToMsats(maxWithdrawableSatoshis),
        signal: controller.signal,
      })

      if (cancelled) return

      if (result.status === PaymentResultStatus.Success) {
        setPaid(true)
        return
      }

      const code = result.errors?.[0]?.message
      setErrorMessage(translateSdkError(code) ?? LL.RedeemBitcoinScreen.redeemingError())
    }

    run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    enabled,
    lnurlWithdraw,
    amountSats,
    callback,
    k1,
    defaultDescription,
    minWithdrawableSatoshis,
    maxWithdrawableSatoshis,
    translateSdkError,
    LL,
  ])

  return { paid, errorMessage, lnServiceErrorReason: "" }
}

type MutationParams = {
  enabled: boolean
  walletId: string | undefined
  amountSats: number
  callback: string
  k1: string
  defaultDescription: string
}

const useMutationRedemption = ({
  enabled,
  walletId,
  amountSats,
  callback,
  k1,
  defaultDescription,
}: MutationParams): LnurlWithdrawRedemption => {
  const { LL } = useI18nContext()
  const [lnInvoiceCreate] = useLnInvoiceCreateMutation()
  const apolloClient = useApolloClient()
  const lastHash = useLnUpdateHashPaid()

  const [withdrawalInvoice, setWithdrawalInvoice] = useState<WithdrawalInvoice | null>(
    null,
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [lnServiceErrorReason, setLnServiceErrorReason] = useState("")

  useEffect(() => {
    if (!enabled || !walletId) return

    const createInvoice = async () => {
      setWithdrawalInvoice(null)
      try {
        const { data } = await lnInvoiceCreate({
          variables: {
            input: { walletId, amount: amountSats, memo: defaultDescription },
          },
        })
        if (!data) {
          throw new Error("No data returned from lnInvoiceCreate")
        }
        const {
          lnInvoiceCreate: { invoice, errors },
        } = data
        if (errors && errors.length !== 0) {
          console.error(errors, "error with lnInvoiceCreate")
          setErrorMessage(LL.RedeemBitcoinScreen.error())
          return
        }
        if (invoice) setWithdrawalInvoice(invoice)
      } catch (err) {
        console.error(err, "error with AddInvoice")
        setErrorMessage(`${err}`)
      }
    }

    createInvoice()
  }, [enabled, walletId, amountSats, defaultDescription, lnInvoiceCreate, LL])

  useEffect(() => {
    if (!enabled || !withdrawalInvoice) return

    const submitToCallback = async () => {
      const urlObject = new URL(callback)
      urlObject.searchParams.set("k1", k1)
      urlObject.searchParams.set("pr", withdrawalInvoice.paymentRequest)

      const result = await fetch(urlObject.toString())

      if (result.ok) {
        const lnurlResponse = await result.json()
        if (lnurlResponse?.status?.toLowerCase() !== "ok") {
          console.error(lnurlResponse, "error with redeeming")
          setErrorMessage(LL.RedeemBitcoinScreen.redeemingError())
          if (lnurlResponse?.reason) setLnServiceErrorReason(lnurlResponse.reason)
        }
      } else {
        console.error(result.text(), "error with submitting withdrawalRequest")
        setErrorMessage(LL.RedeemBitcoinScreen.submissionError())
      }
    }

    submitToCallback()
  }, [enabled, withdrawalInvoice, callback, k1, LL])

  const paid =
    enabled && withdrawalInvoice !== null && withdrawalInvoice.paymentHash === lastHash

  useEffect(() => {
    if (!paid) return
    apolloClient.refetchQueries({ include: [HomeAuthedDocument] })
  }, [paid, apolloClient])

  return { paid, errorMessage, lnServiceErrorReason }
}

export const useLnurlWithdrawRedemption = (params: Params): LnurlWithdrawRedemption => {
  const { accountType } = usePayments()
  const isSelfCustodial = accountType === AccountType.SelfCustodial

  const adapterState = useAdapterRedemption({
    enabled: isSelfCustodial,
    amountSats: params.amountSats,
    callback: params.callback,
    k1: params.k1,
    defaultDescription: params.defaultDescription,
    minWithdrawableSatoshis: params.minWithdrawableSatoshis,
    maxWithdrawableSatoshis: params.maxWithdrawableSatoshis,
  })

  const mutationState = useMutationRedemption({
    enabled: !isSelfCustodial,
    walletId: params.walletId,
    amountSats: params.amountSats,
    callback: params.callback,
    k1: params.k1,
    defaultDescription: params.defaultDescription,
  })

  return isSelfCustodial ? adapterState : mutationState
}
