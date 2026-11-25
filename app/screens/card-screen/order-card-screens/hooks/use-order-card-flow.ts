import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useShippingAddressDraft } from "@app/screens/card-screen/hooks/use-shipping-address-draft"
import { ShippingAddress } from "@app/screens/card-screen/types"

export const Step = {
  Shipping: 1,
  Confirm: 2,
} as const

export type StepType = (typeof Step)[keyof typeof Step]

type FlowState = {
  useKycAddress: boolean
  customAddress: ShippingAddress
}

type UseOrderCardFlowParams = {
  initialAddress: ShippingAddress | null
}

type UseOrderCardFlowReturn = {
  step: StepType
  state: FlowState
  toggleUseKycAddress: () => void
  setCustomAddress: (address: ShippingAddress) => void
  goToNextStep: () => void
  completeFlow: () => void
}

const FIRST_STEP = Step.Shipping
const LAST_STEP = Step.Confirm

export const useOrderCardFlow = ({
  initialAddress,
}: UseOrderCardFlowParams): UseOrderCardFlowReturn => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [step, setStep] = useState<StepType>(FIRST_STEP)
  /** Unticked by default: the KYC address is a choice, never the default (D42, D123). */
  const [useKycAddress, setUseKycAddress] = useState(false)
  const [customAddress, setCustomAddress] = useShippingAddressDraft(initialAddress)
  const isCompleteRef = useRef(false)

  const goToNextStep = useCallback(() => {
    setStep((prev) => (prev >= LAST_STEP ? prev : ((prev + 1) as StepType)))
  }, [])

  const goToPreviousStep = useCallback(() => {
    if (step === FIRST_STEP) return false
    setStep((prev) => (prev - 1) as StepType)
    return true
  }, [step])

  const toggleUseKycAddress = useCallback(() => {
    setUseKycAddress((prev) => !prev)
  }, [])

  const completeFlow = useCallback(() => {
    isCompleteRef.current = true
  }, [])

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
    state: {
      useKycAddress,
      customAddress,
    },
    toggleUseKycAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  }
}
