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
          /** Fails closed. This gate stands in front of the recovery phrase, so
           *  a store that cannot say whether biometrics are on must not be read
           *  as "off" and waved through — only a definite `no` skips the prompt. */
          const biometrics = await KeyStoreWrapper.readIsBiometricsEnabled()
          if (biometrics.status === "no") {
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
