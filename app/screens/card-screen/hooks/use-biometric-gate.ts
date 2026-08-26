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
        /** Fails closed. This gate stands in front of the recovery phrase, so
         *  a store that cannot say whether biometrics are on must not be read
         *  as "off" and waved through — only a definite `no` skips the prompt. */
        const biometrics = onlyIfBiometricsEnabledRef.current
          ? await KeyStoreWrapper.readIsBiometricsEnabled()
          : null
        if (biometrics?.status === "no") {
          setAuthenticated(true)
          return
        }
        const isSettingUnreadable = biometrics?.status === "failed"

        const sensorAvailable = await BiometricWrapper.isSensorAvailable()
        if (!sensorAvailable) {
          /** An unreadable setting must not reach the wave-through either. The
           *  slot's protection class leaves a window before the first unlock
           *  where the read fails, and scoring that as "no gate needed" is the
           *  same mistake the short-circuit above refuses to make — one step
           *  later. Closing here costs a retry, not access: the failure clears
           *  once the device is unlocked, whereas a definite `no` never reaches
           *  this line and a genuinely disabled sensor still waves through. */
          const shouldFailClosed = requiredRef.current || isSettingUnreadable
          if (shouldFailClosed) {
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
