import React, { useCallback, useMemo } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { Screen } from "@app/components/screen"
import { CardType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

import { useCardData } from "../hooks"
import { useShippingAddressData } from "../card-shipping-address-screen/hooks"
import { SteppedCardLayout } from "../stepped-card-layout"
import { Delivery, EMPTY_ADDRESS } from "../types"
import { ReportIssueStep, DeliveryStep, ConfirmStep, Issue } from "./steps"
import {
  useLockCard,
  useReplaceCard,
  useReplaceCardFlow,
  Step,
  type StepName,
} from "./hooks"

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
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "replaceCardScreen">>()
  const { cardId } = route.params

  const { card, loading: cardLoading } = useCardData()
  const { initialAddress, loading: addressLoading } = useShippingAddressData()
  const { replaceCard, loading: replaceLoading } = useReplaceCard()
  const { lockCard, loading: lockLoading } = useLockCard()

  const isVirtualCard = card?.cardType === CardType.Virtual

  const {
    currentStep,
    stepNumber,
    stepOrder,
    state,
    setSelectedIssue,
    setSelectedDelivery,
    toggleUseRegisteredAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  } = useReplaceCardFlow({ isVirtualCard, initialAddress })

  const stepLabels = useMemo(() => {
    const labelMap: Record<StepName, string> = {
      [Step.ReportIssue]: LL.CardFlow.ReplaceCard.steps.reportIssue(),
      [Step.Delivery]: LL.CardFlow.ReplaceCard.steps.delivery(),
      [Step.Confirm]: LL.CardFlow.ReplaceCard.steps.confirm(),
    }
    return stepOrder.map((step) => labelMap[step])
  }, [LL, stepOrder])

  const registeredAddress = useMemo(
    () => initialAddress ?? EMPTY_ADDRESS,
    [initialAddress],
  )

  const handleReportIssueContinue = useCallback(async () => {
    if (!state.selectedIssue) return

    if (state.selectedIssue === Issue.Damaged) {
      goToNextStep()
      return
    }

    const locked = await lockCard(cardId)
    if (!locked) return

    goToNextStep()
  }, [state.selectedIssue, lockCard, cardId, goToNextStep])

  const handleSubmit = useCallback(async () => {
    const result = await replaceCard(cardId)
    if (!result) {
      if (state.selectedIssue !== Issue.Damaged) {
        toastShow({
          message: LL.CardFlow.ReplaceCard.errors.replaceFailedCardLocked(),
          LL,
        })
      }
      return
    }

    completeFlow()
    navigation.replace("cardStatusScreen", {
      title: LL.CardFlow.ReplaceCard.Status.title(),
      subtitle: LL.CardFlow.ReplaceCard.Status.subtitle(),
      buttonLabel: LL.CardFlow.ReplaceCard.Status.buttonLabel(),
      navigateTo: "cardDashboardScreen",
      iconName: "delivery",
      iconColor: colors._green,
      lastFour: result.lastFour,
      holderName: "",
    })
  }, [
    replaceCard,
    cardId,
    state.selectedIssue,
    completeFlow,
    navigation,
    LL,
    colors._green,
  ])

  const loading = replaceLoading || lockLoading

  const stepConfig = useMemo((): StepConfig => {
    switch (currentStep) {
      case Step.ReportIssue:
        return {
          icon: "report-flag",
          iconColor: colors.primary,
          title: LL.CardFlow.ReplaceCard.ReportIssue.title(),
          subtitle: LL.CardFlow.ReplaceCard.ReportIssue.subtitle(),
          buttonLabel: LL.common.continue(),
          onButtonPress: handleReportIssueContinue,
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
  }, [
    currentStep,
    colors,
    LL,
    handleReportIssueContinue,
    state.selectedIssue,
    state.selectedDelivery,
    goToNextStep,
    handleSubmit,
  ])

  const stepContent = useMemo((): React.ReactNode => {
    switch (currentStep) {
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
            hasRegisteredAddress={initialAddress !== null}
            registeredAddress={registeredAddress}
            useRegisteredAddress={state.useRegisteredAddress}
            onToggleUseRegisteredAddress={toggleUseRegisteredAddress}
            customAddress={state.customAddress}
            onCustomAddressChange={setCustomAddress}
          />
        )
      case Step.Confirm:
        if (!state.selectedIssue) return null
        if (!isVirtualCard && !state.selectedDelivery) return null
        return (
          <ConfirmStep
            issueType={state.selectedIssue}
            deliveryType={state.selectedDelivery ?? Delivery.Standard}
            isVirtualCard={isVirtualCard}
          />
        )
    }
  }, [
    currentStep,
    state,
    setSelectedIssue,
    setSelectedDelivery,
    initialAddress,
    registeredAddress,
    toggleUseRegisteredAddress,
    setCustomAddress,
    isVirtualCard,
  ])

  if (cardLoading || addressLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <SteppedCardLayout
      steps={stepLabels}
      currentStep={stepNumber}
      icon={stepConfig.icon}
      iconColor={stepConfig.iconColor}
      title={stepConfig.title}
      subtitle={stepConfig.subtitle}
      buttonLabel={stepConfig.buttonLabel}
      onButtonPress={stepConfig.onButtonPress}
      isButtonDisabled={stepConfig.isButtonDisabled}
      loading={loading}
    >
      {stepContent}
    </SteppedCardLayout>
  )
}

const useStyles = makeStyles((_) => ({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
}))
