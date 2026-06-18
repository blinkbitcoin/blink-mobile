import { useMemo } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { toWalletMoneyAmount } from "@app/types/amounts"
import { ConvertAmountAdjustment, resolveDustAdjustment } from "@app/types/payment"

import { buildConvertParams } from "../../build-convert-params"

import { useConversionQuote } from "../use-conversion-quote"

export type UseSelfCustodialConversionGuardParams = {
  fromCurrency: WalletCurrency | undefined
  amountInSourceCurrency: number
  fromWalletBalance: number | undefined
  enabled: boolean
}

export type SelfCustodialConversionGuard = {
  isQuoting: boolean
  hasQuoteError: boolean
  blockingReason: ConvertAmountAdjustment | null
}

export const useSelfCustodialConversionGuard = ({
  fromCurrency,
  amountInSourceCurrency,
  fromWalletBalance,
  enabled,
}: UseSelfCustodialConversionGuardParams): SelfCustodialConversionGuard => {
  const { convertMoneyAmount } = usePriceConversion()

  const quoteParams = useMemo(() => {
    if (!enabled || !convertMoneyAmount || !fromCurrency) return null
    if (amountInSourceCurrency <= 0) return null
    const primary = toWalletMoneyAmount(amountInSourceCurrency, fromCurrency)
    return buildConvertParams(primary, fromCurrency, convertMoneyAmount)
  }, [enabled, convertMoneyAmount, amountInSourceCurrency, fromCurrency])

  const { isQuoting, hasQuoteError, amountAdjustment } = useConversionQuote(quoteParams)

  const blockingReason = useMemo(
    () =>
      resolveDustAdjustment(amountAdjustment, amountInSourceCurrency, fromWalletBalance),
    [amountAdjustment, amountInSourceCurrency, fromWalletBalance],
  )

  return { isQuoting, hasQuoteError, blockingReason }
}
