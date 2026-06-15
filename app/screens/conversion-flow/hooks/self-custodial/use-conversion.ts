import { useEffect, useMemo, useState } from "react"
import crashlytics from "@react-native-firebase/crashlytics"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type MoneyAmount, type WalletOrDisplayCurrency } from "@app/types/amounts"
import {
  oppositeWalletCurrency,
  PaymentResultStatus,
  type ConvertParams,
} from "@app/types/payment"
import { logConversionAttempt, logConversionResult } from "@app/utils/analytics"
import { triggerHapticFeedback } from "@app/utils/helper"

import { buildConvertParams } from "../../build-convert-params"

import { useConversionQuote } from "../use-conversion-quote"

type Params = {
  fromCurrency: WalletCurrency
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
  enabled: boolean
  onSuccess: () => void
}

export type SelfCustodialConversionFlow = {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
  canExecute: boolean
  execute: () => Promise<void>
  loading: boolean
  errorMessage?: string
}

export const useSelfCustodialConversion = ({
  fromCurrency,
  moneyAmount,
  enabled,
  onSuccess,
}: Params): SelfCustodialConversionFlow => {
  const { convertMoneyAmount } = usePriceConversion()
  const { LL } = useI18nContext()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const liveQuoteParams = useMemo(() => {
    if (!enabled || !convertMoneyAmount) return null
    const fromAmount = convertMoneyAmount(moneyAmount, fromCurrency)
    return buildConvertParams(fromAmount, fromCurrency, convertMoneyAmount)
  }, [enabled, convertMoneyAmount, moneyAmount, fromCurrency])

  const [snapshotParams, setSnapshotParams] = useState<ConvertParams | null>(null)

  useEffect(() => {
    setSnapshotParams(null)
  }, [enabled, fromCurrency, moneyAmount.amount, moneyAmount.currencyCode])

  const quoteParams = snapshotParams ?? liveQuoteParams

  const { isQuoting, hasQuoteError, quote, feeText } = useConversionQuote(quoteParams)

  useEffect(() => {
    if (quote && !snapshotParams && liveQuoteParams) {
      setSnapshotParams(liveQuoteParams)
    }
  }, [quote, snapshotParams, liveQuoteParams])

  const execute = async () => {
    setLoading(true)
    setErrorMessage(undefined)

    try {
      if (!quote) {
        setErrorMessage(LL.errors.generic())
        triggerHapticFeedback("notificationError")
        return
      }

      logConversionAttempt({
        sendingWallet: fromCurrency,
        receivingWallet: oppositeWalletCurrency(fromCurrency),
      })

      const result = await quote.execute()
      const isSuccess = result.status === PaymentResultStatus.Success

      logConversionResult({
        sendingWallet: fromCurrency,
        receivingWallet: oppositeWalletCurrency(fromCurrency),
        paymentStatus: isSuccess ? PaymentSendResult.Success : PaymentSendResult.Failure,
      })

      if (isSuccess) {
        triggerHapticFeedback("notificationSuccess")
        onSuccess()
        return
      }

      setErrorMessage(result.errors?.[0]?.message ?? LL.errors.generic())
      triggerHapticFeedback("notificationError")
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        setErrorMessage(err.message)
        triggerHapticFeedback("notificationError")
      }
    } finally {
      setLoading(false)
    }
  }

  return {
    isQuoting,
    hasQuoteError,
    feeText,
    canExecute: quote !== null,
    execute,
    loading,
    errorMessage,
  }
}
