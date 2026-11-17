import {
  type BreezSdkInterface,
  type TokenBalance,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toWalletMoneyAmount } from "@app/types/amounts"
import { type NormalizedTransaction } from "@app/types/transaction"
import { toWalletId, type WalletState } from "@app/types/wallet"

import { findUsdbToken, getWalletInfo } from "../bridge"
import { recordErrorOnce } from "../logging"
import { latestOnchainReceiptId } from "../storage/onchain-address"

import {
  fetchAndMapPayments,
  TRANSACTIONS_PER_PAGE,
  type PaymentsPage,
} from "./payments-page"

const getStableBalance = (token: TokenBalance | undefined): number => {
  if (!token) return 0
  const decimals = token.tokenMetadata?.decimals ?? 0
  return tokenBaseUnitsToCents(Number(token.balance), decimals)
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

/**
 * Larger pages than the UI uses: this walk only looks at one field per payment and
 * stops at the first on-chain receipt, so fewer round trips beats a shorter page.
 */
const ONCHAIN_LOOKBACK_PAGE_SIZE = 100
/**
 * 300 payments back. Past that we report "not found", which reads as "we do not know"
 * and never rotates — the same standstill as before this lookback existed, and the
 * next deposit puts a receipt back at the top of the history to arm it again.
 */
const ONCHAIN_LOOKBACK_MAX_PAGES = 3

/**
 * The newest on-chain receipt in the wallet, read straight from the SDK rather than
 * from the page of history the UI happens to hold.
 *
 * `allTransactions` only carries the newest page, so a wallet that has transacted past
 * it shows no on-chain receipt at all — indistinguishable from one that has never been
 * paid on-chain, which is exactly the case where the receive screen must not hand out
 * a used address. Callers ask for this only when that page has none.
 */
export const findLatestOnchainReceiptId = async (
  sdk: BreezSdkInterface,
): Promise<string | null> => {
  for (let page = 0; page < ONCHAIN_LOOKBACK_MAX_PAGES; page += 1) {
    const { transactions, hasMore } = await fetchAndMapPayments(
      sdk,
      page * ONCHAIN_LOOKBACK_PAGE_SIZE,
      ONCHAIN_LOOKBACK_PAGE_SIZE,
    )
    const receiptId = latestOnchainReceiptId(transactions)
    if (receiptId) return receiptId
    // A short page is the end of the history: there is no receipt to find, rather
    // than one we ran out of budget before reaching.
    if (!hasMore) return null
  }
  return null
}
