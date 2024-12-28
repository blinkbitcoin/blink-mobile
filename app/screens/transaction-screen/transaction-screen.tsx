import { ApolloError, useQuery, useReactiveVar } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { SectionList, Text, View } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
import { TouchableOpacity } from "react-native-gesture-handler"
import Icon from "react-native-vector-icons/Ionicons"
import { Screen } from "../../components/screen"
import { TransactionItem } from "../../components/transaction-item"
import { nextPrefCurrency, prefCurrencyVar } from "../../graphql/client-only-query"
import { translate } from "../../i18n"
import type { ScreenType } from "../../types/jsx"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { palette } from "../../theme/palette"
import { sameDay, sameMonth } from "../../utils/date"
import { TRANSACTIONS_LIST } from "../../graphql/query"
import { toastShow } from "../../utils/toast"

const styles = EStyleSheet.create({
  errorText: { alignSelf: "center", color: palette.red, paddingBottom: 18 },

  icon: { color: palette.darkGrey, top: -4 },

  noTransactionText: {
    fontSize: "24rem",
  },

  noTransactionView: {
    alignItems: "center",
    flex: 1,
    marginVertical: "48rem",
  },

  row: {
    flexDirection: "row",
  },

  screen: {
    backgroundColor: palette.white,
  },

  sectionHeaderContainer: {
    backgroundColor: palette.white,
    color: palette.darkGrey,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 22,
  },

  sectionHeaderText: {
    color: palette.darkGrey,
    fontSize: 18,
  },
})

const isToday = (tx) => sameDay(tx.createdAt, new Date())

const isYesterday = (tx) =>
  sameDay(tx.createdAt, new Date().setDate(new Date().getDate() - 1))

const isThisMonth = (tx) => sameMonth(tx.createdAt, new Date())

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "transactionHistory">
}

const TRANSACTIONS_PER_PAGE = 20

export const TransactionHistoryScreenDataInjected: ScreenType = ({
  navigation,
}: Props) => {
  const currency = "sat" // FIXME

  const { error, data, refetch, loading } = useQuery(TRANSACTIONS_LIST, {
    variables: { first: TRANSACTIONS_PER_PAGE, after: null },
    errorPolicy: "all",
    fetchPolicy: "network-only",
  })

  const prefCurrency = useReactiveVar(prefCurrencyVar)

  // The source of truth for listing the transactions
  // The data gets "cached" here and more pages are appended when they're fetched (through useQuery)
  const transactionsRef = React.useRef([])

  if (error) {
    console.error(error)
    toastShow(translate("common.transactionsError"))
    // return null
  }

  if (!data?.me?.defaultAccount) {
    return null
  }

  const { edges, pageInfo } = data.me.defaultAccount.wallets[0].transactions
  const lastDataCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null
  let lastSeenCursor =
    transactionsRef.current.length > 0
      ? transactionsRef.current[transactionsRef.current.length - 1].cursor
      : null

  // Add page of data to the source of truth if the data is new
  if (lastSeenCursor !== lastDataCursor) {
    transactionsRef.current = transactionsRef.current.concat(edges)
    lastSeenCursor = lastDataCursor
  }

  const fetchNextTransactionsPage = () => {
    if (pageInfo.hasNextPage && lastSeenCursor) {
      refetch({ first: TRANSACTIONS_PER_PAGE, after: lastSeenCursor })
    }
  }

  const sections = []
  const today = []
  const yesterday = []
  const thisMonth = []
  const before = []

  for (const txEdge of transactionsRef.current) {
    const tx = txEdge.node
    if(!tx) {
      continue
    }
    if (isToday(tx)) {
      today.push(tx)
    } else if (isYesterday(tx)) {
      yesterday.push(tx)
    } else if (isThisMonth(tx)) {
      thisMonth.push(tx)
    } else {
      before.push(tx)
    }
  }

  if (today.length > 0) {
    sections.push({ title: translate("PriceScreen.today"), data: today })
  }

  if (yesterday.length > 0) {
    sections.push({ title: translate("PriceScreen.yesterday"), data: yesterday })
  }

  if (thisMonth.length > 0) {
    sections.push({ title: translate("PriceScreen.thisMonth"), data: thisMonth })
  }

  if (before.length > 0) {
    sections.push({ title: translate("PriceScreen.prevMonths"), data: before })
  }

  return (
    <TransactionScreen
      navigation={navigation}
      currency={currency}
      prefCurrency={prefCurrency}
      nextPrefCurrency={nextPrefCurrency}
      sections={sections}
      fetchNextTransactionsPage={fetchNextTransactionsPage}
      loading={loading}
      refetch={refetch}
    />
  )
}

type TransactionScreenProps = {
  refreshing: boolean
  navigation: StackNavigationProp<RootStackParamList, "transactionHistory">
  onRefresh: () => void
  error: ApolloError
  prefCurrency: string
  nextPrefCurrency: () => void
  sections: []
  fetchNextTransactionsPage: () => void
  loading: boolean
  refetch: () => void
}

export const TransactionScreen: ScreenType = ({
  navigation,
  error,
  prefCurrency,
  nextPrefCurrency,
  sections,
  fetchNextTransactionsPage,
  loading,
  refetch,
}: TransactionScreenProps) => (
  <Screen style={styles.screen}>
    <SectionList
      renderItem={({ item }) => (
        <TransactionItem key={`txn-${item.id}`} navigation={navigation} tx={item} subtitle={true} showFullDate={true} />
      )}
      ListHeaderComponent={() => (
        <>
          {error?.graphQLErrors?.map(({ message }, item) => (
            <Text key={`error-${item}`} style={styles.errorText} selectable>
              {message}
            </Text>
          ))}
        </>
      )}
      initialNumToRender={20}
      renderSectionHeader={({ section: { title } }) => (
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeaderText}>{title}</Text>
          <TouchableOpacity style={styles.row} onPress={nextPrefCurrency}>
            <Text style={styles.sectionHeaderText}>
              {prefCurrency === "BTC" ? "sats" : "CRC"}{" "}
            </Text>
            <Icon name="ios-swap-vertical" size={32} style={styles.icon} />
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.noTransactionView}>
          <Text style={styles.noTransactionText}>
            {translate("TransactionScreen.noTransaction")}
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
