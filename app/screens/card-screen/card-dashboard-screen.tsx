import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { BlinkCard } from "@app/components/blink-card"
import {
  CardActionButtons,
  CardBalanceSection,
  CardTransactionsSection,
} from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { MOCK_CARD, MOCK_TRANSACTIONS, EMPTY_TRANSACTIONS } from "./card-mock-data"

export const CardDashboardScreen: React.FC = () => {
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
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
          onDetails={() => navigation.navigate("cardDetailsScreen")}
          onFreeze={() => setIsFrozen((prev) => !prev)}
          onSetLimits={() => navigation.navigate("cardLimitsScreen")}
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
