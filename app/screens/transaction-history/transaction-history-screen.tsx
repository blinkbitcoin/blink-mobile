import * as React from "react"
import { ActivityIndicator, SectionList, Text, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"
import { RouteProp } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import { useTransactionListForDefaultAccountQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  WalletFilterDropdown,
  WalletValues,
} from "@app/components/wallet-filter-dropdown"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

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

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = ({
  route,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const [walletFilter, setWalletFilter] = React.useState<WalletValues>("ALL")

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

  const sections = React.useMemo(
    () =>
      groupTransactionsByDate({
        pendingIncomingTxs: pendingIncomingTransactions
          ? [...pendingIncomingTransactions]
          : [],
        txs: transactions?.edges?.map((edge) => edge.node) ?? [],
        LL,
        locale,
      }),
    [pendingIncomingTransactions, transactions, LL, locale],
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

  if (!transactions) {
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
