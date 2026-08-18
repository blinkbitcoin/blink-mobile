import { useCallback, useEffect, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import BiometricWrapper from "@app/utils/biometricAuthentication"
import { PinScreenPurpose } from "@app/utils/enum"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"

/**
 * Why the gate could not authenticate:
 * - `noFactor`: nothing is configured to challenge with (only reported when
 *   `required` fails closed).
 * - `unavailable`: a configured factor could not be satisfied — sensor gone or
 *   biometrics failed with no pin to fall back to, or the keystore errored.
 *   (A biometric-prompt cancel with no pin lands here too: the library callback
 *   cannot distinguish a cancel from a mismatch.)
 * - `declined`: the user dismissed the pin challenge on purpose.
 */
export type AuthGateFailureReason = "noFactor" | "unavailable" | "declined"

type UseLocalAuthGateParams = {
  /** Shown in the OS biometric prompt. */
  description: string
  /** Reports the gate's final failure — biometrics and pin both out of road. */
  onFailure: (reason: AuthGateFailureReason) => void
  /**
   * Governs exactly one case: what happens when NO factor is configured (no pin,
   * no biometrics). The default fails closed. Opting out is a product decision;
   * do it explicitly and say why at the call site. Every other path is
   * unaffected — a factor the user configured is always enforced.
   */
  required?: boolean
}

/**
 * The failure behavior every gated screen shares: bounce back, and explain the
 * bounce unless the user caused it themselves. Declines are silent — the user
 * cancelled and knows why; the settings-advice toast is for the causes where
 * they lack (or cannot use) a factor.
 */
export const useAuthGateFailureHandler = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return useCallback(
    (reason: AuthGateFailureReason) => {
      if (reason !== "declined") {
        toastShow({
          message: (translations) =>
            translations.AuthenticationScreen.authenticationRequired(),
          LL,
        })
      }
      navigation.goBack()
    },
    [navigation, LL],
  )
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
        onChallengeFailure: () => mounted && onFailureRef.current("declined"),
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
            onFailureRef.current("noFactor")
            return
          }
          setAuthenticated(true)
          return
        }

        const fallThroughToPin = () =>
          pinEnabled ? challengePin() : onFailureRef.current("unavailable")

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
          onFailureRef.current("unavailable")
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
