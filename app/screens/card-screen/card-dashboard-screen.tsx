import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { BlinkCard } from "@app/components/blink-card"

import {
  CardActionButtons,
  CardBalanceSection,
  CardTransactionsSection,
} from "@app/components/card-screen"
import { MOCK_CARD, MOCK_TRANSACTIONS, EMPTY_TRANSACTIONS } from "./card-mock-data"

export const CardDashboardScreen: React.FC = () => {
  const styles = useStyles()
  const [isFrozen, setIsFrozen] = useState(false)
  const [hasTransactions] = useState(true)

  const transactions = hasTransactions ? MOCK_TRANSACTIONS : EMPTY_TRANSACTIONS

  return (
    <Screen preset="scroll" style={styles.screen}>
      <View style={styles.content}>
        <BlinkCard
          cardNumber={MOCK_CARD.cardNumber}
          holderName={MOCK_CARD.holderName}
          validThruDate={MOCK_CARD.validThruDate}
          isFrozen={isFrozen}
        />

        <CardBalanceSection
          balanceUsd="$29.42"
          balanceSecondary="~ Kč576.44"
          isDisabled={isFrozen}
          onAddFunds={() => console.log("Add funds pressed")}
        />

        <CardActionButtons
          isFrozen={isFrozen}
          onDetails={() => console.log("Details pressed")}
          onFreeze={() => setIsFrozen((prev) => !prev)}
          onSetLimits={() => console.log("Set limits pressed")}
          onStatements={() => console.log("Statements pressed")}
        />

        <CardTransactionsSection groups={transactions} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    backgroundColor: colors.white,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 40,
  },
}))
