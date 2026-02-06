import React from "react"
import { useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { SteppedCardLayout } from "../stepped-card-layout"
import { ReportIssueStep, DeliveryStep, ConfirmStep } from "./steps"
import { useReplaceCardFlow, Step } from "./use-replace-card-flow"

type StepConfig = {
  icon: "report-flag" | "delivery" | "approved"
  iconColor: string
  title: string
  subtitle: string
  buttonLabel: string
  onButtonPress: () => void
  isButtonDisabled: boolean
}

export const ReplaceCardScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const {
    step,
    state,
    setSelectedIssue,
    setSelectedDelivery,
    toggleUseRegisteredAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  } = useReplaceCardFlow()

  const steps = [
    LL.CardFlow.ReplaceCard.steps.reportIssue(),
    LL.CardFlow.ReplaceCard.steps.delivery(),
    LL.CardFlow.ReplaceCard.steps.confirm(),
  ]

  const handleSubmit = () => {
    completeFlow()
    navigation.replace("cardStatusScreen", {
      title: LL.CardFlow.ReplaceCard.Status.title(),
      subtitle: LL.CardFlow.ReplaceCard.Status.subtitle(),
      buttonLabel: LL.CardFlow.ReplaceCard.Status.buttonLabel(),
      navigateTo: "cardDashboardScreen",
      iconName: "delivery",
      iconColor: colors._green,
    })
  }

  const getStepConfig = (): StepConfig => {
    switch (step) {
      case Step.ReportIssue:
        return {
          icon: "report-flag",
          iconColor: colors.primary,
          title: LL.CardFlow.ReplaceCard.ReportIssue.title(),
          subtitle: LL.CardFlow.ReplaceCard.ReportIssue.subtitle(),
          buttonLabel: LL.common.continue(),
          onButtonPress: goToNextStep,
          isButtonDisabled: !state.selectedIssue,
        }
      case Step.Delivery:
        return {
          icon: "delivery",
          iconColor: colors._green,
          title: LL.CardFlow.ReplaceCard.Delivery.title(),
          subtitle: LL.CardFlow.ReplaceCard.Delivery.subtitle(),
          buttonLabel: state.selectedDelivery
            ? LL.common.continue()
            : LL.CardFlow.ReplaceCard.Delivery.chooseDeliverySpeed(),
          onButtonPress: goToNextStep,
          isButtonDisabled: !state.selectedDelivery,
        }
      case Step.Confirm:
        return {
          icon: "approved",
          iconColor: colors._green,
          title: LL.CardFlow.ReplaceCard.Confirm.title(),
          subtitle: LL.CardFlow.ReplaceCard.Confirm.subtitle(),
          buttonLabel: LL.CardFlow.ReplaceCard.Confirm.submitRequest(),
          onButtonPress: handleSubmit,
          isButtonDisabled: false,
        }
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case Step.ReportIssue:
        return (
          <ReportIssueStep
            selectedIssue={state.selectedIssue}
            onSelectIssue={setSelectedIssue}
          />
        )
      case Step.Delivery:
        return (
          <DeliveryStep
            selectedDelivery={state.selectedDelivery}
            onSelectDelivery={setSelectedDelivery}
            useRegisteredAddress={state.useRegisteredAddress}
            onToggleUseRegisteredAddress={toggleUseRegisteredAddress}
            customAddress={state.customAddress}
            onCustomAddressChange={setCustomAddress}
          />
        )
      case Step.Confirm:
        if (!state.selectedIssue || !state.selectedDelivery) return null
        return (
          <ConfirmStep
            issueType={state.selectedIssue}
            deliveryType={state.selectedDelivery}
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
