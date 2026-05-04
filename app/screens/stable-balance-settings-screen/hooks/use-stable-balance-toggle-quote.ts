import { useMemo } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { buildConvertParams } from "@app/screens/conversion-flow/build-convert-params"
import { useConversionQuote } from "@app/screens/conversion-flow/hooks/use-conversion-quote"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

type Params = {
  fromCurrency: WalletCurrency
  sourceBalance: number
  enabled: boolean
}

export type StableBalanceToggleQuote = {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
}

export const useStableBalanceToggleQuote = ({
  fromCurrency,
  sourceBalance,
  enabled,
}: Params): StableBalanceToggleQuote => {
  const { convertMoneyAmount } = usePriceConversion()

  const quoteParams = useMemo(() => {
    if (!enabled || !convertMoneyAmount || sourceBalance <= 0) return null
    const primary =
      fromCurrency === WalletCurrency.Btc
        ? toBtcMoneyAmount(sourceBalance)
        : toUsdMoneyAmount(sourceBalance)
    return buildConvertParams(primary, fromCurrency, convertMoneyAmount)
  }, [enabled, convertMoneyAmount, sourceBalance, fromCurrency])

  const { isQuoting, hasQuoteError, feeText } = useConversionQuote(quoteParams)

  return { isQuoting, hasQuoteError, feeText }
}
