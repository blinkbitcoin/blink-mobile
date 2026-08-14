import * as React from "react"
import { SectionList, Text, View } from "react-native"

import { gql } from "@apollo/client"
import {
  MemoizedTransactionItem,
  TRANSACTION_LIST_WINDOW_SIZE,
} from "@app/components/transaction-item"
import { useTransactionListForContactQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles } from "@rn-vui/themed"

import { toastShow } from "../../../utils/toast"

gql`
  query transactionListForContact(
    $username: Username!
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    me {
      id
      contactByUsername(username: $username) {
        transactions(first: $first, after: $after, last: $last, before: $before) {
          ...TransactionList
        }
      }
    }
  }
`

type Props = {
  contactUsername: string
}

const keyExtractor = (item: { id: string }) => item.id

// Rows here are deliberately not pressable: this list only shows the history
// with one contact, it does not navigate into a transaction.
const renderItem = ({ item }: { item: { id: string } }) => (
  <MemoizedTransactionItem txid={item.id} />
)

export const ContactTransactions = ({ contactUsername }: Props) => {
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const isAuthed = useIsAuthed()

  const { error, data, fetchMore } = useTransactionListForContactQuery({
    variables: { username: contactUsername },
    skip: !isAuthed,
  })

  const transactions = data?.me?.contactByUsername?.transactions

  const sections = React.useMemo(
    () =>
      groupTransactionsByDate({
        txs: transactions?.edges?.map((edge) => edge.node) ?? [],
        LL,
        locale,
      }),
    [transactions, LL, locale],
  )

  // Declared above the early returns below to keep hook order stable.
  const renderSectionHeader = React.useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <View style={styles.sectionHeaderContainer}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
    ),
    [styles.sectionHeaderContainer, styles.sectionHeaderText],
  )

  if (error) {
    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
    return <></>
  }

  if (!transactions) {
    return <></>
  }

  const fetchNextTransactionsPage = () => {
    const pageInfo = transactions?.pageInfo

    if (pageInfo.hasNextPage) {
      fetchMore({
        variables: {
          username: contactUsername,
          after: pageInfo.endCursor,
        },
      })
    }
  }

  return (
    <View style={styles.screen}>
      <SectionList
        renderItem={renderItem}
        initialNumToRender={20}
        windowSize={TRANSACTION_LIST_WINDOW_SIZE}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={
          <View style={styles.noTransactionView}>
            <Text style={styles.noTransactionText}>
              {LL.TransactionScreen.noTransaction()}
            </Text>
          </View>
        }
        sections={sections}
        keyExtractor={keyExtractor}
        onEndReached={fetchNextTransactionsPage}
        onEndReachedThreshold={0.5}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  noTransactionText: {
    fontSize: 24,
  },

  noTransactionView: {
    alignItems: "center",
    flex: 1,
    marginVertical: 48,
  },

  screen: {
    flex: 1,
    borderRadius: 10,
    borderColor: colors.grey4,
    borderWidth: 2,
    overflow: "hidden",
  },

  sectionHeaderContainer: {
    backgroundColor: colors.grey5,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
  },

  sectionHeaderText: {
    color: colors.black,
    fontSize: 18,
  },
}))
