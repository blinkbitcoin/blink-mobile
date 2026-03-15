import { useState, useCallback } from "react"
import { Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
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

export const useKycFlow = ({
  firstName,
  lastName,
  type,
  headerTitle,
}: UseKycFlowParams = {}) => {
  const { navigate, goBack } = useNavigation<StackNavigationProp<RootStackParamList>>()
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

  const startKyc = useCallback(async () => {
    setLoading(true)

    try {
      const res = await kycFlowStart({
        variables: { input: { firstName, lastName, type } },
      })

      const token = res.data?.kycFlowStart?.tokenWeb ?? ""
      const workflowRunId = res.data?.kycFlowStart?.workflowRunId ?? ""

      const query = new URLSearchParams({
        token,
        ...(locale && { lang: locale }),
        ...(mode && { theme: mode }),
      }).toString()

      const workflowRunIdParam = workflowRunId ? `&workflow_run_id=${workflowRunId}` : ""
      const url = `${kycUrl}/webflow?${query}${workflowRunIdParam}`

      navigate("webView", {
        url,
        headerTitle: headerTitle ?? LL.UpgradeAccountModal.title(),
      })
    } catch (err) {
      console.error("error:", err)
      const message = err instanceof Error ? err.message : ""

      if (message.match(/canceled/i)) {
        goBack()
        setLoading(false)
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
    } finally {
      setLoading(false)
    }
  }, [
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
  ])

  return { startKyc, loading }
}
