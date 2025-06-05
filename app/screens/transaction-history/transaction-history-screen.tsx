import * as React from "react"
import { ActivityIndicator, SectionList, Text, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { makeStyles, useTheme } from "@rneui/themed"
import { gql } from "@apollo/client"

import { Screen } from "@app/components/screen"
import {
  WalletCurrency,
  useTransactionListForDefaultAccountQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  WalletFilterDropdown,
  WalletValues,
} from "@app/components/wallet-filter-dropdown"

import { MemoizedTransactionItem } from "../../components/transaction-item"
import { toastShow } from "../../utils/toast"

gql`
  query transactionListForDefaultAccount(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $walletIds: [WalletId!]
  ) {
    me {
      id
      defaultAccount {
        id
        wallets {
          id
          walletCurrency
        }
        pendingIncomingTransactions {
          ...Transaction
        }
        transactions(
          first: $first
          after: $after
          last: $last
          before: $before
          walletIds: $walletIds
        ) {
          ...TransactionList
        }
      }
    }
  }
`

export const TransactionHistoryScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL, locale } = useI18nContext()

  const [walletFilter, setWalletFilter] = React.useState<WalletValues>("ALL")

  const { data, error, fetchMore, refetch, loading } =
    useTransactionListForDefaultAccountQuery({
      skip: !useIsAuthed(),
    })

  const wallets = React.useMemo(
    () => data?.me?.defaultAccount?.wallets ?? [],
    [data?.me?.defaultAccount?.wallets],
  )

  const walletIdsByCurrency = React.useMemo(
    () => ({
      BTC: wallets
        .filter((w) => w.walletCurrency === WalletCurrency.Btc)
        .map((w) => w.id),
      USD: wallets
        .filter((w) => w.walletCurrency === WalletCurrency.Usd)
        .map((w) => w.id),
      ALL: wallets.map((w) => w.id),
    }),
    [wallets],
  )

  const getWalletIds = React.useCallback(() => {
    return walletIdsByCurrency[walletFilter] ?? []
  }, [walletFilter, walletIdsByCurrency])

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

  React.useEffect(() => {
    if (!wallets.length) return

    refetch({ walletIds: getWalletIds() })
  }, [getWalletIds, refetch, wallets])

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
          after: pageInfo.endCursor,
        },
      })
    }
  }

  return (
    <Screen>
      <WalletFilterDropdown
        selected={walletFilter}
        onSelect={setWalletFilter}
        loading={loading}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size={"large"} />
        </View>
      ) : (
        <SectionList
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          initialNumToRender={20}
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
          onRefresh={() => refetch({ walletIds: getWalletIds() })}
          refreshing={loading}
        />
      )}
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
