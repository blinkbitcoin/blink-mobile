import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  SUPPORTED_COUNTRIES,
  getRegionsByCountry,
} from "@app/screens/card-screen/country-region-data"
import { Delivery, DeliveryType, ShippingAddress } from "@app/screens/card-screen/types"

const DEFAULT_COUNTRY = SUPPORTED_COUNTRIES[0].value
const DEFAULT_REGION = getRegionsByCountry(DEFAULT_COUNTRY)[0]?.value ?? ""

const DEFAULT_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: DEFAULT_REGION,
  postalCode: "",
  countryCode: DEFAULT_COUNTRY,
}

export const Step = {
  Shipping: 1,
  Confirm: 2,
} as const

export type StepType = (typeof Step)[keyof typeof Step]

type FlowState = {
  selectedDelivery: DeliveryType
  useRegisteredAddress: boolean
  customAddress: ShippingAddress
}

type UseOrderCardFlowParams = {
  initialAddress: ShippingAddress | null
}

type UseOrderCardFlowReturn = {
  step: StepType
  state: FlowState
  toggleUseRegisteredAddress: () => void
  setCustomAddress: (address: ShippingAddress) => void
  goToNextStep: () => void
  completeFlow: () => void
}

const FIRST_STEP = Step.Shipping
const LAST_STEP = Step.Confirm

export const useOrderCardFlow = ({
  initialAddress,
}: UseOrderCardFlowParams): UseOrderCardFlowReturn => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [step, setStep] = useState<StepType>(FIRST_STEP)
  const [selectedDelivery] = useState<DeliveryType>(Delivery.Standard)
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(
    initialAddress !== null,
  )
  const [customAddress, setCustomAddress] = useState<ShippingAddress>(
    initialAddress ?? DEFAULT_ADDRESS,
  )
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
      selectedDelivery,
      useRegisteredAddress,
      customAddress,
    },
    toggleUseRegisteredAddress,
    setCustomAddress,
    goToNextStep,
    completeFlow,
  }
}
