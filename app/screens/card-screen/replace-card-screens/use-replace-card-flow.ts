import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { IssueType, DeliveryType } from "./steps/types"

export const Step = {
  ReportIssue: 1,
  Delivery: 2,
  Confirm: 3,
} as const

export type StepType = (typeof Step)[keyof typeof Step]

type FlowState = {
  selectedIssue: IssueType | null
  selectedDelivery: DeliveryType | null
  useRegisteredAddress: boolean
}

type UseReplaceCardFlowReturn = {
  step: StepType
  state: FlowState
  setSelectedIssue: (issue: IssueType) => void
  setSelectedDelivery: (delivery: DeliveryType) => void
  toggleUseRegisteredAddress: () => void
  goToNextStep: () => void
  completeFlow: () => void
}

const FIRST_STEP = Step.ReportIssue
const LAST_STEP = Step.Confirm

export const useReplaceCardFlow = (): UseReplaceCardFlowReturn => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [step, setStep] = useState<StepType>(FIRST_STEP)
  const [selectedIssue, setSelectedIssue] = useState<IssueType | null>(null)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryType | null>(null)
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(true)
  const isCompleteRef = useRef(false)

  const goToNextStep = useCallback(() => {
    setStep((prev) => (prev >= LAST_STEP ? prev : ((prev + 1) as StepType)))
  }, [])

  const goToPreviousStep = useCallback(() => {
    if (step === FIRST_STEP) return false
    setStep((prev) => (prev - 1) as StepType)
    return true
  }, [step])

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
    step,
    state: {
      selectedIssue,
      selectedDelivery,
      useRegisteredAddress,
    },
    setSelectedIssue,
    setSelectedDelivery,
    toggleUseRegisteredAddress,
    goToNextStep,
    completeFlow,
  }
}
