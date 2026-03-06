import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

type UsePinFlowOptions = {
  totalSteps: number
}

const FIRST_STEP = 1

export const usePinFlow = ({ totalSteps }: UsePinFlowOptions) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [step, setStep] = useState(FIRST_STEP)
  const [storedPin, setStoredPin] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [resetTrigger, setResetTrigger] = useState(0)
  const [showConfirmButton, setShowConfirmButton] = useState(false)
  const isCompleteRef = useRef(false)

  const goToNextStep = useCallback(() => {
    setResetTrigger((prev) => prev + 1)
    setStep((prev) => prev + 1)
  }, [])

  const showError = useCallback((message: string) => {
    setResetTrigger((prev) => prev + 1)
    setErrorMessage(message)
  }, [])

  const confirmPin = useCallback(() => {
    setShowConfirmButton(true)
  }, [])

  const completeFlow = useCallback(() => {
    isCompleteRef.current = true
  }, [])

  const handlePinChange = useCallback(() => {
    if (errorMessage) setErrorMessage("")
    if (showConfirmButton) setShowConfirmButton(false)
  }, [errorMessage, showConfirmButton])

  const goToPreviousStep = useCallback(() => {
    if (step === FIRST_STEP) return false

    setErrorMessage("")
    setResetTrigger((prev) => prev + 1)
    setShowConfirmButton(false)

    if (step === totalSteps) setStoredPin("")

    setStep((prev) => prev - 1)
    return true
  }, [step, totalSteps])

  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      if (isCompleteRef.current) return

      if (goToPreviousStep()) {
        e.preventDefault()
      }
    })
  }, [navigation, goToPreviousStep])

  return {
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
  }
}
