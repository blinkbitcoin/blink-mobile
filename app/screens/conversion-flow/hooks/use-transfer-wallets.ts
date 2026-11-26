import { useMemo } from "react"

import { Wallet, WalletCurrency } from "@app/graphql/generated"
import {
  CARD,
  CardCurrency,
  MoneyAmount,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
} from "@app/types/amounts"

import {
  initialTransferPair,
  settlementCurrencyOf,
  TRANSFER_BALANCE_ORDER,
  TransferBalance,
} from "../transfer-balances"
import { TransferCard } from "./use-transfer-card"

type WalletFragment = Pick<Wallet, "id" | "balance" | "walletCurrency">

/** A side of the Transfer: a wallet, or the Card Balance moving in sats. */
export type TransferWallet = WalletFragment & {
  kind: TransferBalance
}

type UseTransferWalletsInput = {
  btcWallet: WalletFragment | undefined
  usdWallet: WalletFragment | undefined
  card: TransferCard | undefined
  /** The Card Balance when the Transfer only moves money into it. */
  destination: CardCurrency | undefined
  isDollarBalanceOffered: boolean
  isDrainConversion: boolean
}

/** The balances the Transfer offers, each as a side it can move money from or to, and
 *  the two sides it opens with. */
export const useTransferWallets = ({
  btcWallet,
  usdWallet,
  card,
  destination,
  isDollarBalanceOffered,
  isDrainConversion,
}: UseTransferWalletsInput) => {
  const transferWallets = useMemo<Record<TransferBalance, TransferWallet | undefined>>(
    () => ({
      [WalletCurrency.Btc]: btcWallet && { ...btcWallet, kind: WalletCurrency.Btc },
      [WalletCurrency.Usd]: usdWallet && { ...usdWallet, kind: WalletCurrency.Usd },
      [CARD]: card && {
        id: card.id,
        balance: card.availableSats ?? 0,
        walletCurrency: settlementCurrencyOf(CARD),
        kind: CARD,
      },
    }),
    [btcWallet, usdWallet, card],
  )

  const balances = useMemo(
    () =>
      TRANSFER_BALANCE_ORDER.filter((balance) => {
        const isDollarLeftOut = balance === WalletCurrency.Usd && !isDollarBalanceOffered
        return transferWallets[balance] !== undefined && !isDollarLeftOut
      }),
    [transferWallets, isDollarBalanceOffered],
  )

  const initialPair = initialTransferPair({
    funds: {
      [WalletCurrency.Btc]: btcWallet?.balance ?? 0,
      [WalletCurrency.Usd]: usdWallet?.balance ?? 0,
    },
    balances,
    destination,
    isDrainConversion,
  })
  const initialFromWallet = transferWallets[initialPair.from]
  const initialToWallet = transferWallets[initialPair.to]
  const isDirectionFixed = destination !== undefined

  /** Undefined until both sides are known, matching the convert hook's "no wallets yet"
   *  state. */
  const initialWallets = useMemo(
    () =>
      initialFromWallet && initialToWallet
        ? { initialFromWallet, initialToWallet, isDirectionFixed }
        : undefined,
    [initialFromWallet, initialToWallet, isDirectionFixed],
  )

  /** What each balance holds now; NaN while it is not known. */
  const balanceAmounts: Record<TransferBalance, MoneyAmount<WalletCurrency>> = {
    [WalletCurrency.Btc]: toBtcMoneyAmount(btcWallet?.balance ?? NaN),
    [WalletCurrency.Usd]: toUsdMoneyAmount(usdWallet?.balance ?? NaN),
    [CARD]: toBtcMoneyAmount(card?.availableSats ?? NaN),
  }

  return { transferWallets, balances, balanceAmounts, initialWallets, isDirectionFixed }
}
