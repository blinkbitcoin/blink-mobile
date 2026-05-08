import {
  PaymentDetails,
  PaymentMethod,
  type BreezSdkInterface,
  type GetInfoResponse,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toWalletMoneyAmount } from "@app/types/amounts"
import { type NormalizedTransaction } from "@app/types/transaction.types"
import { toWalletId, type WalletState } from "@app/types/wallet.types"

import { findUsdbToken, getWalletInfo, listPayments } from "../bridge"
import { requireSparkTokenIdentifier } from "../config"
import { mapSelfCustodialTransactions } from "../mappers/transaction-mapper"

const TRANSACTIONS_PER_PAGE = 20

const getStableBalance = (info: GetInfoResponse): number => {
  const token = findUsdbToken(info)
  if (!token) return 0
  const decimals = token.tokenMetadata?.decimals ?? 0
  return tokenBaseUnitsToCents(Number(token.balance), decimals)
}

const isKnownPayment = (payment: Payment): boolean => {
  if (payment.method !== PaymentMethod.Token) return true
  if (!payment.details || !PaymentDetails.Token.instanceOf(payment.details)) return false
  return payment.details.inner.metadata.identifier === requireSparkTokenIdentifier()
}

type PaymentsPage = {
  transactions: NormalizedTransaction[]
  rawCount: number
  hasMore: boolean
}

const fetchAndMapPayments = async (
  sdk: BreezSdkInterface,
  offset: number,
): Promise<PaymentsPage> => {
  const response = await listPayments(sdk, offset, TRANSACTIONS_PER_PAGE)
  const transactions = mapSelfCustodialTransactions(
    response.payments.filter(isKnownPayment),
  )
  return {
    transactions,
    rawCount: response.payments.length,
    hasMore: response.payments.length >= TRANSACTIONS_PER_PAGE,
  }
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
  rawTransactionCount: number
}

export const getSelfCustodialWalletSnapshot = async (
  sdk: BreezSdkInterface,
): Promise<WalletSnapshot> => {
  const info = await getWalletInfo(sdk)
  const page = await fetchAndMapPayments(sdk, 0)

  return {
    wallets: buildWallets(
      {
        identityPubkey: info.identityPubkey,
        btcBalance: Number(info.balanceSats),
        stableBalance: getStableBalance(info),
      },
      page.transactions,
    ),
    hasMore: page.hasMore,
    rawTransactionCount: page.rawCount,
  }
}

export const appendTransactions = (
  wallets: WalletState[],
  newTxs: NormalizedTransaction[],
): WalletState[] =>
  wallets.map((w) => {
    const compatible = newTxs.filter((tx) => tx.amount.currency === w.walletCurrency)
    const merged = new Map([...w.transactions, ...compatible].map((tx) => [tx.id, tx]))
    return { ...w, transactions: [...merged.values()] }
  })

export const loadMoreTransactions = async (
  sdk: BreezSdkInterface,
  rawOffset: number,
): Promise<PaymentsPage> => fetchAndMapPayments(sdk, rawOffset)
