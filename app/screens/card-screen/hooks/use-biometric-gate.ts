import { useEffect, useRef, useState } from "react"

import BiometricWrapper from "@app/utils/biometricAuthentication"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

type UseBiometricGateParams = {
  description: string
  onFailure: () => void
  required?: boolean
  onlyIfBiometricsEnabled?: boolean
}

export const useBiometricGate = ({
  description,
  onFailure,
  required = false,
  onlyIfBiometricsEnabled = false,
}: UseBiometricGateParams) => {
  const [authenticated, setAuthenticated] = useState(false)
  const descriptionRef = useRef(description)
  descriptionRef.current = description
  const onFailureRef = useRef(onFailure)
  onFailureRef.current = onFailure
  const requiredRef = useRef(required)
  requiredRef.current = required
  const onlyIfBiometricsEnabledRef = useRef(onlyIfBiometricsEnabled)
  onlyIfBiometricsEnabledRef.current = onlyIfBiometricsEnabled

  useEffect(() => {
    const gate = async () => {
      try {
        if (onlyIfBiometricsEnabledRef.current) {
          const biometricsEnabled = await KeyStoreWrapper.getIsBiometricsEnabled()
          if (!biometricsEnabled) {
            setAuthenticated(true)
            return
          }
        }

        const sensorAvailable = await BiometricWrapper.isSensorAvailable()
        if (!sensorAvailable) {
          if (requiredRef.current) {
            onFailureRef.current()
            return
          }
          setAuthenticated(true)
          return
        }

        BiometricWrapper.authenticate(
          descriptionRef.current,
          () => setAuthenticated(true),
          onFailureRef.current,
        )
      } catch {
        onFailureRef.current()
      }
    }
    gate()
  }, [])

  return authenticated
}
