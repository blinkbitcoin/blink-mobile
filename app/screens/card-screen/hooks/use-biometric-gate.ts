import { useEffect, useRef, useState } from "react"

import BiometricWrapper from "@app/utils/biometricAuthentication"

type UseBiometricGateParams = {
  description: string
  onFailure: () => void
}

export const useBiometricGate = ({ description, onFailure }: UseBiometricGateParams) => {
  const [authenticated, setAuthenticated] = useState(false)
  const descriptionRef = useRef(description)
  descriptionRef.current = description
  const onFailureRef = useRef(onFailure)
  onFailureRef.current = onFailure

  useEffect(() => {
    const gate = async () => {
      const sensorAvailable = await BiometricWrapper.isSensorAvailable()
      if (!sensorAvailable) {
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
