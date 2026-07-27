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
import { type NormalizedTransaction } from "@app/types/transaction"
import { toWalletId, type WalletState } from "@app/types/wallet"

import { findUsdbToken, getWalletInfo, listPayments } from "../bridge"
import { requireSparkTokenIdentifier } from "../config"
import { recordErrorOnce } from "../logging"
import { mapSelfCustodialTransactions } from "../mappers/transaction"

const TRANSACTIONS_PER_PAGE = 20

const getStableBalance = (token: TokenBalance | undefined): number => {
  if (!token) return 0
  const decimals = token.tokenMetadata?.decimals ?? 0
  return tokenBaseUnitsToCents(Number(token.balance), decimals)
}

const isKnownPayment = (payment: Payment): boolean => {
  if (payment.method !== PaymentMethod.Token) return true
  if (!payment.details || !PaymentDetails.Token.instanceOf(payment.details)) return false
  const expectedIdentifier = requireSparkTokenIdentifier()
  const observedIdentifier = payment.details.inner.metadata.identifier
  if (observedIdentifier === expectedIdentifier) return true
  recordErrorOnce(
    `spark-unknown-token-payment:${observedIdentifier}`,
    new Error(
      `Unknown token payment dropped: id=${observedIdentifier} expected=${expectedIdentifier}`,
    ),
  )
  return false
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
  allTransactions: NormalizedTransaction[]
  hasMore: boolean
  rawTransactionCount: number
}

export const getSelfCustodialWalletSnapshot = async (
  sdk: BreezSdkInterface,
  targetRawCount: number = TRANSACTIONS_PER_PAGE,
): Promise<WalletSnapshot> => {
  const info = await getWalletInfo(sdk)
  const minRawCount = Math.max(targetRawCount, TRANSACTIONS_PER_PAGE)

  const transactions: NormalizedTransaction[] = []
  let rawTransactionCount = 0
  let hasMore = false

  while (rawTransactionCount < minRawCount) {
    const page = await fetchAndMapPayments(sdk, rawTransactionCount)
    if (page.rawCount === 0) break

    transactions.push(...page.transactions)
    rawTransactionCount += page.rawCount
    hasMore = page.hasMore

    if (!hasMore) break
  }

  const usdbToken = findUsdbToken(info)
  if (
    !usdbToken &&
    transactions.some((tx) => tx.amount.currency === WalletCurrency.Usd)
  ) {
    // The expected-state breadcrumb above covers fresh wallets; a wallet WITH USD
    // history but no token entry would silently show a 0 stable balance.
    recordErrorOnce(
      "spark-token-missing-with-usd-history",
      new Error(
        "USDB token absent from getInfo but USD transactions exist; stable balance shown as 0",
      ),
    )
  }

  return {
    wallets: buildWallets(
      {
        identityPubkey: info.identityPubkey,
        btcBalance: Number(info.balanceSats),
        stableBalance: getStableBalance(usdbToken),
      },
      transactions,
    ),
    allTransactions: transactions,
    hasMore,
    rawTransactionCount,
  }
}

const dedupeTransactionsById = (
  transactions: NormalizedTransaction[],
): NormalizedTransaction[] => [...new Map(transactions.map((tx) => [tx.id, tx])).values()]

export const appendTransactions = (
  wallets: WalletState[],
  newTxs: NormalizedTransaction[],
): WalletState[] =>
  wallets.map((w) => {
    const compatible = newTxs.filter((tx) => tx.amount.currency === w.walletCurrency)
    return {
      ...w,
      transactions: dedupeTransactionsById([...w.transactions, ...compatible]),
    }
  })

export const mergeOrderedTransactions = (
  existing: NormalizedTransaction[],
  incoming: NormalizedTransaction[],
): NormalizedTransaction[] =>
  dedupeTransactionsById([...existing, ...incoming]).sort(
    (a, b) => b.timestamp - a.timestamp,
  )

export const loadMoreTransactions = async (
  sdk: BreezSdkInterface,
  rawOffset: number,
): Promise<PaymentsPage> => fetchAndMapPayments(sdk, rawOffset)
