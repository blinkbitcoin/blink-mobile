import { useCallback, useEffect, useMemo } from "react"
import { useApolloClient } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { markTxLastSeenId } from "@app/graphql/client-only-query"
import {
  TransactionFragment,
  useTxLastSeenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getTxLastSeenIds,
  hasTxLastSeenRecord,
  withTxLastSeenId,
  withTxSeenBaseline,
} from "@app/store/persistent-state/tx-last-seen"

import {
  isAnnounceableTransaction,
  useAccountTransactions,
} from "./use-account-transactions"

const getLatestTransaction = (
  transactions: ReadonlyArray<TransactionFragment>,
  currency: WalletCurrency,
  feeReimbursementMemo: string,
): TransactionFragment | undefined => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      transaction.settlementCurrency === currency &&
      isAnnounceableTransaction(transaction, feeReimbursementMemo),
  )
  if (filteredTransactions.length === 0) return undefined

  return filteredTransactions.reduce((latest, transaction) =>
    transaction.createdAt > latest.createdAt ? transaction : latest,
  )
}

type TransactionSeenStateParams = {
  /** Keys the custodial store only; self-custodial keys off the active account. */
  accountId: string
  isSelfCustodial: boolean
  transactions?: ReadonlyArray<TransactionFragment>
}

/**
 * Which transaction the user has already been shown, per currency, and how to mark the
 * current one as seen. Where that answer is stored depends on the account: custodial
 * keeps it in the Apollo cache, which the persistor restores on launch, while a
 * self-custodial account never restores that cache and so keeps it on device instead.
 *
 * The caller passes `isSelfCustodial` rather than the hook resolving it, so the flag that
 * picks the transactions fed in is the same one that picks where they are stored. Deriving
 * it here would mean a second, looser predicate that can only agree with the caller's by
 * accident. Self-custodial keys off the active account through `resolveAccountKey`, so
 * every screen agrees on the key without sourcing an id the custodial query cannot answer.
 */
export const useTransactionSeenState = ({
  accountId,
  isSelfCustodial,
  transactions,
}: TransactionSeenStateParams) => {
  const client = useApolloClient()
  const { feeReimbursementMemo } = useRemoteConfig()
  const { persistentState, updateState } = usePersistentStateContext()

  const baseTransactions = useAccountTransactions({ isSelfCustodial, transactions })

  const latestTransactions = useMemo(
    () => ({
      btc: getLatestTransaction(
        baseTransactions,
        WalletCurrency.Btc,
        feeReimbursementMemo,
      ),
      usd: getLatestTransaction(
        baseTransactions,
        WalletCurrency.Usd,
        feeReimbursementMemo,
      ),
    }),
    [baseTransactions, feeReimbursementMemo],
  )

  /** Skipped for self-custodial: that account reads the device store below, so leaving
   *  the query on would keep a cache watch alive for a result nothing consumes. */
  const { data: lastSeenData } = useTxLastSeenQuery({
    fetchPolicy: "cache-only",
    returnPartialData: true,
    variables: { accountId },
    skip: isSelfCustodial,
  })

  const cachedLastSeenBtcId = lastSeenData?.txLastSeen?.btcId || ""
  const cachedLastSeenUsdId = lastSeenData?.txLastSeen?.usdId || ""
  const deviceLastSeen = getTxLastSeenIds(persistentState)
  const hasDeviceRecord = hasTxLastSeenRecord(persistentState)

  /** A self-custodial account starts its record the first time it is read, so the history
   *  already there, and what a restore replays as it syncs, is never announced. */
  useEffect(() => {
    if (!isSelfCustodial || hasDeviceRecord) return
    updateState((prev) => prev && withTxSeenBaseline(prev, Date.now()))
  }, [isSelfCustodial, hasDeviceRecord, updateState])

  /** Custodial history is the server's and never replays. Self-custodial announces only
   *  what is newer than its record; with no record yet, nothing. */
  const isNewEnoughToAnnounce = useCallback(
    (transaction: TransactionFragment | undefined): boolean => {
      if (!transaction) return false
      if (!isSelfCustodial) return true
      if (!hasDeviceRecord) return false
      const { announceSinceMs } = deviceLastSeen
      return (
        announceSinceMs === undefined || transaction.createdAt * 1000 >= announceSinceMs
      )
    },
    [isSelfCustodial, hasDeviceRecord, deviceLastSeen],
  )

  const lastSeenBtcId = isSelfCustodial ? deviceLastSeen.btcId : cachedLastSeenBtcId
  const lastSeenUsdId = isSelfCustodial ? deviceLastSeen.usdId : cachedLastSeenUsdId
  const latestBtcTxId = latestTransactions.btc?.id ?? ""
  const latestUsdTxId = latestTransactions.usd?.id ?? ""

  const hasUnseenBtcTx = useMemo(
    () =>
      latestBtcTxId !== "" &&
      latestBtcTxId !== lastSeenBtcId &&
      isNewEnoughToAnnounce(latestTransactions.btc),
    [latestBtcTxId, lastSeenBtcId, isNewEnoughToAnnounce, latestTransactions.btc],
  )

  const hasUnseenUsdTx = useMemo(
    () =>
      latestUsdTxId !== "" &&
      latestUsdTxId !== lastSeenUsdId &&
      isNewEnoughToAnnounce(latestTransactions.usd),
    [latestUsdTxId, lastSeenUsdId, isNewEnoughToAnnounce, latestTransactions.usd],
  )

  const markTransactionAsSeen = useCallback(
    (currency: WalletCurrency) => {
      const transactionIdToMark =
        currency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId
      if (!transactionIdToMark) return

      if (isSelfCustodial) {
        updateState(
          (prev) =>
            prev &&
            withTxLastSeenId(
              withTxSeenBaseline(prev, Date.now()),
              currency,
              transactionIdToMark,
            ),
        )
        return
      }

      markTxLastSeenId({ client, accountId, currency, id: transactionIdToMark })
    },
    [client, latestBtcTxId, latestUsdTxId, accountId, isSelfCustodial, updateState],
  )

  return {
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    latestBtcTxId,
    latestUsdTxId,
    lastSeenBtcId,
    lastSeenUsdId,
    markTxSeen: markTransactionAsSeen,
  }
}
