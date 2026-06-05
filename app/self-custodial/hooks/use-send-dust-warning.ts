import { useEffect, useMemo } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  type BtcMoneyAmount,
  type MoneyAmount,
  type UsdMoneyAmount,
  type WalletAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  resolveDustAdjustment,
} from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

import { useNonCustodialConversionLimits } from "./use-non-custodial-conversion-limits"

type Params = {
  amountAdjustment: ConvertAmountAdjustment | undefined
  fromCurrency: WalletCurrency | undefined
  fromWalletBalance: number | undefined
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  settlementAmount: number
  feeSats: number | undefined
  usdBalanceMoneyAmount: WalletAmount<typeof WalletCurrency.Usd>
}

/** Decision only; the screen formats. `pending`/`blocked` are fail-closed states the caller must disable the slider on. */
export type SendDustWarning =
  | { status: "hidden" }
  | { status: "pending" }
  | { status: "blocked" }
  | {
      status: "visible"
      remaining: MoneyAmount<WalletOrDisplayCurrency>
      remainingSats: BtcMoneyAmount
      minimum: UsdMoneyAmount
    }

const HIDDEN = { status: "hidden" } as const
const PENDING = { status: "pending" } as const
const BLOCKED = { status: "blocked" } as const

export const useSendDustWarning = ({
  amountAdjustment,
  fromCurrency,
  fromWalletBalance,
  unitOfAccountAmount,
  settlementAmount,
  feeSats,
  usdBalanceMoneyAmount,
}: Params): SendDustWarning => {
  const { convertMoneyAmount } = usePriceConversion()
  const isUsdSource = fromCurrency === WalletCurrency.Usd
  const { limits, loading, error } = useNonCustodialConversionLimits(
    isUsdSource ? ConvertDirection.UsdToBtc : undefined,
  )

  const dustApplies =
    isUsdSource &&
    resolveDustAdjustment(
      amountAdjustment ?? null,
      settlementAmount,
      fromWalletBalance,
    ) === ConvertAmountAdjustment.IncreasedToAvoidDust

  useEffect(() => {
    if (dustApplies && error) {
      reportError("self-custodial dust-warning conversion limits", error)
    }
  }, [dustApplies, error])

  return useMemo<SendDustWarning>(() => {
    if (!dustApplies) return HIDDEN
    if (loading || !convertMoneyAmount) return PENDING
    if (error || !limits?.minFromAmount) return BLOCKED

    const balanceSats = convertMoneyAmount(
      usdBalanceMoneyAmount,
      WalletCurrency.Btc,
    ).amount
    const sentSats = convertMoneyAmount(unitOfAccountAmount, WalletCurrency.Btc).amount
    const remainingSats = toBtcMoneyAmount(
      Math.max(0, balanceSats - sentSats - (feeSats ?? 0)),
    )

    return {
      status: "visible",
      remaining: convertMoneyAmount(remainingSats, WalletCurrency.Usd),
      remainingSats,
      minimum: toUsdMoneyAmount(limits.minFromAmount),
    }
  }, [
    dustApplies,
    loading,
    error,
    limits?.minFromAmount,
    convertMoneyAmount,
    usdBalanceMoneyAmount,
    unitOfAccountAmount,
    feeSats,
  ])
}
