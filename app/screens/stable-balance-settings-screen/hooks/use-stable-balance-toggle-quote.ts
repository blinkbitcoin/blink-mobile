import { useMemo } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useConversionQuote } from "@app/screens/conversion-flow/hooks/use-conversion-quote"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  convertDirectionFromCurrency,
  oppositeWalletCurrency,
} from "@app/types/payment.types"

type Params = {
  fromCurrency: WalletCurrency
  sourceBalance: number
  enabled: boolean
}

export type StableBalanceToggleQuote = {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
  adjustmentText: string | null
}

export const useStableBalanceToggleQuote = ({
  fromCurrency,
  sourceBalance,
  enabled,
}: Params): StableBalanceToggleQuote => {
  const { convertMoneyAmount } = usePriceConversion()

  const quoteParams = useMemo(() => {
    if (!enabled || !convertMoneyAmount || sourceBalance <= 0) return null
    const fromAmount =
      fromCurrency === WalletCurrency.Btc
        ? toBtcMoneyAmount(sourceBalance)
        : toUsdMoneyAmount(sourceBalance)
    const toCurrency = oppositeWalletCurrency(fromCurrency)
    return {
      fromAmount,
      toAmount: convertMoneyAmount(fromAmount, toCurrency),
      direction: convertDirectionFromCurrency(fromCurrency),
    }
  }, [enabled, convertMoneyAmount, sourceBalance, fromCurrency])

  const { isQuoting, hasQuoteError, feeText, adjustmentText } =
    useConversionQuote(quoteParams)

  return { isQuoting, hasQuoteError, feeText, adjustmentText }
}
