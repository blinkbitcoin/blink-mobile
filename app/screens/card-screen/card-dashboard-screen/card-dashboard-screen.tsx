import React, { useCallback, useEffect } from "react"
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { useIsFocused, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BlinkCard } from "@app/components/blink-card"
import {
  CardActionButtons,
  CardBalanceSection,
  CardTransactionsSection,
} from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { CardStatus } from "@app/graphql/generated"
import { toastShow } from "@app/utils/toast"

import { useCardData } from "../hooks/use-card-data"
import { isCardFrozen } from "../utils/card-display"

import { useCardBalance, useCardFreeze, useCardTransactions } from "./hooks"

const EmptyScreen = ({ message }: { message: string }) => {
  const styles = useStyles()
  return (
    <Screen preset="scroll" style={styles.screen}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>{message}</Text>
      </View>
    </Screen>
  )
}

export const CardDashboardScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const isFocused = useIsFocused()
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { card, loading: cardLoading, error: cardError } = useCardData()
  const {
    balancePrimary,
    balanceSecondary,
    error: balanceError,
  } = useCardBalance(card?.id)
  const {
    transactions,
    loading: txLoading,
    handleLoadMore,
    fetchingMore,
    refetch,
  } = useCardTransactions(card?.id)

  const { handleFreeze, loading: freezeLoading } = useCardFreeze()

  const handleSettingsPress = useCallback(() => {
    navigation.navigate("cardSettingsScreen")
  }, [navigation])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerRight} onPress={handleSettingsPress}>
          <GaloyIcon name="settings" size={24} color={colors.black} />
        </TouchableOpacity>
      ),
    })
  }, [navigation, styles.headerRight, colors.black, handleSettingsPress])

  useEffect(() => {
    if (isFocused) refetch()
  }, [isFocused, refetch])

  useEffect(() => {
    const error = cardError || balanceError
    if (error) toastShow({ message: error.message, LL })
  }, [cardError, balanceError, LL])

  if (cardLoading) {
    return (
      <Screen preset="scroll" style={styles.screen}>
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    )
  }

  if (!card) return <EmptyScreen message={LL.CardFlow.CardDashboard.noCardAvailable()} />

  const isUsable = card.status === CardStatus.Active || card.status === CardStatus.Locked
  if (!isUsable)
    return <EmptyScreen message={LL.CardFlow.CardDashboard.cardNotUsable()} />

  const cardNumber = card.lastFour
  const isFrozen = isCardFrozen(card.status)

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScrollEndDrag={handleLoadMore}
        refreshControl={
          <RefreshControl
            refreshing={txLoading && isFocused}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <BlinkCard
          cardNumber={cardNumber}
          holderName=""
          validThruDate=""
          isFrozen={isFrozen}
        />

        <CardBalanceSection
          balanceUsd={balancePrimary}
          balanceSecondary={balanceSecondary}
          isDisabled={isFrozen}
          onAddFunds={() => console.log("Add funds pressed")}
        />

        <CardActionButtons
          isFrozen={isFrozen}
          freezeLoading={freezeLoading}
          onDetails={() => navigation.navigate("cardDetailsScreen")}
          onFreeze={() => handleFreeze(card.id, card.status)}
          onSetLimits={() => navigation.navigate("cardLimitsScreen")}
          onStatements={() => navigation.navigate("cardStatementsScreen")}
        />

        <CardTransactionsSection
          groups={transactions}
          onTransactionPress={(transactionId) =>
            navigation.navigate("cardTransactionDetailsScreen", { transactionId })
          }
        />

        {fetchingMore && (
          <ActivityIndicator style={styles.loadMore} color={colors.primary} />
        )}
      </ScrollView>
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
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.grey3,
  },
  loadMore: {
    marginTop: 16,
  },
  headerRight: {
    padding: 8,
    marginRight: 16,
  },
}))
