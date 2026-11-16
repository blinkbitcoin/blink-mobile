import { useState, useCallback, useRef } from "react"
import { Alert } from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme } from "@rn-vui/themed"
import { gql } from "@apollo/client"

import { useAppConfig } from "@app/hooks/use-app-config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { KycFlowType, useKycFlowStartMutation } from "@app/graphql/generated"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

gql`
  mutation kycFlowStart($input: KycFlowStartInput!) {
    kycFlowStart(input: $input) {
      workflowRunId
      tokenWeb
    }
  }
`

type UseKycFlowParams = {
  firstName?: string
  lastName?: string
  type?: KycFlowType
  headerTitle?: string
}

/** One press of the start, set aside when the user leaves the screen before it answers. */
type StartAttempt = { isAbandoned: boolean }

/**
 * The flow types whose start is still unanswered, shared by every mounted screen: a user
 * who leaves the step and opens it again before the first start answers gets a new
 * screen, which must not start a second verification.
 */
const kycStartsInFlight = new Set<KycFlowType | undefined>()

export const useKycFlow = ({
  firstName,
  lastName,
  type,
  headerTitle,
}: UseKycFlowParams = {}) => {
  const { navigate, goBack } =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL, locale } = useI18nContext()
  const {
    theme: { mode },
  } = useTheme()
  const [kycFlowStart] = useKycFlowStartMutation()
  const {
    appConfig: {
      galoyInstance: { kycUrl },
    },
  } = useAppConfig()

  const [loading, setLoading] = useState(false)
  /**
   * Taken in the same frame as the press, before `loading` reaches the button, so a
   * second tap cannot start a second verification and push a second web flow.
   */
  const isStartingRef = useRef(false)
  /**
   * The web flow is pushed over the screen, so an opened verification stays held until
   * the user is back on it: a tap during the push cannot open a second one.
   */
  const isWebFlowOpenRef = useRef(false)
  /** The press still waiting for its answer, if any. */
  const pendingAttemptRef = useRef<StartAttempt | null>(null)

  const releaseStart = useCallback(() => {
    isStartingRef.current = false
    setLoading(false)
  }, [])

  /**
   * Leaving the screen, by closing it or going back, sets the pending press aside: its
   * late answer must not navigate, alert or go back from a screen the user already left.
   * The hold is released here, so the step is usable again if the user returns to it.
   */
  const abandonPendingStart = useCallback(() => {
    const pendingAttempt = pendingAttemptRef.current
    if (!pendingAttempt) return

    pendingAttempt.isAbandoned = true
    pendingAttemptRef.current = null
    releaseStart()
  }, [releaseStart])

  useFocusEffect(
    useCallback(() => {
      if (isWebFlowOpenRef.current) {
        isWebFlowOpenRef.current = false
        releaseStart()
      }

      return abandonPendingStart
    }, [releaseStart, abandonPendingStart]),
  )

  const requestKyc = useCallback(
    async (attempt: StartAttempt) => {
      try {
        const res = await kycFlowStart({
          variables: {
            input: { firstName: firstName?.trim(), lastName: lastName?.trim(), type },
          },
        })
        if (attempt.isAbandoned) return

        const token = res.data?.kycFlowStart?.tokenWeb ?? ""
        const workflowRunId = res.data?.kycFlowStart?.workflowRunId ?? ""

        const query = new URLSearchParams({
          token,
          ...(locale && { lang: locale }),
          ...(mode && { theme: mode }),
        }).toString()

        const workflowRunIdParam = workflowRunId
          ? `&workflow_run_id=${workflowRunId}`
          : ""
        const url = `${kycUrl}/webflow?${query}${workflowRunIdParam}`

        /** Settled before the push: the push blurs this screen, and that blur must not
         *  read the verification it opened as one the user left. */
        pendingAttemptRef.current = null
        isWebFlowOpenRef.current = true
        navigate("webView", {
          url,
          headerTitle: headerTitle ?? LL.UpgradeAccountModal.title(),
        })
      } catch (err) {
        console.error("error:", err)
        if (attempt.isAbandoned) return

        const message = err instanceof Error ? err.message : ""

        if (message.match(/canceled/i)) {
          goBack()
          return
        }

        Alert.alert(
          LL.FullOnboarding.error(),
          `${LL.GaloyAddressScreen.somethingWentWrong()}\n\n${message}`,
          [
            {
              text: LL.common.ok(),
              onPress: () => {
                goBack()
              },
            },
          ],
        )
      }
    },
    [
      LL,
      firstName,
      lastName,
      type,
      headerTitle,
      locale,
      mode,
      navigate,
      goBack,
      kycFlowStart,
      kycUrl,
    ],
  )

  const startKyc = useCallback((): Promise<void> => {
    const isAlreadyStarting = isStartingRef.current || kycStartsInFlight.has(type)
    if (isAlreadyStarting) return Promise.resolve()

    const attempt: StartAttempt = { isAbandoned: false }
    pendingAttemptRef.current = attempt
    kycStartsInFlight.add(type)
    isStartingRef.current = true
    setLoading(true)

    return requestKyc(attempt).finally(() => {
      kycStartsInFlight.delete(type)
      const isStillPending = pendingAttemptRef.current === attempt
      if (isStillPending) pendingAttemptRef.current = null

      /** A press set aside was released when the user left, and an opened web flow is
       *  released when the user is back on the screen. */
      const isReleasedElsewhere = attempt.isAbandoned || isWebFlowOpenRef.current
      if (!isReleasedElsewhere) releaseStart()
    })
  }, [type, requestKyc, releaseStart])

  return { startKyc, loading }
}
