import { useCallback, useEffect, useMemo, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  convertDirectionFromCurrency,
  oppositeWalletCurrency,
  PaymentResultStatus,
  type ConvertParams,
} from "@app/types/payment.types"
import { logConversionAttempt } from "@app/utils/analytics"

import { useConversionQuote } from "./use-conversion-quote"

type Params = {
  fromCurrency: WalletCurrency
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
  enabled: boolean
}

export type NonCustodialConversionOutcome =
  | { status: typeof PaymentResultStatus.Success }
  | { status: typeof PaymentResultStatus.Failed; message: string }

export type NonCustodialConversionFlow = {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
  adjustmentText: string | null
  canExecute: boolean
  execute: () => Promise<NonCustodialConversionOutcome>
}

export const useNonCustodialConversion = ({
  fromCurrency,
  moneyAmount,
  enabled,
}: Params): NonCustodialConversionFlow => {
  const { convertMoneyAmount } = usePriceConversion()
  const { LL } = useI18nContext()

  const liveQuoteParams = useMemo(() => {
    if (!enabled || !convertMoneyAmount) return null
    const toCurrency = oppositeWalletCurrency(fromCurrency)
    return {
      fromAmount: convertMoneyAmount(moneyAmount, fromCurrency),
      toAmount: convertMoneyAmount(moneyAmount, toCurrency),
      direction: convertDirectionFromCurrency(fromCurrency),
    }
  }, [enabled, convertMoneyAmount, moneyAmount, fromCurrency])

  const [snapshotParams, setSnapshotParams] = useState<ConvertParams | null>(null)

  useEffect(() => {
    setSnapshotParams(null)
  }, [enabled, fromCurrency, moneyAmount.amount, moneyAmount.currencyCode])

  const quoteParams = snapshotParams ?? liveQuoteParams

  const { isQuoting, hasQuoteError, quote, feeText, adjustmentText } =
    useConversionQuote(quoteParams)

  useEffect(() => {
    if (quote && !snapshotParams && liveQuoteParams) {
      setSnapshotParams(liveQuoteParams)
    }
  }, [quote, snapshotParams, liveQuoteParams])

  const execute = useCallback(async (): Promise<NonCustodialConversionOutcome> => {
    if (!quote) {
      return { status: PaymentResultStatus.Failed, message: LL.errors.generic() }
    }
    logConversionAttempt({
      sendingWallet: fromCurrency,
      receivingWallet: oppositeWalletCurrency(fromCurrency),
    })
    const result = await quote.execute()
    if (result.status === PaymentResultStatus.Success) {
      return { status: PaymentResultStatus.Success }
    }
    return {
      status: PaymentResultStatus.Failed,
      message: result.errors?.[0]?.message ?? LL.errors.generic(),
    }
  }, [quote, fromCurrency, LL])

  return {
    isQuoting,
    hasQuoteError,
    feeText,
    adjustmentText,
    canExecute: quote !== null,
    execute,
  }
}
