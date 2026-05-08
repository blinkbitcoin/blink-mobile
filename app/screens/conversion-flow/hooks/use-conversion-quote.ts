import { useEffect, useMemo, useState } from "react"

import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePayments } from "@app/hooks/use-payments"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ConvertAmountAdjustment,
  type ConvertParams,
  type ConvertQuote,
} from "@app/types/payment.types"
import { formatUsdInDisplay } from "@app/utils/amounts"

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
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

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
      .catch(() => {
        if (cancelled) return
        // Bridge already records to crashlytics with breadcrumbs
        // (`createGetConversionQuote` in `app/self-custodial/bridge/convert.ts`),
        // so the hook only needs to surface the Error state to the UI.
        setState({ status: QuoteStatus.Error, quote: null })
      })
    return () => {
      cancelled = true
    }
  }, [getConversionQuote, quoteParams])

  const { quote } = state

  const feeText = useMemo(() => {
    if (!quote) return ""
    return formatUsdInDisplay(quote.feeAmount.amount, {
      formatMoneyAmount,
      convertMoneyAmount,
    })
  }, [quote, formatMoneyAmount, convertMoneyAmount])

  const adjustmentText = useMemo(() => {
    if (!quote) return null
    if (quote.amountAdjustment === ConvertAmountAdjustment.FlooredToMin) {
      return LL.ConversionConfirmationScreen.amountFloored()
    }
    if (quote.amountAdjustment === ConvertAmountAdjustment.IncreasedToAvoidDust) {
      return LL.ConversionConfirmationScreen.amountDustBumped()
    }
    return null
  }, [quote, LL])

  return {
    isQuoting: state.status === QuoteStatus.Loading,
    hasQuoteError: state.status === QuoteStatus.Error,
    quote: state.quote,
    feeText,
    adjustmentText,
  }
}
