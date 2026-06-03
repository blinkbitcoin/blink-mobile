import { useMemo } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  toBtcMoneyAmount,
  type MoneyAmount,
  type WalletAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  resolveDustAdjustment,
} from "@app/types/payment"

import { useNonCustodialConversionLimits } from "./use-non-custodial-conversion-limits"

type Params = {
  amountAdjustment: ConvertAmountAdjustment | undefined
  fromCurrency: WalletCurrency | undefined
  fromWalletBalance: number | undefined
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  settlementAmount: number
  feeSats: number
  usdBalanceMoneyAmount: WalletAmount<typeof WalletCurrency.Usd>
}

export type SendDustWarning =
  | { shouldShow: false }
  | { shouldShow: true; remaining: string; remainingSats: string; minimum: string }

const HIDDEN: SendDustWarning = { shouldShow: false }

export const useSendDustWarning = ({
  amountAdjustment,
  fromCurrency,
  fromWalletBalance,
  unitOfAccountAmount,
  settlementAmount,
  feeSats,
  usdBalanceMoneyAmount,
}: Params): SendDustWarning => {
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const isUsdSource = fromCurrency === WalletCurrency.Usd
  const { limits } = useNonCustodialConversionLimits(
    isUsdSource ? ConvertDirection.BtcToUsd : undefined,
  )

  return useMemo(() => {
    if (!convertMoneyAmount) return HIDDEN
    const blockingReason = resolveDustAdjustment(
      amountAdjustment ?? null,
      settlementAmount,
      isUsdSource ? fromWalletBalance : undefined,
    )
    if (blockingReason !== ConvertAmountAdjustment.IncreasedToAvoidDust) return HIDDEN
    if (!limits?.minFromAmount) return HIDDEN

    const balanceSats = convertMoneyAmount(
      usdBalanceMoneyAmount,
      WalletCurrency.Btc,
    ).amount
    const sentSats = convertMoneyAmount(unitOfAccountAmount, WalletCurrency.Btc).amount
    const remainingSats = toBtcMoneyAmount(Math.max(0, balanceSats - sentSats - feeSats))

    return {
      shouldShow: true,
      remaining: formatMoneyAmount({
        moneyAmount: convertMoneyAmount(remainingSats, WalletCurrency.Usd),
      }),
      remainingSats: formatMoneyAmount({ moneyAmount: remainingSats }),
      minimum: formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(limits.minFromAmount) }),
    }
  }, [
    amountAdjustment,
    isUsdSource,
    fromWalletBalance,
    settlementAmount,
    limits?.minFromAmount,
    usdBalanceMoneyAmount,
    unitOfAccountAmount,
    feeSats,
    convertMoneyAmount,
    formatMoneyAmount,
  ])
}
