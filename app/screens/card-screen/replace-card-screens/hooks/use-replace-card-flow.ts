import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  DeliveryType,
  EMPTY_ADDRESS,
  ShippingAddress,
} from "@app/screens/card-screen/types"

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
  selectedDelivery: DeliveryType | null
  useRegisteredAddress: boolean
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
  toggleUseRegisteredAddress: () => void
  setCustomAddress: (address: ShippingAddress) => void
  goToNextStep: () => void
  completeFlow: () => void
}

export const useReplaceCardFlow = ({
  isVirtualCard,
  initialAddress,
}: UseReplaceCardFlowParams): UseReplaceCardFlowReturn => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const stepOrder = useMemo(
    () => (isVirtualCard ? VIRTUAL_STEPS : PHYSICAL_STEPS),
    [isVirtualCard],
  )

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedIssue, setSelectedIssue] = useState<IssueType | null>(null)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryType | null>(null)
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(
    initialAddress !== null,
  )
  const [customAddress, setCustomAddress] = useState<ShippingAddress>(
    initialAddress ?? EMPTY_ADDRESS,
  )
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

  const toggleUseRegisteredAddress = useCallback(() => {
    setUseRegisteredAddress((prev) => !prev)
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
      useRegisteredAddress,
      customAddress,
    },
    setSelectedIssue,
    setSelectedDelivery,
    toggleUseRegisteredAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  }
}
