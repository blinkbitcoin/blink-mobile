import React from "react"
import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { CardStatusLayout } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useCardData } from "../hooks/use-card-data"
import { isCardFrozen } from "../utils/card-display"

export const CardApprovedScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { card, hasPhysicalCard } = useCardData()

  const handlePrimaryButtonPress = () => {
    if (hasPhysicalCard) {
      navigation.dispatch(CommonActions.navigate("cardDashboardScreen"))
      return
    }
    navigation.dispatch(CommonActions.navigate("orderCardScreen"))
  }

  return (
    <CardStatusLayout
      title={LL.CardFlow.CardStatus.CardApproved.title()}
      subtitle={LL.CardFlow.CardStatus.CardApproved.subtitle()}
      buttonLabel={
        hasPhysicalCard
          ? LL.CardFlow.CardStatus.CardApproved.buttonLabelDashboard()
          : LL.CardFlow.CardStatus.CardApproved.buttonLabel()
      }
      onPrimaryButtonPress={handlePrimaryButtonPress}
      iconName="check-badge"
      cardNumber={card?.lastFour}
      isFrozen={card ? isCardFrozen(card.status) : false}
    />
  )
}
