import {
  PaymentDetails,
  PaymentMethod,
  type BreezSdkInterface,
  type Payment,
  type TokenBalance,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toWalletMoneyAmount } from "@app/types/amounts"
import { type NormalizedTransaction } from "@app/types/transaction.types"
import { toWalletId, type WalletState } from "@app/types/wallet.types"

import { getWalletInfo, listPayments } from "../bridge"
import { SparkConfig, SparkToken } from "../config"
import { mapSelfCustodialTransactions } from "../mappers/transaction-mapper"

const TRANSACTIONS_PER_PAGE = 20

const getStableBalance = (
  tokenBalances: Map<string, TokenBalance> | Record<string, TokenBalance>,
): number => {
  const entries: [string, TokenBalance][] =
    tokenBalances instanceof Map
      ? [...tokenBalances.entries()]
      : Object.entries(tokenBalances)

  const match = entries.find(
    ([, token]) => token.tokenMetadata?.ticker === SparkToken.Ticker,
  )
  if (!match) return 0

  const decimals = match[1].tokenMetadata?.decimals ?? 0
  return tokenBaseUnitsToCents(Number(match[1].balance), decimals)
}

const isKnownPayment = (payment: Payment): boolean => {
  if (payment.method !== PaymentMethod.Token) return true
  if (!payment.details || !PaymentDetails.Token.instanceOf(payment.details)) return false
  return payment.details.inner.metadata.identifier === SparkConfig.tokenIdentifier
}

const fetchAndMapPayments = async (
  sdk: BreezSdkInterface,
  offset: number,
): Promise<NormalizedTransaction[]> => {
  const response = await listPayments(sdk, offset, TRANSACTIONS_PER_PAGE)

  return mapSelfCustodialTransactions(response.payments.filter(isKnownPayment))
}

type WalletBalances = {
  identityPubkey: string
  btcBalance: number
  stableBalance: number
}

const buildWallets = (
  balances: WalletBalances,
  transactions: NormalizedTransaction[],
): WalletState[] => [
  {
    id: toWalletId(`${balances.identityPubkey}-btc`),
    walletCurrency: WalletCurrency.Btc,
    balance: toWalletMoneyAmount(balances.btcBalance, WalletCurrency.Btc),
    transactions: transactions.filter((tx) => tx.amount.currency === WalletCurrency.Btc),
  },
  {
    id: toWalletId(`${balances.identityPubkey}-usd`),
    walletCurrency: WalletCurrency.Usd,
    balance: toWalletMoneyAmount(balances.stableBalance, WalletCurrency.Usd),
    transactions: transactions.filter((tx) => tx.amount.currency === WalletCurrency.Usd),
  },
]

export type WalletSnapshot = {
  wallets: WalletState[]
  hasMore: boolean
}

export const getSelfCustodialWalletSnapshot = async (
  sdk: BreezSdkInterface,
): Promise<WalletSnapshot> => {
  const info = await getWalletInfo(sdk)
  const transactions = await fetchAndMapPayments(sdk, 0)

  return {
    wallets: buildWallets(
      {
        identityPubkey: info.identityPubkey,
        btcBalance: Number(info.balanceSats),
        stableBalance: getStableBalance(info.tokenBalances),
      },
      transactions,
    ),
    hasMore: transactions.length >= TRANSACTIONS_PER_PAGE,
  }
}

export const appendTransactions = (
  wallets: WalletState[],
  newTxs: NormalizedTransaction[],
): WalletState[] =>
  wallets.map((w) => ({
    ...w,
    transactions: [
      ...w.transactions,
      ...newTxs.filter((tx) => tx.amount.currency === w.walletCurrency),
    ],
  }))

export const loadMoreTransactions = async (
  sdk: BreezSdkInterface,
  currentCount: number,
): Promise<{ transactions: NormalizedTransaction[]; hasMore: boolean }> => {
  const transactions = await fetchAndMapPayments(sdk, currentCount)
  return {
    transactions,
    hasMore: transactions.length >= TRANSACTIONS_PER_PAGE,
  }
}
