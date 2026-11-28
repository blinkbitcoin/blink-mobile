import React from "react"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { useTheme } from "@rn-vui/themed"

import { CardStatusLayout } from "@app/components/card-screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useAddToWallet } from "./hooks/use-add-to-wallet"

type CardStatusScreenRouteProp = RouteProp<RootStackParamList, "cardStatusScreen">

export const CardStatusScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation()
  const route = useRoute<CardStatusScreenRouteProp>()

  const {
    title,
    subtitle,
    buttonLabel,
    navigateTo,
    iconName,
    iconColor = colors.success,
    showCard = true,
    showAddToWallet = true,
    isWalletPrimary = false,
    lastFour,
    cardId,
  } = route.params

  const { canAddToWallet, isAdding, addToWallet } = useAddToWallet(cardId, lastFour)
  const isAddToWalletShown = showAddToWallet && canAddToWallet

  /** Under the wallet button only while it shows, so the screen never ends on a lone
   *  text link. */
  const isActionSecondary = isWalletPrimary && isAddToWalletShown

  const handleActionPress = () => {
    navigation.dispatch(CommonActions.navigate(navigateTo))
  }

  const actionButton = isActionSecondary
    ? { secondaryButtonLabel: buttonLabel, onSecondaryButtonPress: handleActionPress }
    : { buttonLabel, onPrimaryButtonPress: handleActionPress }

  return (
    <CardStatusLayout
      title={title}
      subtitle={subtitle}
      {...actionButton}
      iconName={iconName}
      iconColor={iconColor}
      showCard={showCard}
      cardId={cardId}
      cardNumber={lastFour ?? ""}
      validThruDate=""
      isFrozen={false}
      showAddToWallet={isAddToWalletShown}
      onAddToWallet={addToWallet}
      isAddingToWallet={isAdding}
    />
  )
}
