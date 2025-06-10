import { WalletBalance, getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
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
  const usdAmount = convertMoneyAmount?.(
    toUsdMoneyAmount(usdWallet?.balance),
    DisplayCurrency,
  )

  if (!btcAmount || !usdAmount) {
    return {
      formattedBalance: "$0.00",
      numericBalance: 0,
    }
  }

  const total = addMoneyAmounts({ a: usdAmount, b: btcAmount })

  const integerBalanceString = formatMoneyAmount({
    moneyAmount: total,
    noSymbol: true,
    noSuffix: true,
  })

  const numericBalance = Number(integerBalanceString)

  return {
    formattedBalance: formatMoneyAmount({ moneyAmount: total }),
    numericBalance: isNaN(numericBalance) ? 0 : numericBalance,
  }
}
