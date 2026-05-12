import * as React from "react"
import { InteractionManager, SectionList, Text, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles } from "@rn-vui/themed"
import { gql, useApolloClient } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import { useNavigation, RouteProp } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import {
  TransactionFragment,
  TransactionFragmentDoc,
  useTransactionListForDefaultAccountQuery,
  useWalletOverviewScreenQuery,
  WalletCurrency,
  TxDirection,
  TxStatus,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { getTransactionDescription } from "@app/self-custodial/mappers/transaction-description"
import { toTransactionFragments } from "@app/self-custodial/mappers/to-transaction-fragment"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  WalletFilterDropdown,
  WalletValues,
} from "@app/components/wallet-filter-dropdown"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useTransactionSeenState } from "@app/hooks"
import { useRemoteConfig } from "@app/config/feature-flags-context"

import { MemoizedTransactionItem } from "@app/components/transaction-item"
import { toastShow } from "../../utils/toast"

import TransactionHistorySkeleton from "./transaction-history-skeleton"

gql`
  query transactionListForDefaultAccount(
    $first: Int
    $after: String
    $walletIds: [WalletId!]
  ) {
    me {
      id
      defaultAccount {
        id
        pendingIncomingTransactions {
          ...Transaction
        }
        transactions(first: $first, after: $after, walletIds: $walletIds) {
          ...TransactionList
        }
      }
    }
  }
`

const INITIAL_ITEMS_TO_RENDER = 14
const RENDER_BATCH_SIZE = 14
const QUERY_BATCH_SIZE = INITIAL_ITEMS_TO_RENDER * 1.5

