import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import useDeviceLocation from "@app/hooks/use-device-location"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { getRegionsByCountry } from "@app/utils/country-region-data"
import { Delivery, DeliveryType, ShippingAddress } from "@app/screens/card-screen/types"

const FALLBACK_COUNTRY = "US"

const buildDefaultAddress = (countryCode: string): ShippingAddress => ({
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: getRegionsByCountry(countryCode)[0]?.value ?? "",
  postalCode: "",
  countryCode,
})

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
  const { countryCode: detectedCountry } = useDeviceLocation()

  const [step, setStep] = useState<StepType>(FIRST_STEP)
  const [selectedDelivery] = useState<DeliveryType>(Delivery.Standard)
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(
    initialAddress !== null,
  )
  const [customAddress, setCustomAddress] = useState<ShippingAddress>(
    initialAddress ?? buildDefaultAddress(FALLBACK_COUNTRY),
  )
  const isCompleteRef = useRef(false)
  const hasInitializedRef = useRef(initialAddress !== null)
  const hasAppliedLocationRef = useRef(false)

  useEffect(() => {
    if (hasInitializedRef.current) return
    if (!initialAddress) return

    hasInitializedRef.current = true
    setUseRegisteredAddress(true)
    setCustomAddress(initialAddress)
  }, [initialAddress])

  useEffect(() => {
    if (hasInitializedRef.current) return
    if (hasAppliedLocationRef.current) return
    if (!detectedCountry) return

    hasAppliedLocationRef.current = true
    setCustomAddress(buildDefaultAddress(detectedCountry))
  }, [detectedCountry])

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
