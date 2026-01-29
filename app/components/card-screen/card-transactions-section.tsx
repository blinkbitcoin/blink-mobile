import React from "react"
import { View } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { TransactionGroup } from "@app/screens/card-screen/card-mock-data"
import { CardTransactionItem } from "./card-transaction-item"

type CardTransactionsSectionProps = {
  groups: TransactionGroup[]
}

export const CardTransactionsSection: React.FC<CardTransactionsSectionProps> = ({
  groups,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  if (groups.length === 0) {
    return (
      <View style={styles.container}>
        <Text type="p1" bold style={styles.header}>
          {LL.CardFlow.CardDashboard.transactionsTitle()}
        </Text>
        <Text type="p1" style={styles.emptyText}>
          {LL.CardFlow.CardDashboard.emptyTransactions()}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text type="p1" bold style={styles.header}>
        {LL.CardFlow.CardDashboard.transactionsTitle()}
      </Text>
      {groups.map((group) => (
        <View key={group.date} style={styles.groupContainer}>
          <Text type="p3" style={styles.dateLabel}>
            {group.date}
          </Text>
          <View style={styles.transactionsList}>
            {group.transactions.map((tx) => (
              <CardTransactionItem
                key={tx.id}
                merchantName={tx.merchantName}
                timeAgo={tx.timeAgo}
                amount={tx.amount}
                status={tx.status}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  header: {
    textAlign: "center",
    color: colors.black,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: colors.grey2,
    marginTop: 40,
  },
  groupContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    color: colors.grey1,
    marginBottom: 8,
  },
  transactionsList: {
    backgroundColor: colors.grey4,
    borderRadius: 8,
    overflow: "hidden",
    rowGap: 1,
  },
}))
