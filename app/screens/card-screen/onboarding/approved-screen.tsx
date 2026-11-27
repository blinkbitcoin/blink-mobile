import React, { useCallback } from "react"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { CardStatusLayout } from "@app/components/card-screen"
import { CardActivationStep } from "@app/graphql/generated"
import { useCardActivation, useCardData } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useAddToWallet } from "../hooks/use-add-to-wallet"
import { isCardFrozen } from "../utils/card-display"

export const CardApprovedScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { card, hasPhysicalCard } = useCardData()
  const {
    isComplete: isActivationComplete,
    redirect,
    moveOn,
  } = useCardActivation({ step: CardActivationStep.Activated })
  const { canAddToWallet, isAdding, addToWallet } = useAddToWallet(
    card?.id,
    card?.lastFour,
  )

  /** The approval offers a first way to use the card. Once the member has a physical
   *  card or has finished the activation, even with the activation unread, a second
   *  order must not be one tap away, so they go on to where they belong. */
  const isApprovalBehind = hasPhysicalCard || isActivationComplete
  useFocusEffect(
    useCallback(() => {
      if (isApprovalBehind) redirect()
    }, [isApprovalBehind, redirect]),
  )

  const handleOrderPress = () => {
    navigation.navigate("orderCardScreen")
  }

  /** Temporary, while Apple Pay and Google Pay cannot take the card: without it the
   *  physical card would be the only way past this step. */
  const handleSkipPress = () => {
    moveOn(CardActivationStep.Activated)
  }

  return (
    <CardStatusLayout
      title={LL.CardFlow.CardStatus.CardApproved.title()}
      subtitle={LL.CardFlow.CardStatus.CardApproved.subtitle()}
      buttonLabel={LL.CardFlow.CardStatus.CardApproved.buttonLabel()}
      onPrimaryButtonPress={handleOrderPress}
      secondaryButtonLabel={LL.CardFlow.Activation.skipForNow()}
      onSecondaryButtonPress={handleSkipPress}
      iconName="check-badge"
      cardId={card?.id}
      cardNumber={card?.lastFour}
      isFrozen={card ? isCardFrozen(card.status) : false}
      showAddToWallet={canAddToWallet}
      onAddToWallet={addToWallet}
      isAddingToWallet={isAdding}
    />
  )
}
