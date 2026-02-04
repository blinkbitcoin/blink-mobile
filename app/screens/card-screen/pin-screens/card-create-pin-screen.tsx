import React, { useCallback } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

import { CardPinLayout } from "./card-pin-layout"
import { usePinFlow } from "./use-pin-flow"

const Step = {
  SetPin: 1,
  Confirm: 2,
} as const

export const CardCreatePinScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
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
    LL.CardFlow.PinScreens.CreateFlow.steps.setPin(),
    LL.CardFlow.PinScreens.CreateFlow.steps.confirm(),
  ]

  const handlePinComplete = useCallback(
    (pin: string) => {
      if (step === Step.SetPin) {
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

  const handleConfirm = useCallback(() => {
    completeFlow()
    navigation.navigate("cardSettingsScreen")

    toastShow({
      message: LL.CardFlow.PinScreens.CreateFlow.pinCreatedToast(),
      type: "success",
      LL,
    })
  }, [completeFlow, navigation, LL])

  const titles = [
    LL.CardFlow.PinScreens.CreateFlow.enterYourPin(),
    LL.CardFlow.PinScreens.common.confirmNewPin(),
  ]

  const subtitles = [
    LL.CardFlow.PinScreens.CreateFlow.enterPinSubtitle(),
    LL.CardFlow.PinScreens.common.confirmPinSubtitle(),
  ]

  return (
    <CardPinLayout
      steps={steps}
      currentStep={step}
      title={titles[step - 1]}
      subtitle={subtitles[step - 1]}
      errorMessage={errorMessage}
      showConfirmButton={showConfirmButton}
      confirmButtonLabel={LL.common.confirm()}
      resetTrigger={resetTrigger}
      onPinComplete={handlePinComplete}
      onPinChange={handlePinChange}
      onConfirm={handleConfirm}
    />
  )
}
