import React, { useCallback } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

import { CardPinLayout } from "./card-pin-layout"
import { useCardPinUpdate } from "./hooks/use-card-pin-update"
import { usePinFlow } from "./hooks/use-pin-flow"
import { isWeakPin } from "./validate-pin"
import { useBiometricGate } from "../hooks/use-biometric-gate"

const Step = {
  NewPin: 1,
  Confirm: 2,
} as const

export const CardChangePinScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { updatePin, loading } = useCardPinUpdate()

  const handleBiometricFailure = useCallback(() => {
    toastShow({
      message: LL.CardFlow.PinScreens.ChangeFlow.biometricRequired(),
      LL,
    })
    navigation.goBack()
  }, [navigation, LL])

  const authenticated = useBiometricGate({
    description: LL.CardFlow.PinScreens.ChangeFlow.biometricDescription(),
    onFailure: handleBiometricFailure,
    required: true,
  })

  const {
    step,
    storedPin,
    setStoredPin,
    errorMessage,
    resetTrigger,
    showConfirmButton,
    goToNextStep,
    showError,
    confirmPin,
    completeFlow,
    handlePinChange,
  } = usePinFlow({ totalSteps: Step.Confirm })

  const steps = [
    LL.CardFlow.PinScreens.ChangeFlow.steps.newPin(),
    LL.CardFlow.PinScreens.ChangeFlow.steps.confirm(),
  ]

  const handlePinComplete = useCallback(
    (pin: string) => {
      if (step === Step.NewPin) {
        if (isWeakPin(pin)) {
          showError(LL.CardFlow.PinScreens.common.weakPin())
          return
        }
        setStoredPin(pin)
        goToNextStep()
        return
      }

      if (pin === storedPin) {
        confirmPin()
        return
      }

      showError(LL.CardFlow.PinScreens.common.pinMismatch())
    },
    [step, storedPin, setStoredPin, goToNextStep, confirmPin, showError, LL],
  )

  const handleConfirm = useCallback(async () => {
    const success = await updatePin(storedPin)
    if (!success) return

    completeFlow()
    navigation.navigate("cardSettingsScreen")

    toastShow({
      message: LL.CardFlow.PinScreens.ChangeFlow.pinChangedToast(),
      type: "success",
      LL,
    })
  }, [updatePin, storedPin, completeFlow, navigation, LL])

  const titles = [
    LL.CardFlow.PinScreens.ChangeFlow.enterNewPin(),
    LL.CardFlow.PinScreens.common.confirmNewPin(),
  ]

  const subtitles = [
    LL.CardFlow.PinScreens.ChangeFlow.enterNewPinSubtitle(),
    LL.CardFlow.PinScreens.common.confirmPinSubtitle(),
  ]

  if (!authenticated) return null

  return (
    <CardPinLayout
      steps={steps}
      currentStep={step}
      title={titles[step - 1]}
      subtitle={subtitles[step - 1]}
      errorMessage={errorMessage}
      showConfirmButton={showConfirmButton}
      confirmButtonLabel={LL.common.confirm()}
      loading={loading}
      resetTrigger={resetTrigger}
      onPinComplete={handlePinComplete}
      onPinChange={handlePinChange}
      onConfirm={handleConfirm}
    />
  )
}
