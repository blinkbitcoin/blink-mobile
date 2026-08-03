import * as React from "react"
import { SectionList, Text, View } from "react-native"

import { gql } from "@apollo/client"
import { MemoizedTransactionItem } from "@app/components/transaction-item"
import { UserContact, useTransactionListForContactQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { groupTransactionsByDate } from "@app/graphql/transactions"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useContacts } from "@app/hooks/use-contacts"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { NormalizedTransaction } from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"
import { useFocusEffect } from "@react-navigation/native"
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
  contact: UserContact
}

export const ContactTransactions = ({ contact }: Props) => {
  const styles = useStyles()
  const { LL, locale } = useI18nContext()
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  const { getTransactions } = useContacts()
  const [selfCustodialTransactions, setSelfCustodialTransactions] = React.useState<
    NormalizedTransaction[]
  >([])

  /**
   * The custodial query resolves through `me`, which a self-custodial account has no
   * session for, so it is skipped and the contact adapter answers instead.
   */
  const { error, data, fetchMore } = useTransactionListForContactQuery({
    variables: { username: contact.username },
    skip: !isAuthed || isSelfCustodial,
  })

  useFocusEffect(
    React.useCallback(() => {
      if (!isSelfCustodial) return undefined

      let isActive = true
      getTransactions(contact.id).then((transactions) => {
        if (isActive) setSelfCustodialTransactions(transactions)
      })

      return () => {
        isActive = false
      }
    }, [isSelfCustodial, contact.id, getTransactions]),
  )

  const selfCustodialTxs = useSelfCustodialTransactionFragments(selfCustodialTransactions)
  const custodialTransactions = data?.me?.contactByUsername?.transactions

  const txs = React.useMemo(() => {
    if (isSelfCustodial) return selfCustodialTxs
    return custodialTransactions?.edges?.map((edge) => edge.node) ?? []
  }, [isSelfCustodial, selfCustodialTxs, custodialTransactions])

  const sections = React.useMemo(
    () => groupTransactionsByDate({ txs, LL, locale }),
    [txs, LL, locale],
  )

  const fetchNextTransactionsPage = () => {
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

  if (error) {
    toastShow({
      message: (translations) => translations.common.transactionsError(),
      LL,
    })
    return <></>
  }

  return (
    <View style={styles.screen}>
      <SectionList
        testID="contact-transactions-list"
        renderItem={({ item }) => (
          <MemoizedTransactionItem key={`txn-${item.id}`} txid={item.id} />
        )}
        initialNumToRender={20}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.noTransactionView} testID="contact-no-transactions">
            <Text style={styles.noTransactionText}>
              {LL.TransactionScreen.noTransaction()}
            </Text>
          </View>
        }
        sections={sections}
        keyExtractor={(item) => item.id}
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
