import { ApolloError, useQuery, useReactiveVar } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { SectionList, Text, View } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
import { TouchableOpacity } from "react-native-gesture-handler"
import { Icon } from 'react-native-elements'
// import Icon from "react-native-vector-icons/Ionicons"
import { Screen } from "../../components/screen"
import { TransactionItem } from "../../components/transaction-item"
import { nextPrefCurrency, prefCurrencyVar } from "../../graphql/client-only-query"
import { translate } from "../../i18n"
import type { ScreenType } from "../../types/jsx"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { palette } from "../../theme/palette"
import { sameDay, sameMonth } from "../../utils/date"
import { toastShow } from "../../utils/toast"
import { TRANSACTIONS_LIST_FOR_CONTACT } from "../../graphql/query"

const styles = EStyleSheet.create({
  errorText: { alignSelf: "center", color: palette.red, paddingBottom: 18 },

  icon: { top: -4 },

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
  contactUsername: string
}

const TRANSACTIONS_PER_PAGE = 20

export const ContactTransactionsDataInjected: ScreenType = ({
  navigation,
  contactUsername,
}: Props) => {
  const currency = "sat" // FIXME

  const { error, data, refetch } = useQuery(TRANSACTIONS_LIST_FOR_CONTACT, {
    variables: { username: contactUsername, first: TRANSACTIONS_PER_PAGE, after: null },
  })

  const prefCurrency = useReactiveVar(prefCurrencyVar)

  // The source of truth for listing the transactions
  // The data gets "cached" here and more pages are appended when they're fetched (through useQuery)
  const transactionsRef = React.useRef([])

  if (error) {
    toastShow(translate("common.transactionsError"))
    return null
  }

  if (!data) {
    return null
  }

  const transactionEdges = data.me.contactByUsername.transactions.edges
  const lastDataCursor =
    transactionEdges.length > 0
      ? transactionEdges[transactionEdges.length - 1].cursor
      : null
  let lastSeenCursor =
    transactionsRef.current.length > 0
      ? transactionsRef.current[transactionsRef.current.length - 1].cursor
      : null

  // Add page of data to the source of truth if the data is new
  if (lastSeenCursor !== lastDataCursor) {
    transactionsRef.current = transactionsRef.current.concat(transactionEdges)
    lastSeenCursor = lastDataCursor
  }

  const fetchNextTransactionsPage = () => {
    refetch({ first: TRANSACTIONS_PER_PAGE, after: lastSeenCursor })
  }

  const sections = []
  const today = []
  const yesterday = []
  const thisMonth = []
  const before = []

  for (const txEdge of transactionsRef.current) {
    const tx = txEdge.node
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
    <ContactTransactions
      navigation={navigation}
      currency={currency}
      prefCurrency={prefCurrency}
      nextPrefCurrency={nextPrefCurrency}
      sections={sections}
      fetchNextTransactionsPage={fetchNextTransactionsPage}
    />
  )
}

type ContactTransactionsProps = {
  refreshing: boolean
  navigation: StackNavigationProp<RootStackParamList, "transactionHistory">
  onRefresh: () => void
  error: ApolloError
  prefCurrency: string
  nextPrefCurrency: () => void
  sections: []
  fetchNextTransactionsPage: () => void
}

export const ContactTransactions: ScreenType = ({
  navigation,
  error,
  prefCurrency,
  nextPrefCurrency,
  sections,
  fetchNextTransactionsPage,
}: ContactTransactionsProps) => (
  <Screen style={styles.screen}>
    <SectionList
      renderItem={({ item }) => (
        <TransactionItem key={`txn-${item.id}`} navigation={navigation} tx={item} />
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
            <Icon name="swap-vert" size={32} style={styles.icon} />
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
      keyExtractor={(item, index) => item + index}
      onEndReached={fetchNextTransactionsPage}
      onEndReachedThreshold={0.5}
    />
  </Screen>
)
