import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useShippingAddressDraft } from "@app/screens/card-screen/hooks/use-shipping-address-draft"
import { Delivery, DeliveryType, ShippingAddress } from "@app/screens/card-screen/types"

import { IssueType } from "../steps/types"

export const Step = {
  ReportIssue: "ReportIssue",
  Delivery: "Delivery",
  Confirm: "Confirm",
} as const

export type StepName = (typeof Step)[keyof typeof Step]

const PHYSICAL_STEPS: StepName[] = [Step.ReportIssue, Step.Delivery, Step.Confirm]
const VIRTUAL_STEPS: StepName[] = [Step.ReportIssue, Step.Confirm]

type FlowState = {
  selectedIssue: IssueType | null
  selectedDelivery: DeliveryType
  useKycAddress: boolean
  customAddress: ShippingAddress
}

type UseReplaceCardFlowParams = {
  isVirtualCard: boolean
  initialAddress: ShippingAddress | null
}

type UseReplaceCardFlowReturn = {
  currentStep: StepName
  stepNumber: number
  totalSteps: number
  stepOrder: StepName[]
  state: FlowState
  setSelectedIssue: (issue: IssueType) => void
  setSelectedDelivery: (delivery: DeliveryType) => void
  toggleUseKycAddress: () => void
  setCustomAddress: (address: ShippingAddress) => void
  goToNextStep: () => void
  completeFlow: () => void
}

export const useReplaceCardFlow = ({
  isVirtualCard,
  initialAddress,
}: UseReplaceCardFlowParams): UseReplaceCardFlowReturn => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const stepOrder = useMemo(
    () => (isVirtualCard ? VIRTUAL_STEPS : PHYSICAL_STEPS),
    [isVirtualCard],
  )

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedIssue, setSelectedIssue] = useState<IssueType | null>(null)
  /** The courier is the only delivery offered, so it starts chosen. */
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryType>(Delivery.Courier)
  /** Unticked by default: the KYC address is a choice, never the default (D42, D123). */
  const [useKycAddress, setUseKycAddress] = useState(false)
  const [customAddress, setCustomAddress] = useShippingAddressDraft(initialAddress)
  const isCompleteRef = useRef(false)

  const currentStep = stepOrder[currentStepIndex]
  const stepNumber = currentStepIndex + 1
  const totalSteps = stepOrder.length

  const goToNextStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, stepOrder.length - 1))
  }, [stepOrder.length])

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex === 0) return false
    setCurrentStepIndex((prev) => prev - 1)
    return true
  }, [currentStepIndex])

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
    currentStep,
    stepNumber,
    totalSteps,
    stepOrder,
    state: {
      selectedIssue,
      selectedDelivery,
      useKycAddress,
      customAddress,
    },
    setSelectedIssue,
    setSelectedDelivery,
    toggleUseKycAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  }
}
