import * as React from "react"
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native"

import { gql } from "@apollo/client"
import {
  MemoizedTransactionItem,
  TRANSACTION_LIST_WINDOW_SIZE,
} from "@app/components/transaction-item"
import { UserContact, useTransactionListForContactQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useContactTransactions } from "@app/hooks/use-contact-transactions"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { AccountType } from "@app/types/wallet"
import { makeStyles, useTheme } from "@rn-vui/themed"

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
  contact: UserContact
}

const keyExtractor = (item: { id: string }) => item.id

const GROUP_RADIUS = 8

/** The date group reads as one card, so only its outer rows carry the corners. */
const groupStyles = StyleSheet.create({
  firstRow: {
    borderTopLeftRadius: GROUP_RADIUS,
    borderTopRightRadius: GROUP_RADIUS,
    overflow: "hidden",
  },
  lastRow: {
    borderBottomLeftRadius: GROUP_RADIUS,
    borderBottomRightRadius: GROUP_RADIUS,
    overflow: "hidden",
  },
})

// Rows here are deliberately not pressable: this list only shows the history
// with one contact, it does not navigate into a transaction.
const renderItem = ({
  item,
  index,
  section,
}: {
  item: { id: string }
  index: number
  section: { data: readonly { id: string }[] }
}) => {
  const isFirst = index === 0
  const isLast = index === section.data.length - 1

  return (
    <View style={[isFirst && groupStyles.firstRow, isLast && groupStyles.lastRow]}>
      <MemoizedTransactionItem
        txid={item.id}
        subtitle
        isFirst={isFirst}
        isLast={isLast}
      />
    </View>
  )
}

export const ContactTransactions = ({ contact }: Props) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  /**
   * The adapter matches payments by counterparty address, which is what `username` holds
   * for a self-custodial contact, so it never has to resolve a contact list to answer.
   */
  const {
    transactions: selfCustodialTransactions,
    isLoading: isLoadingSelfCustodial,
    hasError: hasSelfCustodialError,
    loadMore: loadMoreSelfCustodial,
  } = useContactTransactions(contact.handle, isSelfCustodial)

  const shouldSkipContactQuery = !isAuthed || isSelfCustodial

  /**
   * The custodial query resolves through `me`, which a self-custodial account has no
   * session for, so it is skipped and the contact adapter answers instead.
   */
  const {
    error,
    data,
    fetchMore,
    loading: custodialLoading,
  } = useTransactionListForContactQuery({
    /** The argument is a `Username` scalar, so this stays on the deprecated field even
     *  though the adapter above is keyed by `handle`. */
    variables: { username: contact.username },
    skip: shouldSkipContactQuery,
  })

  const selfCustodialTxs = useSelfCustodialTransactionFragments(selfCustodialTransactions)
  const custodialTransactions = data?.me?.contactByUsername?.transactions

  const custodialTxs = React.useMemo(
    () => custodialTransactions?.edges?.map((edge) => edge.node) ?? [],
    [custodialTransactions],
  )

  const txs = isSelfCustodial ? selfCustodialTxs : custodialTxs

  const sections = React.useMemo(
    () => groupTransactionsByDate({ txs, LL, locale }),
    [txs, LL, locale],
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

  const fetchNextTransactionsPage = () => {
    if (isSelfCustodial) {
      loadMoreSelfCustodial()
      return
    }

    const pageInfo = custodialTransactions?.pageInfo

    if (pageInfo?.hasNextPage) {
      fetchMore({
        variables: {
          username: contact.username,
          after: pageInfo.endCursor,
        },
      })
    }
  }

  const hasTransactionsError = Boolean(error) || hasSelfCustodialError

  /**
   * In an effect rather than the render body: the flag stays raised until the next read,
   * so any unrelated re-render while it is up would queue a second toast for a failure
   * the reader was already told about.
   */
  React.useEffect(() => {
    if (!hasTransactionsError) return

    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
  }, [hasTransactionsError, LL])

  /**
   * The failure is told through the toast, so the list itself has nothing to say — but it
   * still holds its space, or the send button would climb the screen on the one contact
   * whose history could not be read.
   */
  if (hasTransactionsError)
    return <View style={styles.screen} testID="contact-transactions-unavailable" />

  /**
   * Until the query answers there is nothing to say about this contact, so the custodial
   * list spins rather than claiming it has no transactions. An absent `data` counts as
   * still loading, but only while the query is actually running: a skipped one never
   * answers, and would otherwise spin forever.
   */
  const isCustodialQueryRunning = !shouldSkipContactQuery
  const isLoadingCustodial = isCustodialQueryRunning && (custodialLoading || !data)
  const isLoadingTransactions = isLoadingSelfCustodial || isLoadingCustodial

  const ListEmptyContent = isLoadingTransactions ? (
    <View style={styles.activityIndicatorView} testID="contact-transactions-loading">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  ) : (
    <View style={styles.noTransactionView} testID="contact-no-transactions">
      <Text style={styles.noTransactionText}>{LL.TransactionScreen.noTransaction()}</Text>
    </View>
  )

  return (
    <View style={styles.screen}>
      <SectionList
        testID="contact-transactions-list"
        renderItem={renderItem}
        initialNumToRender={20}
        windowSize={TRANSACTION_LIST_WINDOW_SIZE}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={ListEmptyContent}
        sections={sections}
        keyExtractor={keyExtractor}
        onEndReached={fetchNextTransactionsPage}
        onEndReachedThreshold={0.5}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  activityIndicatorView: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 48,
  },

  noTransactionText: {
    fontSize: 24,
  },

  noTransactionView: {
    alignItems: "center",
    marginVertical: 48,
  },

  /**
   * Takes the space between the header and the send button whatever the history holds, so
   * the button keeps its place at the bottom instead of riding up under a short list.
   */
  screen: {
    flex: 1,
  },

  sectionHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 3,
    paddingTop: 10,
  },

  sectionHeaderText: {
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
  },
}))
