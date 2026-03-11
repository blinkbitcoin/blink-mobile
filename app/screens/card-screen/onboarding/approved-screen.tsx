import React from "react"
import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { CardStatusLayout } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { CardStatus, MOCK_CARD } from "../card-mock-data"

export const CardApprovedScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()

  const handlePrimaryButtonPress = () => {
    navigation.dispatch(CommonActions.navigate("cardOrderScreen"))
  }

  const handleAddToWallet = () => {
    navigation.dispatch(CommonActions.navigate("cardAddToMobileWalletScreen"))
  }

  return (
    <CardStatusLayout
      title={LL.CardFlow.CardStatus.CardApproved.title()}
      subtitle={LL.CardFlow.CardStatus.CardApproved.subtitle()}
      buttonLabel={LL.CardFlow.CardStatus.CardApproved.buttonLabel()}
      onPrimaryButtonPress={handlePrimaryButtonPress}
      iconName="check-badge"
      cardNumber={MOCK_CARD.cardNumber}
      holderName={MOCK_CARD.holderName}
      validThruDate={MOCK_CARD.validThruDate}
      isFrozen={MOCK_CARD.status === CardStatus.Frozen}
      onAddToWallet={handleAddToWallet}
    />
  )
}
