import React, { useCallback, useRef } from "react"
import { useFocusEffect } from "@react-navigation/native"

import { CardStatusLayout } from "@app/components/card-screen"
import { CardActivationStep } from "@app/graphql/generated"
import { useCardActivation, useCardData } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useAddToWallet } from "../hooks/use-add-to-wallet"
import { WalletAddResult } from "../types"
import { isCardFrozen } from "../utils/card-display"

/** Offers the wallet, once, to a member whose first way was the physical card. */
export const CardWalletOfferScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const { card } = useCardData()
  const { isPending, moveOn } = useCardActivation({
    step: CardActivationStep.OfferOtherWay,
  })
  const { canAddToWallet, isWalletUnavailable, isAdding, addToWallet } = useAddToWallet(
    card?.id,
    card?.lastFour,
  )
  const hasPassedOverRef = useRef(false)

  /** A phone whose wallet cannot take the card has nothing to offer here, so the member
   *  goes on as if they had skipped it. Only once the activation is read: moving on
   *  without it would land them on the dashboard. */
  const shouldPassOver = isPending && isWalletUnavailable
  useFocusEffect(
    useCallback(() => {
      if (!shouldPassOver) return
      if (hasPassedOverRef.current) return
      hasPassedOverRef.current = true
      moveOn(CardActivationStep.OfferOtherWay)
    }, [shouldPassOver, moveOn]),
  )

  const handleAddToWallet = async () => {
    const result = await addToWallet()
    const isCardAdded = result === WalletAddResult.Added
    if (isCardAdded) moveOn(CardActivationStep.OfferOtherWay, { isWalletAdded: true })
  }

  const handleSkipPress = () => {
    moveOn(CardActivationStep.OfferOtherWay)
  }

  const isFrozen = card ? isCardFrozen(card.status) : false

  return (
    <CardStatusLayout
      title={LL.CardFlow.AddToMobileWallet.addYourCard()}
      subtitle={LL.CardFlow.AddToMobileWallet.addYourCardDescription()}
      secondaryButtonLabel={LL.CardFlow.Activation.skipForNow()}
      onSecondaryButtonPress={handleSkipPress}
      iconName="physical-card"
      cardId={card?.id}
      cardNumber={card?.lastFour}
      isFrozen={isFrozen}
      showAddToWallet={canAddToWallet}
      onAddToWallet={handleAddToWallet}
      isAddingToWallet={isAdding}
    />
  )
}
