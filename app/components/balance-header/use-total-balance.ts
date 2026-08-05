import { WalletBalance, getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useDollarBalanceRestriction } from "@app/hooks/use-dollar-balance-restricted"
import { usePriceConversion } from "@app/hooks"
import {
  addMoneyAmounts,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  DisplayCurrency,
} from "@app/types/amounts"

type TotalBalanceOptions = {
  /**
   * Zeroing a restricted dollar balance is a display rule: the funds are still
   * on the account, we just may not show them. Callers that measure what is at
   * stake rather than what to render — the backup nudge, for one — pass false so
   * a restricted user's stable-token holdings still count.
   */
  applyDollarRestriction?: boolean
}

export const useTotalBalance = (
  wallets?: readonly WalletBalance[],
  { applyDollarRestriction = true }: TotalBalanceOptions = {},
): {
  formattedBalance: string
  numericBalance: number
  satsBalance: number
  isLoading: boolean
} => {
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const { isRestricted, isRegionPending } = useDollarBalanceRestriction()
  const isDollarBalanceRestricted = isRestricted && applyDollarRestriction

  // TODO: check that there are 2 wallets.
  // otherwise fail (account with more/less 2 wallets will not be working with the current mobile app)
  // some tests accounts have only 1 wallet
  const btcWallet = getBtcWallet(wallets)
  const usdWallet = getUsdWallet(wallets)

  const btcAmount = convertMoneyAmount?.(
    toBtcMoneyAmount(btcWallet?.balance),
    DisplayCurrency,
  )
  /** An unresolved region counts the dollars out of every figure, not just out of the
   *  loader: `satsBalance` feeds thresholds that are read without consulting `isLoading`
   *  (the backup nudge), so leaving the dollars in would arm a nudge against a total that
   *  drops the moment the verdict lands. */
  const isDollarBalanceUnavailable = isDollarBalanceRestricted || isRegionPending
  const usdAmount = isDollarBalanceUnavailable
    ? convertMoneyAmount?.(toUsdMoneyAmount(0), DisplayCurrency)
    : convertMoneyAmount?.(toUsdMoneyAmount(usdWallet?.balance), DisplayCurrency)

  const isPriceConversionPending = !convertMoneyAmount
  const isLoading = isPriceConversionPending || isRegionPending

  if (!btcAmount || !usdAmount) {
    return {
      formattedBalance: "$0.00",
      numericBalance: 0,
      satsBalance: 0,
      isLoading,
    }
  }

  const totalDisplay = addMoneyAmounts({ a: usdAmount, b: btcAmount })

  const integerBalanceString = formatMoneyAmount({
    moneyAmount: totalDisplay,
    noSymbol: true,
    noSuffix: true,
  })

  const numericBalance = Number(integerBalanceString)

  const totalBtc = convertMoneyAmount?.(totalDisplay, WalletCurrency.Btc)
  const satsBalance =
    !usdWallet?.balance && btcWallet?.balance ? btcWallet?.balance : totalBtc?.amount || 0

  return {
    formattedBalance: formatMoneyAmount({ moneyAmount: totalDisplay }),
    numericBalance: isNaN(numericBalance) ? 0 : numericBalance,
    satsBalance: isNaN(satsBalance) ? 0 : satsBalance,
    isLoading,
  }
}
