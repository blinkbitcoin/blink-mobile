import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

import { useCardData } from "../hooks"
import { useShippingAddressData } from "../card-shipping-address-screen/hooks"
import { SteppedCardLayout } from "../stepped-card-layout"
import { EMPTY_ADDRESS, ShippingAddress } from "../types"
import { ShippingStep, ConfirmStep } from "./steps"
import { useCreateCard, useOrderCardFlow, Step } from "./hooks"

type StepConfig = {
  icon: "delivery"
  iconColor: string
  title: string
  subtitle: string
  buttonLabel: string
  onButtonPress: () => void
  isButtonDisabled: boolean
}

const mapToShippingInput = (address: ShippingAddress, phoneNumber: string) => ({
  firstName: address.firstName,
  lastName: address.lastName,
  line1: address.line1,
  line2: address.line2,
  city: address.city,
  region: address.region,
  postalCode: address.postalCode,
  countryCode: address.countryCode,
  // TODO: UI has no phone number input field — using account phone as fallback
  phoneNumber,
})

export const OrderCardScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { applicationId, loading: cardLoading, error: cardError } = useCardData()
  const { initialAddress, phone, loading: addressLoading } = useShippingAddressData()
  const { createCard, loading: createLoading } = useCreateCard()
  const [isFormValid, setIsFormValid] = useState(false)

  useEffect(() => {
    if (cardLoading) return

    if (cardError) {
      toastShow({ message: cardError.message, type: "warning", LL })
      navigation.goBack()
      return
    }

    if (!applicationId) {
      toastShow({
        message: LL.CardFlow.OrderPhysicalCard.errors.createFailed(),
        type: "warning",
        LL,
      })
      navigation.goBack()
    }
  }, [cardLoading, cardError, applicationId, LL, navigation])

  const {
    step,
    state,
    toggleUseRegisteredAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  } = useOrderCardFlow({ initialAddress })

  const steps = [
    LL.CardFlow.OrderPhysicalCard.steps.shipping(),
    LL.CardFlow.OrderPhysicalCard.steps.confirm(),
  ]

  const registeredAddress = useMemo(
    () => initialAddress ?? EMPTY_ADDRESS,
    [initialAddress],
  )

  const handleSubmit = useCallback(async () => {
    if (!applicationId) return

    const address = state.useRegisteredAddress ? registeredAddress : state.customAddress
    const result = await createCard({
      applicationId,
      shippingAddress: mapToShippingInput(address, phone),
    })
    if (!result) return

    completeFlow()
    navigation.replace("cardStatusScreen", {
      title: LL.CardFlow.CardStatus.PhysicalCardOrdered.title(),
      subtitle: LL.CardFlow.CardStatus.PhysicalCardOrdered.subtitle(),
      buttonLabel: LL.CardFlow.CardStatus.PhysicalCardOrdered.buttonLabel(),
      navigateTo: "cardCreatePinScreen",
      iconName: "delivery",
      iconColor: colors._green,
      lastFour: result.lastFour,
    })
  }, [
    applicationId,
    state.useRegisteredAddress,
    state.customAddress,
    registeredAddress,
    phone,
    createCard,
    completeFlow,
    navigation,
    LL,
    colors._green,
  ])

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
          isButtonDisabled: !state.useRegisteredAddress && !isFormValid,
        }
      case Step.Confirm:
        return {
          icon: "delivery",
          iconColor: colors._green,
          title: LL.CardFlow.OrderPhysicalCard.Confirm.title(),
          subtitle: LL.CardFlow.OrderPhysicalCard.Confirm.subtitle(),
          buttonLabel: LL.CardFlow.OrderPhysicalCard.Confirm.placeOrder(),
          onButtonPress: handleSubmit,
          isButtonDisabled: !applicationId,
        }
      default: {
        const _exhaustive: never = step
        throw new Error(`Unknown step: ${_exhaustive}`)
      }
    }
  }

  const renderStepContent = (): React.ReactNode => {
    switch (step) {
      case Step.Shipping:
        return (
          <ShippingStep
            hasRegisteredAddress={initialAddress !== null}
            registeredAddress={registeredAddress}
            useRegisteredAddress={state.useRegisteredAddress}
            onToggleUseRegisteredAddress={toggleUseRegisteredAddress}
            customAddress={state.customAddress}
            onCustomAddressChange={setCustomAddress}
            onFormValidityChange={setIsFormValid}
          />
        )
      case Step.Confirm:
        return (
          <ConfirmStep
            deliveryType={state.selectedDelivery}
            shippingAddress={
              state.useRegisteredAddress ? registeredAddress : state.customAddress
            }
          />
        )
      default: {
        const _exhaustive: never = step
        throw new Error(`Unknown step: ${_exhaustive}`)
      }
    }
  }

  if (cardLoading || addressLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            testID="activity-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </Screen>
    )
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
      loading={createLoading}
    >
      {renderStepContent()}
    </SteppedCardLayout>
  )
}

const useStyles = makeStyles(() => ({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
}))
