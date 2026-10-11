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
    iconColor = colors._green,
    showCard = true,
    showAddToWallet = true,
    lastFour,
    cardId,
  } = route.params

  const handlePrimaryButtonPress = () => {
    navigation.dispatch(CommonActions.navigate(navigateTo))
  }

  return (
    <CardStatusLayout
      title={title}
      subtitle={subtitle}
      buttonLabel={buttonLabel}
      onPrimaryButtonPress={handlePrimaryButtonPress}
      iconName={iconName}
      iconColor={iconColor}
      showCard={showCard}
      cardId={cardId}
      cardNumber={lastFour ?? ""}
      validThruDate=""
      isFrozen={false}
      showAddToWallet={showAddToWallet}
    />
  )
}
