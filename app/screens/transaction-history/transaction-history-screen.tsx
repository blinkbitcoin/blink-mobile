import * as React from "react"
import { InteractionManager, SectionList, Text, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles } from "@rn-vui/themed"
import { gql } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import { useNavigation, RouteProp } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import {
  TransactionFragment,
  useTransactionListForDefaultAccountQuery,
  useWalletOverviewScreenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useI18nContext } from "@app/i18n/i18n-react"
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

  const settledTxs = React.useMemo(
    () => transactions?.edges?.map((e) => e.node) ?? [],
    [transactions],
  )

  const pendingTxs = React.useMemo<TransactionFragment[]>(
    () => (pendingIncomingTransactions ? [...pendingIncomingTransactions] : []),
    [pendingIncomingTransactions],
  )

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

  const { hasUnseenBtcTx, hasUnseenUsdTx, lastSeenBtcId, lastSeenUsdId, markTxSeen } =
    useTransactionSeenState(accountId || "", allTransactions)

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
    }: {
      txId: string
      settlementCurrency?: WalletCurrency | null
      memo?: string | null
    }) => {
      if (seenTxIds.has(txId)) return false
      if (!highlightBaselineLastSeen) return false
      if (!settlementCurrency) return false
      if (memo?.toLowerCase() === feeReimbursementMemo.toLowerCase()) return false

      if (walletFilter === "ALL") {
        if (!lastSeenIdForAll) return false

        const lastSeenIdForCurrency =
          settlementCurrency === WalletCurrency.Btc
            ? highlightBaselineLastSeen.btcId
            : settlementCurrency === WalletCurrency.Usd
              ? highlightBaselineLastSeen.usdId
              : ""

        if (!lastSeenIdForCurrency) return false

        return txId > lastSeenIdForCurrency && txId > lastSeenIdForAll
      }

      if (settlementCurrency !== walletFilter) return false

      const lastSeenId =
        settlementCurrency === WalletCurrency.Btc
          ? highlightBaselineLastSeen.btcId
          : settlementCurrency === WalletCurrency.Usd
            ? highlightBaselineLastSeen.usdId
            : ""

      if (!lastSeenId) return false

      return txId > lastSeenId
    },
    [
      walletFilter,
      highlightBaselineLastSeen,
      lastSeenIdForAll,
      seenTxIds,
      feeReimbursementMemo,
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

  if (error) {
    console.error(error)
    crashlytics().recordError(error)
    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
    return <></>
  }

  if (deferQueries || !transactions) {
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

  return (
    <Screen>
      <WalletFilterDropdown
        selected={walletFilter}
        onSelectionChange={setWalletFilter}
        loading={loading}
      />
      <SectionList
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={RENDER_BATCH_SIZE}
        initialNumToRender={INITIAL_ITEMS_TO_RENDER}
        renderItem={({ item, index, section }) => (
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
            })}
            onPress={() => {
              setSeenTxIds((prev) => new Set(prev).add(item.id))
              navigation.navigate("transactionDetail", { txid: item.id })
            }}
          />
        )}
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
        onRefresh={() => refetch()}
        refreshing={loading}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  loadingContainer: { justifyContent: "center", alignItems: "center", flex: 1 },
  skeletonWrapper: { flex: 1, alignSelf: "stretch" },
  skeletonContainer: { alignSelf: "stretch" },
  loaderBackground: {
    color: colors.loaderBackground,
  },
  loaderForefound: {
    color: colors.loaderForeground,
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
