import { useCallback, useEffect, useMemo, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  oppositeWalletCurrency,
  PaymentResultStatus,
  type ConvertParams,
} from "@app/types/payment"
import { logConversionAttempt } from "@app/utils/analytics"

import { buildConvertParams } from "../build-convert-params"

import { useConversionQuote } from "./use-conversion-quote"

export type UseConversionExecutionParams = {
  fromCurrency: WalletCurrency
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
}

export type ConversionExecutionOutcome =
  | { status: typeof PaymentResultStatus.Success }
  | { status: typeof PaymentResultStatus.Failed; message: string }

export type ConversionExecutionState = {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
  feeRowVisible: boolean
  canExecute: boolean
  execute: () => Promise<ConversionExecutionOutcome>
}

export const useConversionExecution = ({
  fromCurrency,
  moneyAmount,
}: UseConversionExecutionParams): ConversionExecutionState => {
  const { convertMoneyAmount } = usePriceConversion()
  const { LL } = useI18nContext()

  const liveQuoteParams = useMemo(() => {
    if (!convertMoneyAmount) return null
    const fromAmount = convertMoneyAmount(moneyAmount, fromCurrency)
    return buildConvertParams(fromAmount, fromCurrency, convertMoneyAmount)
  }, [convertMoneyAmount, moneyAmount, fromCurrency])

  const [snapshotParams, setSnapshotParams] = useState<ConvertParams | null>(null)

  useEffect(() => {
    setSnapshotParams(null)
  }, [fromCurrency, moneyAmount.amount, moneyAmount.currencyCode])

  const quoteParams = snapshotParams ?? liveQuoteParams

  const { isQuoting, hasQuoteError, quote, feeText } = useConversionQuote(quoteParams)

  useEffect(() => {
    if (quote && !snapshotParams && liveQuoteParams) {
      setSnapshotParams(liveQuoteParams)
    }
  }, [quote, snapshotParams, liveQuoteParams])

  const execute = useCallback(async (): Promise<ConversionExecutionOutcome> => {
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

  const canExecute = quote !== null
  const feeRowVisible = isQuoting || hasQuoteError || (quote !== null && quote.showFeeRow)

  return {
    isQuoting,
    hasQuoteError,
    feeText,
    feeRowVisible,
    canExecute,
    execute,
  }
}
