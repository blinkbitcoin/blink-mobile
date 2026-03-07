import { useEffect, useRef, useState } from "react"

import BiometricWrapper from "@app/utils/biometricAuthentication"

type UseBiometricGateParams = {
  description: string
  onFailure: () => void
  required?: boolean
}

export const useBiometricGate = ({
  description,
  onFailure,
  required = false,
}: UseBiometricGateParams) => {
  const [authenticated, setAuthenticated] = useState(false)
  const descriptionRef = useRef(description)
  descriptionRef.current = description
  const onFailureRef = useRef(onFailure)
  onFailureRef.current = onFailure
  const requiredRef = useRef(required)
  requiredRef.current = required

  useEffect(() => {
    const gate = async () => {
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
    }
    gate()
  }, [])

  return authenticated
}
