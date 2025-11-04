import * as React from "react"
import { ActivityIndicator, SectionList, Text, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"
import { RouteProp, useFocusEffect } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import {
  TransactionFragment,
  useTransactionListForDefaultAccountQuery,
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
import { useTransactionsNotification } from "@app/hooks"

import { MemoizedTransactionItem } from "../../components/transaction-item"
import { toastShow } from "../../utils/toast"

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

const lastHighlightedByCurrency: Partial<Record<WalletCurrency, string>> = {}

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  route,
}) => {
  const showLoading = route.params?.showLoading === true
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const [walletFilter, setWalletFilter] = React.useState<WalletValues>(
    route.params?.currencyFilter ?? "ALL",
  )

  const currencyFilter: WalletCurrency | undefined = route.params?.currencyFilter
  const walletIdsByCurrency = React.useMemo(() => {
    const wallets = route.params?.wallets ?? []
    return wallets
      .filter((w) => walletFilter === "ALL" || w.walletCurrency === walletFilter)
      .map((w) => w.id)
  }, [route.params?.wallets, walletFilter])

  const { data, error, fetchMore, refetch, loading } =
    useTransactionListForDefaultAccountQuery({
      skip: !useIsAuthed(),
      fetchPolicy: "cache-and-network",
      variables: {
        first: QUERY_BATCH_SIZE,
        walletIds: walletIdsByCurrency,
      },
    })

  const pendingIncomingTransactions =
    data?.me?.defaultAccount?.pendingIncomingTransactions
  const transactions = data?.me?.defaultAccount?.transactions

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

  const { latestBtcTxId, latestUsdTxId, hasUnseenBtcTx, hasUnseenUsdTx, markTxSeen } =
    useTransactionsNotification({
      transactions: allTransactions,
    })

  const newTx = React.useMemo(() => {
    if (walletFilter === "ALL") {
      const currency =
        (hasUnseenBtcTx && latestBtcTxId && WalletCurrency.Btc) ||
        (hasUnseenUsdTx && latestUsdTxId && WalletCurrency.Usd)
      if (!currency) return

      const id = currency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId
      return { id: id ?? "", currency }
    }

    const selectedCurrency =
      walletFilter === WalletCurrency.Btc || walletFilter === WalletCurrency.Usd
        ? walletFilter
        : currencyFilter

    if (selectedCurrency === WalletCurrency.Btc) {
      return { id: latestBtcTxId, currency: WalletCurrency.Btc }
    }

    if (selectedCurrency === WalletCurrency.Usd) {
      return { id: latestUsdTxId, currency: WalletCurrency.Usd }
    }
  }, [
    walletFilter,
    currencyFilter,
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    latestBtcTxId,
    latestUsdTxId,
  ])

  const [stickyHighlightId, setStickyHighlightId] = React.useState<string | null>(null)

  useFocusEffect(
    React.useCallback(() => {
      setStickyHighlightId(null)
    }, []),
  )

  React.useEffect(() => {
    if (loading || !newTx || !newTx.id || !newTx.currency) return

    const isUnseen =
      (newTx.currency === WalletCurrency.Btc && hasUnseenBtcTx) ||
      (newTx.currency === WalletCurrency.Usd && hasUnseenUsdTx)
    if (!isUnseen) return

    if (lastHighlightedByCurrency[newTx.currency] !== newTx.id) {
      setStickyHighlightId(newTx.id)
      markTxSeen(newTx.currency)
      lastHighlightedByCurrency[newTx.currency] = newTx.id
    }
  }, [loading, newTx, markTxSeen, hasUnseenBtcTx, hasUnseenUsdTx])

  if (error) {
    console.error(error)
    crashlytics().recordError(error)
    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
    return <></>
  }

  if (!transactions || (showLoading && loading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size={"large"} />
      </View>
    )
  }

  const fetchNextTransactionsPage = () => {
    const pageInfo = transactions?.pageInfo
    if (pageInfo.hasNextPage) {
      fetchMore({
        variables: {
          first: QUERY_BATCH_SIZE,
          walletIds: walletIdsByCurrency,
          after: pageInfo.endCursor,
        },
      })
    }
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
            highlight={item.id === stickyHighlightId}
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
