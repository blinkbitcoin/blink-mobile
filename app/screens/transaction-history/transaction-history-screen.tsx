import * as React from "react"
import { InteractionManager, SectionList, Text, View } from "react-native"
import Animated, { LinearTransition } from "react-native-reanimated"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useNavigation, RouteProp } from "@react-navigation/native"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { headerRightNoGlass } from "@app/components/header-no-glass"
import { Screen } from "@app/components/screen"
import { WalletSummary } from "@app/components/wallet-summary"
import { type WalletSwitchValue as WalletValues } from "@app/components/wallet-switch"
import {
  TransactionFragment,
  useTransactionListForDefaultAccountQuery,
  useWalletOverviewScreenQuery,
  WalletCurrency,
  TxDirection,
  TxStatus,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { shouldHighlightById } from "@app/custodial/mappers/transaction-highlight"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { NO_TRANSACTIONS } from "@app/types/transaction"
import {
  resolveHighlightBaseline,
  shouldHighlightByTimestamp,
  type HighlightBaseline,
} from "@app/self-custodial/mappers/transaction-highlight"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHasTransitioned, useTransactionSeenState } from "@app/hooks"
import { useDebouncedEffect } from "@app/hooks/use-debounce"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

import {
  MemoizedTransactionItem,
  TRANSACTION_LIST_WINDOW_SIZE,
} from "@app/components/transaction-item"
import { toastShow } from "../../utils/toast"

import TransactionHistorySkeleton from "./transaction-history-skeleton"
import {
  ALL_DIRECTIONS,
  NoResultsCard,
  TransactionHistoryFilters,
  toggleDirection,
  type DirectionFilter,
} from "./transaction-history-filters"
import { useHistoryWalletSummary } from "./use-history-wallet-summary"

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
const SEARCH_DEBOUNCE_MS = 300
const LAYOUT_TRANSITION_MS = 200

/**
 * The backend can't filter custodial history yet, so a search with no match downloads older
 * pages to look through. Pages are as large as the API allows (`MAX_PAGINATION_PAGE_SIZE`),
 * and the search stops once this many transactions are loaded: ~10 requests, a few seconds.
 */
const CUSTODIAL_SEARCH_PAGE_SIZE = 100
const CUSTODIAL_SEARCH_CAP = 1000

const keyExtractor = (item: TransactionFragment) => item.id

