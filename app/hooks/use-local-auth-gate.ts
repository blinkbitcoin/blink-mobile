import { useEffect, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

type UseLocalAuthGateParams = {
  /** Shown in the OS biometric prompt. */
  description: string
  /** Reports the gate's final failure — biometrics and pin both out of road. */
  onFailure: () => void
  /**
   * Governs exactly one case: what happens when NO factor is configured (no pin,
   * no biometrics). The default fails closed. Opting out is a product decision;
   * do it explicitly and say why at the call site. Every other path is
   * unaffected — a factor the user configured is always enforced.
   */
  required?: boolean
}

/**
 * Gates a screen behind whatever local factors the user has configured:
 * biometrics when available, the pin challenge as the fallback, failing closed
 * whenever a configured factor cannot be satisfied. Deliberately STRICTER than
 * the app unlock (authentication-check-screen.tsx), which fails open for a
 * biometrics-only user whose sensor is gone rather than brick them out of the
 * whole app — behind an in-app gate the right price for a dead sensor is losing
 * the one screen. Runs once per mount; `authenticated` latches true for the
 * caller's lifetime.
 */
export const useLocalAuthGate = ({
  description,
  onFailure,
  required = true,
}: UseLocalAuthGateParams) => {
  const [authenticated, setAuthenticated] = useState(false)
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const descriptionRef = useRef(description)
  descriptionRef.current = description
  const onFailureRef = useRef(onFailure)
  onFailureRef.current = onFailure
  const requiredRef = useRef(required)
  requiredRef.current = required

  useEffect(() => {
    /** The challenge resolves through closures that can outlive this screen — a
     *  lockout resets the whole stack — so results landing late are dropped. */
    let mounted = true

    /** push, never navigate: navigate onto an already-focused pin route replaces
     *  its params, so a deferred challenge could rewrite the resume app-lock's
     *  screen (dropping isResume and its dismissal guards) instead of stacking
     *  a separate challenge on top of it. */
    const challengePin = () =>
      navigation.push("pin", {
        screenPurpose: PinScreenPurpose.ChallengePin,
        onChallengeSuccess: () => mounted && setAuthenticated(true),
        onChallengeFailure: () => mounted && onFailureRef.current(),
      })

    const gate = async () => {
      try {
        const [pinEnabled, biometricsEnabled] = await Promise.all([
          KeyStoreWrapper.getIsPinEnabled(),
          KeyStoreWrapper.getIsBiometricsEnabled(),
        ])
        /** The awaits make initiation itself a late result: a caller popped while
         *  the reads were in flight must not be challenged over its successor. */
        if (!mounted) {
          return
        }

        if (!pinEnabled && !biometricsEnabled) {
          // The only branch `required` governs: there is nothing to challenge with.
          if (requiredRef.current) {
            onFailureRef.current()
            return
          }
          setAuthenticated(true)
          return
        }

        const fallThroughToPin = () =>
          pinEnabled ? challengePin() : onFailureRef.current()

        if (biometricsEnabled) {
          // A missing or erroring sensor never opens the gate — the user asked for
          // biometrics, so it falls through to the pin or fails, never past.
          const sensorAvailable = await BiometricWrapper.isSensorAvailable().catch(
            () => false,
          )
          if (!mounted) {
            return
          }
          if (!sensorAvailable) {
            fallThroughToPin()
            return
          }

          BiometricWrapper.authenticate(
            descriptionRef.current,
            () => mounted && setAuthenticated(true),
            // The callback carries no error: cancel, mismatch and the fallback
            // button all land here, and all deserve the pin fallback.
            () => mounted && fallThroughToPin(),
          )
          return
        }

        fallThroughToPin()
      } catch {
        if (mounted) {
          onFailureRef.current()
        }
      }
    }

    gate()
    return () => {
      mounted = false
    }
  }, [navigation])

  return authenticated
}
