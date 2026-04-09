import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { toWalletId, type WalletState } from "@app/types/wallet.types"

import { SparkToken } from "../config"
import { mapSelfCustodialTransactions } from "../mappers/transaction-mapper"

export const getSelfCustodialWalletSnapshot = async (
  sdk: BreezSdkInterface,
): Promise<WalletState[]> => {
  const info = await sdk.getInfo({ ensureSynced: false })

  const btcBalance = Number(info.balanceSats)
  const usdbEntry = Object.entries(info.tokenBalances).find(
    ([, token]) => token.tokenMetadata?.ticker === SparkToken.Ticker,
  )
  const usdBalance = usdbEntry ? Number(usdbEntry[1].balance) : 0

  const btcWallet: WalletState = {
    id: toWalletId(`${info.identityPubkey}-btc`),
    walletCurrency: WalletCurrency.Btc,
    balance: toBtcMoneyAmount(btcBalance),
    transactions: [],
  }

  const usdWallet: WalletState = {
    id: toWalletId(`${info.identityPubkey}-usd`),
    walletCurrency: WalletCurrency.Usd,
    balance: toUsdMoneyAmount(usdBalance),
    transactions: [],
  }

  const payments = await sdk.listPayments({
    typeFilter: undefined,
    statusFilter: undefined,
    assetFilter: undefined,
    paymentDetailsFilter: undefined,
    fromTimestamp: undefined,
    toTimestamp: undefined,
    offset: undefined,
    limit: 50,
    sortAscending: false,
  })

  const txs = mapSelfCustodialTransactions(payments.payments)
  const btcTxs = txs.filter((tx) => tx.amount.currency === WalletCurrency.Btc)
  const usdTxs = txs.filter((tx) => tx.amount.currency === WalletCurrency.Usd)

  return [
    { ...btcWallet, transactions: btcTxs },
    { ...usdWallet, transactions: usdTxs },
  ]
}
