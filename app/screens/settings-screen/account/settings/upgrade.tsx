import * as React from "react"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { SettingsRow } from "../../row"
import { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { useRemoteConfig } from "@app/config/feature-flags-context"

export const UpgradeAccountLevelOne: React.FC = () => {
  const { currentLevel } = useLevel()
  const { LL } = useI18nContext()

  const { sumsubSuccessUrl, sumsubRejectUrl } = useRemoteConfig()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  if (currentLevel !== AccountLevel.One) return <></>

  const onShouldStartLoad = React.useCallback(
    (request: ShouldStartLoadRequest) => {
      const requestUrl = request?.url ?? ""
      if (!requestUrl) return true

      const parsed = new URL(requestUrl)
      const urlWithoutQuery = `${parsed.origin}${parsed.pathname}`

      if (urlWithoutQuery === sumsubSuccessUrl) {
        // TODO: navigate to Sumsub success screen
        navigate("settings")
        return false
      }

      if (urlWithoutQuery === sumsubRejectUrl) {
        // TODO: navigate to Sumsub reject screen
        navigate("settings")
        return false
      }

      return true
    },
    [navigate, sumsubSuccessUrl, sumsubRejectUrl],
  )

  const handleSumsubFlow = () => {
    /**
     * TODO: temporary until backend provides the url
     */
    const url = ""
    navigate("webView", {
      url,
      hideHeader: true,
      onShouldStartLoad,
    })
  }

  return (
    <SettingsRow
      title={LL.AccountScreen.upgrade()}
      leftIcon="person-outline"
      action={handleSumsubFlow}
    />
  )
}