type TransactionHistoryScreenProps = {
  route: RouteProp<RootStackParamList, "transactionHistory">
}

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  route,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { hideAmount } = useHideAmount()
  const [selectedWallet, setSelectedWallet] = React.useState<WalletValues>(
    route.params?.currencyFilter ?? "ALL",
  )
  const walletSummary = useHistoryWalletSummary(selectedWallet)
  const walletFilter = walletSummary.wallet

  // Filters live only as long as the screen and the open panel: closing either clears them.
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [directions, setDirections] = React.useState<DirectionFilter>(ALL_DIRECTIONS)
  const [searchText, setSearchText] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")

  useDebouncedEffect(
    () => setSearchQuery(searchText.trim().toLowerCase()),
    SEARCH_DEBOUNCE_MS,
    [searchText],
  )

  const filtersActive = !directions.sent || !directions.received || searchQuery.length > 0

  const toggleFilters = React.useCallback(() => {
    setFiltersOpen((open) => {
      if (open) {
        setDirections(ALL_DIRECTIONS)
        setSearchText("")
        setSearchQuery("")
      }
      return !open
    })
  }, [])

  React.useEffect(() => {
    navigation.setOptions(
      headerRightNoGlass(() => (
        <GaloyIconButton
          {...testProps("transaction-history-filter-button")}
          name="filter"
          size={32}
          iconSize={20}
          color={filtersOpen ? colors.backgroundDefault : colors.accent}
          backgroundColor={filtersOpen ? colors.accent : colors.surfaceInteractive}
          onPress={toggleFilters}
          accessibilityRole="button"
          accessibilityLabel={LL.TransactionScreen.filters()}
          accessibilityState={{ expanded: filtersOpen }}
        />
      )),
    )
  }, [
    navigation,
    filtersOpen,
    toggleFilters,
    colors.backgroundDefault,
    colors.accent,
    colors.surfaceInteractive,
    LL,
  ])

  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const {
    allTransactions: selfCustodialAllTransactions,
    hasMoreTransactions: selfCustodialHasMore,
    loadMore: selfCustodialLoadMore,
    refreshWallets: refreshSelfCustodialWallets,
  } = useSelfCustodialWallet()
  const [selfCustodialRefreshing, setSelfCustodialRefreshing] = React.useState(false)
  const { feeReimbursementMemo } = useRemoteConfig()
  const hasTransitioned = useHasTransitioned()

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

  const selfCustodialSourceTransactions = React.useMemo(
    () => (activeWallet.isSelfCustodial ? selfCustodialAllTransactions : NO_TRANSACTIONS),
    [activeWallet.isSelfCustodial, selfCustodialAllTransactions],
  )

  const allSelfCustodialFragments = useSelfCustodialTransactionFragments(
    selfCustodialSourceTransactions,
  )

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

  const settledTxs = React.useMemo(() => {
    if (activeWallet.isSelfCustodial) return selfCustodialSettled
    return transactions?.edges?.map((e) => e.node) ?? []
  }, [activeWallet.isSelfCustodial, selfCustodialSettled, transactions])

  const pendingTxs = React.useMemo<TransactionFragment[]>(() => {
    if (activeWallet.isSelfCustodial) return selfCustodialPending
    return pendingIncomingTransactions ? [...pendingIncomingTransactions] : []
  }, [activeWallet.isSelfCustodial, selfCustodialPending, pendingIncomingTransactions])

  const matchesFilters = React.useCallback(
    (tx: TransactionFragment) => {
      if (!directions.sent && tx.direction === TxDirection.Send) return false
      if (!directions.received && tx.direction === TxDirection.Receive) return false
      if (searchQuery && !(tx.memo ?? "").toLowerCase().includes(searchQuery))
        return false
      return true
    },
    [directions, searchQuery],
  )

  const visibleSettledTxs = React.useMemo(
    () => (filtersActive ? settledTxs.filter(matchesFilters) : settledTxs),
    [filtersActive, settledTxs, matchesFilters],
  )

  const visiblePendingTxs = React.useMemo(
    () => (filtersActive ? pendingTxs.filter(matchesFilters) : pendingTxs),
    [filtersActive, pendingTxs, matchesFilters],
  )

  const sections = React.useMemo(
    () =>
      groupTransactionsByDate({
        pendingIncomingTxs: visiblePendingTxs,
        txs: visibleSettledTxs,
        LL,
        locale,
      }),
    [visiblePendingTxs, visibleSettledTxs, LL, locale],
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
    isNewEnoughToAnnounce,
    markTxSeen,
  } = useTransactionSeenState({
    accountId: accountId || "",
    isSelfCustodial: activeWallet.isSelfCustodial,
    transactions: allTransactions,
  })

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

    /** Only the custodial cache read can land after the first render, so only it fills
     *  in an id the baseline is missing. The device store is there from the start: an
     *  empty id is that baseline, and a later one could only be this screen's own mark. */
    if (activeWallet.isSelfCustodial) return

    const missingBtc = !highlightBaselineLastSeen.btcId && lastSeenBtcId
    const missingUsd = !highlightBaselineLastSeen.usdId && lastSeenUsdId

    if (missingBtc || missingUsd) {
      setHighlightBaselineLastSeen({
        btcId: missingBtc ? lastSeenBtcId : highlightBaselineLastSeen.btcId,
        usdId: missingUsd ? lastSeenUsdId : highlightBaselineLastSeen.usdId,
      })
    }
  }, [
    loading,
    highlightBaselineLastSeen,
    lastSeenBtcId,
    lastSeenUsdId,
    activeWallet.isSelfCustodial,
  ])

  const lastSeenIdForAll = React.useMemo(() => {
    if (!highlightBaselineLastSeen?.btcId || !highlightBaselineLastSeen?.usdId) return ""

    return highlightBaselineLastSeen.btcId < highlightBaselineLastSeen.usdId
      ? highlightBaselineLastSeen.btcId
      : highlightBaselineLastSeen.usdId
  }, [highlightBaselineLastSeen])

  const lastSeenCreatedAt = React.useMemo<HighlightBaseline>(() => {
    if (!activeWallet.isSelfCustodial) return { btc: null, usd: null }

    return resolveHighlightBaseline({
      fragments: allSelfCustodialFragments,
      baselineBtcId: highlightBaselineLastSeen?.btcId,
      baselineUsdId: highlightBaselineLastSeen?.usdId,
    })
  }, [activeWallet.isSelfCustodial, allSelfCustodialFragments, highlightBaselineLastSeen])

  const shouldHighlightTransactionId = React.useCallback(
    ({
      txId,
      createdAt,
      settlementCurrency,
      memo,
      direction,
    }: {
      txId: string
      createdAt: number
      settlementCurrency?: WalletCurrency | null
      memo?: string | null
      direction?: TxDirection | null
    }) => {
      if (seenTxIds.has(txId)) return false
      if (!highlightBaselineLastSeen) return false
      if (!settlementCurrency) return false
      if (memo?.toLowerCase() === feeReimbursementMemo.toLowerCase()) return false
      if (direction !== TxDirection.Receive) return false

      const latestTxIdForCurrency =
        settlementCurrency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId

      if (activeWallet.isSelfCustodial) {
        if (!isNewEnoughToAnnounce({ createdAt })) return false
        return shouldHighlightByTimestamp({
          createdAt,
          baselineCreatedAt:
            settlementCurrency === WalletCurrency.Btc
              ? lastSeenCreatedAt.btc
              : lastSeenCreatedAt.usd,
          isLatestForCurrency: txId === latestTxIdForCurrency,
        })
      }

      return shouldHighlightById({
        txId,
        settlementCurrency,
        walletFilter,
        baselineBtcId: highlightBaselineLastSeen.btcId,
        baselineUsdId: highlightBaselineLastSeen.usdId,
        lastSeenIdForAll,
        latestTxIdForCurrency,
      })
    },
    [
      walletFilter,
      highlightBaselineLastSeen,
      lastSeenIdForAll,
      seenTxIds,
      feeReimbursementMemo,
      latestBtcTxId,
      latestUsdTxId,
      activeWallet.isSelfCustodial,
      lastSeenCreatedAt,
      isNewEnoughToAnnounce,
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

  const loadedCount = activeWallet.isSelfCustodial
    ? allSelfCustodialFragments.length
    : transactions?.edges?.length ?? 0

  const hasMoreToSearch = activeWallet.isSelfCustodial
    ? selfCustodialHasMore
    : Boolean(transactions?.pageInfo?.hasNextPage) && loadedCount < CUSTODIAL_SEARCH_CAP

  // While the filters match nothing, the expanding search owns paging: the list's own
  // onEndReached is off, so the two can't ask for the same page at once.
  const filteredToNothing =
    filtersActive && visibleSettledTxs.length === 0 && visiblePendingTxs.length === 0

  // A round that fails or reads nothing stalls the search it was for. Changing the filters
  // or the wallet starts a new search; pulling to refresh retries the stalled one.
  const searchKey = `${walletFilter}|${directions.sent}|${directions.received}|${searchQuery}`
  const [stalledSearchKey, setStalledSearchKey] = React.useState<string | null>(null)

  const isExpandingSearch =
    filteredToNothing && hasMoreToSearch && stalledSearchKey !== searchKey

  const expandingRef = React.useRef(false)
  // The cursor last asked for: a round can end before the list re-renders with the next
  // cursor, and asking for the same one twice would fetch the same page again.
  const requestedCursorRef = React.useRef<string | null>(null)
  const [expandRound, setExpandRound] = React.useState(0)

  /**
   * While the filters match nothing, keeps loading older pages until something matches, the
   * history ends, the custodial cap is reached or a round makes no progress.
   */
  React.useEffect(() => {
    if (!isExpandingSearch || expandingRef.current) return

    const endCursor = transactions?.pageInfo?.endCursor
    if (!activeWallet.isSelfCustodial) {
      if (!endCursor || endCursor === requestedCursorRef.current) return
      requestedCursorRef.current = endCursor
    }

    expandingRef.current = true
    const roundSearchKey = searchKey
    const request: Promise<boolean> = activeWallet.isSelfCustodial
      ? selfCustodialLoadMore()
      : fetchMore({
          variables: {
            first: CUSTODIAL_SEARCH_PAGE_SIZE,
            walletIds: walletIdsByCurrency,
            after: endCursor,
          },
        }).then(
          (result) =>
            (result.data?.me?.defaultAccount?.transactions?.edges?.length ?? 0) > 0,
        )

    request
      .catch((err) => {
        reportError("transaction-history-search", err)
        return false
      })
      .then((progressed) => {
        expandingRef.current = false
        if (!progressed) {
          requestedCursorRef.current = null
          setStalledSearchKey(roundSearchKey)
        }
        setExpandRound((round) => round + 1)
      })
  }, [
    isExpandingSearch,
    expandRound,
    searchKey,
    activeWallet.isSelfCustodial,
    selfCustodialLoadMore,
    fetchMore,
    transactions?.pageInfo?.endCursor,
    walletIdsByCurrency,
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

  // A highlighted row bounces once per visit. Toggling a filter rebuilds the sections and
  // remounts the rows, which would otherwise bounce the newest transaction again.
  const bouncedTxIdsRef = React.useRef<Set<string>>(new Set())

  const renderItem = React.useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: TransactionFragment
      index: number
      section: { data: readonly TransactionFragment[] }
    }) => {
      const highlight = shouldHighlightTransactionId({
        txId: item.id,
        createdAt: item.createdAt,
        settlementCurrency: item.settlementCurrency,
        memo: item.memo,
        direction: item.direction,
      })
      const bounce = !bouncedTxIdsRef.current.has(item.id)
      if (highlight) bouncedTxIdsRef.current.add(item.id)

      return (
        <MemoizedTransactionItem
          key={`txn-${item.id}`}
          variant="card"
          isFirst={index === 0}
          isLast={index === section.data.length - 1}
          txid={item.id}
          subtitle
          testId={`transaction-by-index-${index}`}
          highlight={highlight}
          bounce={bounce}
          onPress={handleItemPress}
        />
      )
    },
    [shouldHighlightTransactionId, handleItemPress],
  )

  const renderSectionHeader = React.useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <View style={styles.sectionHeaderContainer}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
    ),
    [styles.sectionHeaderContainer, styles.sectionHeaderText],
  )

  if (error) {
    console.error(error)
    reportError("transaction-history", error)
    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
    return <></>
  }

  const refreshing = activeWallet.isSelfCustodial ? selfCustodialRefreshing : loading

  const selfCustodialSettling = activeWallet.isSelfCustodial && !hasTransitioned

  const showLoadingSkeleton =
    deferQueries ||
    (!transactions && !activeWallet.isSelfCustodial) ||
    selfCustodialSettling

  const { nextWallet } = walletSummary

  const topBar = (
    <View style={styles.topBar}>
      {filtersOpen ? (
        <TransactionHistoryFilters
          directions={directions}
          onToggleDirection={(direction) =>
            setDirections((current) => toggleDirection(current, direction))
          }
          searchText={searchText}
          onSearchTextChange={setSearchText}
        />
      ) : null}
      <Animated.View layout={LinearTransition.duration(LAYOUT_TRANSITION_MS)}>
        <WalletSummary
          currency={walletFilter}
          balancePrimary={walletSummary.balancePrimary}
          balanceSecondary={walletSummary.balanceSecondary}
          balanceHidden={hideAmount}
          balanceLoading={walletSummary.balanceLoading}
          onSwitch={nextWallet ? () => setSelectedWallet(nextWallet) : undefined}
          switchTo={nextWallet}
        />
      </Animated.View>
    </View>
  )

  if (showLoadingSkeleton) {
    return (
      <Screen>
        {topBar}
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
    setStalledSearchKey(null)
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
      {topBar}
      <Animated.View
        style={styles.list}
        layout={LinearTransition.duration(LAYOUT_TRANSITION_MS)}
      >
        <SectionList
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={RENDER_BATCH_SIZE}
          initialNumToRender={INITIAL_ITEMS_TO_RENDER}
          windowSize={TRANSACTION_LIST_WINDOW_SIZE}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListEmptyComponent={
            filtersActive ? (
              <View style={styles.noResultsWrapper}>
                <NoResultsCard expanding={isExpandingSearch} />
              </View>
            ) : (
              <View style={styles.noTransactionView}>
                <Text style={styles.noTransactionText}>
                  {LL.TransactionScreen.noTransaction()}
                </Text>
              </View>
            )
          }
          sections={sections}
          keyExtractor={keyExtractor}
          onEndReached={filteredToNothing ? undefined : fetchNextTransactionsPage}
          onEndReachedThreshold={0.5}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      </Animated.View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  skeletonWrapper: { flex: 1, alignSelf: "stretch", paddingHorizontal: 20 },
  topBar: {
    rowGap: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  list: {
    flex: 1,
  },
  noResultsWrapper: {
    paddingTop: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  noTransactionText: {
    fontSize: 24,
  },

  noTransactionView: {
    alignItems: "center",
    flex: 1,
    marginVertical: 48,
  },

  sectionHeaderContainer: {
    paddingTop: 20,
    paddingBottom: 5,
  },

  sectionHeaderText: {
    color: colors.textOnBackground,
    fontSize: 14,
    lineHeight: 18,
  },
}))
