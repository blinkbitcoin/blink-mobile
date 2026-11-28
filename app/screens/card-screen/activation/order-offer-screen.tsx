import React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { CardStatusLayout } from "@app/components/card-screen"
import { CardActivationStep } from "@app/graphql/generated"
import { useCardActivation, useCardData } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { isCardFrozen } from "../utils/card-display"

/** Offers the physical card to a member whose first way was not it. */
export const CardOrderOfferScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { card } = useCardData()
  const { moveOn } = useCardActivation({ step: CardActivationStep.OfferOtherWay })

  const handleOrderPress = () => {
    navigation.navigate("orderCardScreen")
  }

  const handleSkipPress = () => {
    moveOn(CardActivationStep.OfferOtherWay)
  }

  return (
    <CardStatusLayout
      title={LL.CardFlow.OrderPhysicalCard.title()}
      subtitle={LL.CardFlow.Activation.OrderOffer.subtitle()}
      buttonLabel={LL.CardFlow.CardStatus.CardApproved.buttonLabel()}
      onPrimaryButtonPress={handleOrderPress}
      secondaryButtonLabel={LL.CardFlow.Activation.skipForNow()}
      onSecondaryButtonPress={handleSkipPress}
      iconName="card"
      cardId={card?.id}
      cardNumber={card?.lastFour}
      isFrozen={card ? isCardFrozen(card.status) : false}
    />
  )
}
