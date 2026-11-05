import { type WalletSwitchValue as WalletValues } from "@app/components/wallet-switch"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useSendWallets } from "@app/screens/send-bitcoin-screen/hooks/use-send-wallets"
import {
  DisplayCurrency,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  type MoneyAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"

const NEXT_WALLET: Record<WalletValues, WalletValues> = {
  ALL: WalletCurrency.Btc,
  [WalletCurrency.Btc]: WalletCurrency.Usd,
  [WalletCurrency.Usd]: "ALL",
}

type HistoryWalletSummary = {
  /** The wallet the list shows. Bitcoin whenever there is no dollar wallet to add to it. */
  wallet: WalletValues
  balancePrimary: string
  balanceSecondary?: string
  /** A balance the card needs hasn't loaded yet, so there is no amount to show. */
  balanceLoading: boolean
  /** Absent with a single wallet: there is nothing to cycle through. */
  nextWallet?: WalletValues
}

/**
 * Balances for the transaction history's wallet card. "All" is the Bitcoin balance plus the
 * dollar balance converted to sats, led in sats like the send summary, with the display
 * currency under it.
 */
export const useHistoryWalletSummary = (selected: WalletValues): HistoryWalletSummary => {
  const { btcWallet, usdWallet, loading } = useSendWallets()
  const { convertMoneyAmount } = usePriceConversion()
  const { formatMoneyAmount, getSecondaryAmountIfCurrencyIsDifferent } =
    useDisplayCurrency()

  // While the wallets load, keep what was asked for rather than flashing Bitcoin first.
  const hasDollarWallet = loading || Boolean(usdWallet)
  const wallet = hasDollarWallet ? selected : WalletCurrency.Btc

  const btcMissing = btcWallet?.balance === undefined
  const usdMissing = usdWallet?.balance === undefined
  const balanceLoading =
    wallet === WalletCurrency.Btc
      ? btcMissing
      : wallet === WalletCurrency.Usd
        ? usdMissing
        : btcMissing || usdMissing

  const btcBalance = toBtcMoneyAmount(btcWallet?.balance)
  const usdBalance = toUsdMoneyAmount(usdWallet?.balance)

  const allBalance = convertMoneyAmount
    ? toBtcMoneyAmount(
        btcBalance.amount + convertMoneyAmount(usdBalance, WalletCurrency.Btc).amount,
      )
    : btcBalance

  const walletBalance =
    wallet === WalletCurrency.Usd
      ? usdBalance
      : wallet === WalletCurrency.Btc
        ? btcBalance
        : allBalance

  const secondary: MoneyAmount<WalletOrDisplayCurrency> | undefined = convertMoneyAmount
    ? getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: walletBalance,
        walletAmount: walletBalance,
        displayAmount: convertMoneyAmount(walletBalance, DisplayCurrency),
      })
    : undefined

  if (balanceLoading) {
    return {
      wallet,
      balancePrimary: "",
      balanceLoading,
      nextWallet: hasDollarWallet ? NEXT_WALLET[wallet] : undefined,
    }
  }

  return {
    wallet,
    balancePrimary: formatMoneyAmount({ moneyAmount: walletBalance }),
    balanceSecondary:
      secondary && formatMoneyAmount({ moneyAmount: secondary, isApproximate: true }),
    balanceLoading,
    nextWallet: hasDollarWallet ? NEXT_WALLET[wallet] : undefined,
  }
}
