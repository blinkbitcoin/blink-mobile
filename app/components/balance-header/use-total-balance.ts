import { WalletBalance, getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks"
import {
  addMoneyAmounts,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  DisplayCurrency,
} from "@app/types/amounts"

export const useTotalBalance = (
  wallets?: readonly WalletBalance[],
): {
  formattedBalance: string
  numericBalance: number
  satsBalance: number
  isLoading: boolean
} => {
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

  // TODO: check that there are 2 wallets.
  // otherwise fail (account with more/less 2 wallets will not be working with the current mobile app)
  // some tests accounts have only 1 wallet
  const btcWallet = getBtcWallet(wallets)
  const usdWallet = getUsdWallet(wallets)

  const btcAmount = convertMoneyAmount?.(
    toBtcMoneyAmount(btcWallet?.balance),
    DisplayCurrency,
  )
  /** Held money always counts, gated or not: gates limit actions, not existence. Nothing
   *  here depends on the region verdict, so the total never flips when it lands and the
   *  pending window needs no hold. */
  const usdAmount = convertMoneyAmount?.(
    toUsdMoneyAmount(usdWallet?.balance),
    DisplayCurrency,
  )

  /** The price conversion is the only thing this loader waits on. Callers hand this one flag
   *  to the whole header, so folding the region in blanked the username, the total and the
   *  Bitcoin row for as long as the country took to resolve, which on the self-custodial path
   *  is an IP lookup walking its adapters rather than a frame. WalletOverview holds the one
   *  row the verdict speaks to, off `isRegionPending` directly. */
  const isLoading = !convertMoneyAmount

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
