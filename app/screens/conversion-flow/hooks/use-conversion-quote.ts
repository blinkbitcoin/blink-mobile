import { useEffect, useMemo, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { usePayments } from "@app/hooks/use-payments"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ConvertAmountAdjustment,
  type ConvertParams,
  type ConvertQuote,
} from "@app/types/payment.types"

const QuoteStatus = {
  Idle: "idle",
  Loading: "loading",
  Ready: "ready",
  Error: "error",
} as const

type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus]

export type ConversionQuoteState = {
  isQuoting: boolean
  hasQuoteError: boolean
  quote: ConvertQuote | null
  feeText: string
  adjustmentText: string | null
}

export const useConversionQuote = (
  quoteParams: ConvertParams | null,
): ConversionQuoteState => {
  const { getConversionQuote } = usePayments()
  const { LL } = useI18nContext()

  const [state, setState] = useState<{
    status: QuoteStatus
    quote: ConvertQuote | null
  }>({ status: QuoteStatus.Idle, quote: null })

  useEffect(() => {
    if (!getConversionQuote || !quoteParams) {
      setState({ status: QuoteStatus.Idle, quote: null })
      return
    }
    let cancelled = false
    setState({ status: QuoteStatus.Loading, quote: null })
    getConversionQuote(quoteParams)
      .then((quote) => {
        if (cancelled) return
        if (!quote) {
          return setState({ status: QuoteStatus.Error, quote: null })
        }
        setState({ status: QuoteStatus.Ready, quote })
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof Error) crashlytics().recordError(err)
        setState({ status: QuoteStatus.Error, quote: null })
      })
    return () => {
      cancelled = true
    }
  }, [getConversionQuote, quoteParams])

  const feeText =
    state.status === QuoteStatus.Ready && state.quote ? state.quote.formattedFee : ""

  const adjustmentText = useMemo(() => {
    if (state.status !== QuoteStatus.Ready || !state.quote) return null
    const adjustment = state.quote.amountAdjustment
    if (adjustment === ConvertAmountAdjustment.FlooredToMin) {
      return LL.ConversionConfirmationScreen.amountFloored()
    }
    if (adjustment === ConvertAmountAdjustment.IncreasedToAvoidDust) {
      return LL.ConversionConfirmationScreen.amountDustBumped()
    }
    return null
  }, [state, LL])

  return {
    isQuoting: state.status === QuoteStatus.Loading,
    hasQuoteError: state.status === QuoteStatus.Error,
    quote: state.quote,
    feeText,
    adjustmentText,
  }
}