type TransactionHistoryScreenProps = {
  route: RouteProp<RootStackParamList, "transactionHistory">
}

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  route,
}) => {
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const [walletFilter, setWalletFilter] = React.useState<WalletValues>(
    route.params?.currencyFilter ?? "ALL",
  )

  const isAuthed = useIsAuthed()
  const client = useApolloClient()
  const activeWallet = useActiveWallet()
  const { loadMore: selfCustodialLoadMore, refreshWallets: refreshSelfCustodialWallets } =
    useSelfCustodialWallet()
  const [selfCustodialRefreshing, setSelfCustodialRefreshing] = React.useState(false)
  const { convertMoneyAmount, displayCurrency } = usePriceConversion()
  const { fractionDigits } = useDisplayCurrency()
  const { feeReimbursementMemo } = useRemoteConfig()

  const [deferQueries, setDeferQueries] = React.useState(true)

  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setDeferQueries(false)
    })
    return () => task.cancel()
  }, [])

  const hasRouteWallets = (route.params?.wallets?.length ?? 0) > 0

  const [availableWallets, setAvailableWallets] = React.useState<
    ReadonlyArray<{ id: string; walletCurrency: WalletCurrency }>
  >(route.params?.wallets ?? [])

  const { data: walletOverviewData } = useWalletOverviewScreenQuery({
    skip: !isAuthed || hasRouteWallets || deferQueries,
    fetchPolicy: "cache-first",
  })

  const walletIdsByCurrency = React.useMemo(() => {
    if (!availableWallets.length) return undefined

    if (walletFilter === "ALL") {
      return availableWallets.map((w) => w.id)
    }

    return availableWallets
      .filter((w) => w.walletCurrency === walletFilter)
      .map((w) => w.id)
  }, [availableWallets, walletFilter])

  const { data, previousData, error, fetchMore, refetch, loading } =
    useTransactionListForDefaultAccountQuery({
      skip: !isAuthed || deferQueries,
      fetchPolicy: "cache-and-network",
      returnPartialData: true,
      variables: {
        first: QUERY_BATCH_SIZE,
        walletIds: walletIdsByCurrency,
      },
    })

  const dataToRender = data ?? previousData

  React.useEffect(() => {
    if (availableWallets.length) return
    if (deferQueries) return

    const queryWallets = walletOverviewData?.me?.defaultAccount?.wallets ?? []
    if (queryWallets.length === 0) return

    setAvailableWallets(queryWallets)
  }, [
    availableWallets.length,
    walletOverviewData?.me?.defaultAccount?.wallets,
    deferQueries,
  ])

  const accountId = dataToRender?.me?.defaultAccount?.id
  const pendingIncomingTransactions =
    dataToRender?.me?.defaultAccount?.pendingIncomingTransactions
  const transactions = dataToRender?.me?.defaultAccount?.transactions

  const selfCustodialDisplayInfo = React.useMemo(
    () =>
      convertMoneyAmount
        ? { displayCurrency, convertMoneyAmount, fractionDigits }
        : undefined,
    [convertMoneyAmount, displayCurrency, fractionDigits],
  )

  const allSelfCustodialFragments = React.useMemo(() => {
    if (!activeWallet.isSelfCustodial) return []
    const allTxs = activeWallet.wallets.flatMap((w) => w.transactions)
    const describe = (tx: Parameters<typeof getTransactionDescription>[0]) =>
      getTransactionDescription(tx, LL)
    const fragments = toTransactionFragments(allTxs, selfCustodialDisplayInfo, describe)
    return fragments.filter((tx) => tx.status !== TxStatus.Failure)
  }, [activeWallet.isSelfCustodial, activeWallet.wallets, selfCustodialDisplayInfo, LL])

  const selfCustodialFragments = React.useMemo(() => {
    if (walletFilter === "ALL") return allSelfCustodialFragments
    return allSelfCustodialFragments.filter(
      (tx) => tx.settlementCurrency === walletFilter,
    )
  }, [allSelfCustodialFragments, walletFilter])

  const selfCustodialSettled = React.useMemo(
    () => selfCustodialFragments.filter((tx) => tx.status !== TxStatus.Pending),
    [selfCustodialFragments],
  )

  const selfCustodialPending = React.useMemo(
    () => selfCustodialFragments.filter((tx) => tx.status === TxStatus.Pending),
    [selfCustodialFragments],
  )

  React.useEffect(() => {
    if (allSelfCustodialFragments.length === 0) return
    const task = InteractionManager.runAfterInteractions(() => {
      client.cache.batch({
        update: (cache) => {
          allSelfCustodialFragments.forEach((tx) => {
            cache.writeFragment({
              id: cache.identify({ __typename: "Transaction", id: tx.id }),
              fragment: TransactionFragmentDoc,
              fragmentName: "Transaction",
              data: tx,
            })
          })
        },
      })
    })
    return () => task.cancel()
  }, [client, allSelfCustodialFragments])

  const settledTxs = React.useMemo(() => {
    if (activeWallet.isSelfCustodial) return selfCustodialSettled
    return transactions?.edges?.map((e) => e.node) ?? []
  }, [activeWallet.isSelfCustodial, selfCustodialSettled, transactions])

  const pendingTxs = React.useMemo<TransactionFragment[]>(() => {
    if (activeWallet.isSelfCustodial) return selfCustodialPending
    return pendingIncomingTransactions ? [...pendingIncomingTransactions] : []
  }, [activeWallet.isSelfCustodial, selfCustodialPending, pendingIncomingTransactions])

  const sections = React.useMemo(
    () =>
      groupTransactionsByDate({
        pendingIncomingTxs: pendingTxs,
        txs: settledTxs,
        LL,
        locale,
      }),
    [pendingTxs, settledTxs, LL, locale],
  )

  const allTransactions = React.useMemo(() => {
    const transactions: TransactionFragment[] = []
    transactions.push(...pendingTxs)
    transactions.push(...settledTxs)
    return transactions
  }, [pendingTxs, settledTxs])

  const {
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    lastSeenBtcId,
    lastSeenUsdId,
    latestBtcTxId,
    latestUsdTxId,
    markTxSeen,
  } = useTransactionSeenState(accountId || "", allTransactions)

  const [seenTxIds, setSeenTxIds] = React.useState<Set<string>>(new Set())

  const [highlightBaselineLastSeen, setHighlightBaselineLastSeen] = React.useState<{
    btcId: string
    usdId: string
  } | null>(() => {
    if (lastSeenBtcId || lastSeenUsdId) {
      return { btcId: lastSeenBtcId, usdId: lastSeenUsdId }
    }
    return null
  })

  React.useEffect(() => {
    if (loading) return

    if (highlightBaselineLastSeen === null) {
      setHighlightBaselineLastSeen({ btcId: lastSeenBtcId, usdId: lastSeenUsdId })
      return
    }

    const missingBtc = !highlightBaselineLastSeen.btcId && lastSeenBtcId
    const missingUsd = !highlightBaselineLastSeen.usdId && lastSeenUsdId

    if (missingBtc || missingUsd) {
      setHighlightBaselineLastSeen({
        btcId: missingBtc ? lastSeenBtcId : highlightBaselineLastSeen.btcId,
        usdId: missingUsd ? lastSeenUsdId : highlightBaselineLastSeen.usdId,
      })
    }
  }, [loading, highlightBaselineLastSeen, lastSeenBtcId, lastSeenUsdId])

  const lastSeenIdForAll = React.useMemo(() => {
    if (!highlightBaselineLastSeen?.btcId || !highlightBaselineLastSeen?.usdId) return ""

    return highlightBaselineLastSeen.btcId < highlightBaselineLastSeen.usdId
      ? highlightBaselineLastSeen.btcId
      : highlightBaselineLastSeen.usdId
  }, [highlightBaselineLastSeen])

  const shouldHighlightTransactionId = React.useCallback(
    ({
      txId,
      settlementCurrency,
      memo,
      direction,
    }: {
      txId: string
      settlementCurrency?: WalletCurrency | null
      memo?: string | null
      direction?: TxDirection | null
    }) => {
      if (seenTxIds.has(txId)) return false
      if (!highlightBaselineLastSeen) return false
      if (!settlementCurrency) return false
      if (memo?.toLowerCase() === feeReimbursementMemo.toLowerCase()) return false
      if (direction !== TxDirection.Receive) return false

      const lastSeenIdForCurrency =
        settlementCurrency === WalletCurrency.Btc
          ? highlightBaselineLastSeen.btcId
          : settlementCurrency === WalletCurrency.Usd
            ? highlightBaselineLastSeen.usdId
            : ""

      const latestTxIdForCurrency =
        settlementCurrency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId

      if (walletFilter === "ALL") {
        if (lastSeenIdForAll) {
          return txId > lastSeenIdForCurrency && txId > lastSeenIdForAll
        }
        return lastSeenIdForCurrency
          ? txId > lastSeenIdForCurrency
          : txId === latestTxIdForCurrency
      }

      if (settlementCurrency !== walletFilter) return false

      return lastSeenIdForCurrency
        ? txId > lastSeenIdForCurrency
        : txId === latestTxIdForCurrency
    },
    [
      walletFilter,
      highlightBaselineLastSeen,
      lastSeenIdForAll,
      seenTxIds,
      feeReimbursementMemo,
      latestBtcTxId,
      latestUsdTxId,
    ],
  )

  React.useEffect(() => {
    if (loading) return
    if (!highlightBaselineLastSeen) return

    if (walletFilter === "ALL") {
      if (hasUnseenBtcTx) markTxSeen(WalletCurrency.Btc)
      if (hasUnseenUsdTx) markTxSeen(WalletCurrency.Usd)
      return
    }

    if (walletFilter === WalletCurrency.Btc && hasUnseenBtcTx) {
      markTxSeen(WalletCurrency.Btc)
    }

    if (walletFilter === WalletCurrency.Usd && hasUnseenUsdTx) {
      markTxSeen(WalletCurrency.Usd)
    }
  }, [
    loading,
    highlightBaselineLastSeen,
    walletFilter,
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    markTxSeen,
  ])

  const handleItemPress = React.useCallback(
    (txid: string) => {
      navigation.navigate("transactionDetail", { txid })
      InteractionManager.runAfterInteractions(() => {
        setSeenTxIds((prev) => new Set(prev).add(txid))
      })
    },
    [navigation],
  )

  const renderItem = React.useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: TransactionFragment
      index: number
      section: { data: readonly TransactionFragment[] }
    }) => (
      <MemoizedTransactionItem
        key={`txn-${item.id}`}
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
        txid={item.id}
        subtitle
        testId={`transaction-by-index-${index}`}
        highlight={shouldHighlightTransactionId({
          txId: item.id,
          settlementCurrency: item.settlementCurrency,
          memo: item.memo,
          direction: item.direction,
        })}
        onPress={() => handleItemPress(item.id)}
      />
    ),
    [shouldHighlightTransactionId, handleItemPress],
  )

  if (error) {
    console.error(error)
    crashlytics().recordError(error)
    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
    return <></>
  }

  const refreshing = activeWallet.isSelfCustodial ? selfCustodialRefreshing : loading

  if (deferQueries || (!transactions && !activeWallet.isSelfCustodial)) {
    return (
      <Screen>
        <WalletFilterDropdown
          selected={walletFilter}
          onSelectionChange={setWalletFilter}
          loading={true}
        />
        <View style={styles.skeletonWrapper}>
          <TransactionHistorySkeleton />
        </View>
      </Screen>
    )
  }

  const fetchNextTransactionsPage = () => {
    if (activeWallet.isSelfCustodial) {
      selfCustodialLoadMore()
      return
    }

    const pageInfo = transactions?.pageInfo
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return

    fetchMore({
      variables: {
        first: QUERY_BATCH_SIZE,
        walletIds: walletIdsByCurrency,
        after: pageInfo.endCursor,
      },
    })
  }

  const handleRefresh = async () => {
    if (!activeWallet.isSelfCustodial) {
      refetch()
      return
    }
    setSelfCustodialRefreshing(true)
    try {
      await refreshSelfCustodialWallets()
    } finally {
      setSelfCustodialRefreshing(false)
    }
  }

  return (
    <Screen>
      <WalletFilterDropdown
        selected={walletFilter}
        onSelectionChange={setWalletFilter}
        loading={refreshing}
      />
      <SectionList
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={RENDER_BATCH_SIZE}
        initialNumToRender={INITIAL_ITEMS_TO_RENDER}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.noTransactionView}>
            <Text style={styles.noTransactionText}>
              {LL.TransactionScreen.noTransaction()}
            </Text>
          </View>
        }
        sections={sections}
        keyExtractor={(item) => item.id}
        onEndReached={fetchNextTransactionsPage}
        onEndReachedThreshold={0.5}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  skeletonWrapper: { flex: 1, alignSelf: "stretch" },
  noTransactionText: {
    fontSize: 24,
  },

  noTransactionView: {
    alignItems: "center",
    flex: 1,
    marginVertical: 48,
  },

  sectionHeaderContainer: {
    backgroundColor: colors.white,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },

  sectionHeaderText: {
    color: colors.black,
    fontSize: 18,
  },
}))
