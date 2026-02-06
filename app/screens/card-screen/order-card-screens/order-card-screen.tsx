import React from "react"
import { useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { MOCK_USER } from "../card-mock-data"
import { SteppedCardLayout } from "../stepped-card-layout"
import { ShippingStep, ConfirmStep } from "./steps"
import { useOrderCardFlow, Step } from "./use-order-card-flow"

type StepConfig = {
  icon: "delivery"
  iconColor: string
  title: string
  subtitle: string
  buttonLabel: string
  onButtonPress: () => void
  isButtonDisabled: boolean
}

export const OrderCardScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const {
    step,
    state,
    toggleUseRegisteredAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  } = useOrderCardFlow()

  const steps = [
    LL.CardFlow.OrderPhysicalCard.steps.shipping(),
    LL.CardFlow.OrderPhysicalCard.steps.confirm(),
  ]

  const handleSubmit = () => {
    completeFlow()
    navigation.replace("cardStatusScreen", {
      title: LL.CardFlow.CardStatus.PhysicalCardOrdered.title(),
      subtitle: LL.CardFlow.CardStatus.PhysicalCardOrdered.subtitle(),
      buttonLabel: LL.CardFlow.CardStatus.PhysicalCardOrdered.buttonLabel(),
      navigateTo: "cardCreatePinScreen",
      iconName: "delivery",
      iconColor: colors._green,
    })
  }

  const getStepConfig = (): StepConfig => {
    switch (step) {
      case Step.Shipping:
        return {
          icon: "delivery",
          iconColor: colors._green,
          title: LL.CardFlow.OrderPhysicalCard.Shipping.title(),
          subtitle: LL.CardFlow.OrderPhysicalCard.Shipping.subtitle(),
          buttonLabel: LL.common.continue(),
          onButtonPress: goToNextStep,
          isButtonDisabled: false,
        }
      case Step.Confirm:
        return {
          icon: "delivery",
          iconColor: colors._green,
          title: LL.CardFlow.OrderPhysicalCard.Confirm.title(),
          subtitle: LL.CardFlow.OrderPhysicalCard.Confirm.subtitle(),
          buttonLabel: LL.CardFlow.OrderPhysicalCard.Confirm.placeOrder(),
          onButtonPress: handleSubmit,
          isButtonDisabled: false,
        }
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case Step.Shipping:
        return (
          <ShippingStep
            useRegisteredAddress={state.useRegisteredAddress}
            onToggleUseRegisteredAddress={toggleUseRegisteredAddress}
            customAddress={state.customAddress}
            onCustomAddressChange={setCustomAddress}
          />
        )
      case Step.Confirm:
        return (
          <ConfirmStep
            deliveryType={state.selectedDelivery}
            shippingAddress={
              state.useRegisteredAddress
                ? MOCK_USER.registeredAddress
                : state.customAddress
            }
          />
        )
    }
  }

  const stepConfig = getStepConfig()

  return (
    <SteppedCardLayout
      steps={steps}
      currentStep={step}
      icon={stepConfig.icon}
      iconColor={stepConfig.iconColor}
      title={stepConfig.title}
      subtitle={stepConfig.subtitle}
      buttonLabel={stepConfig.buttonLabel}
      onButtonPress={stepConfig.onButtonPress}
      isButtonDisabled={stepConfig.isButtonDisabled}
    >
      {renderStepContent()}
    </SteppedCardLayout>
  )
}
