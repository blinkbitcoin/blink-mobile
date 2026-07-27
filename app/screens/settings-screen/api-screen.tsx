import * as React from "react"
import { Alert, Linking } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { ApiKeysDocument, useApiKeyRevokeMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import { useTheme, makeStyles } from "@rn-vui/themed"

import { ApiKeyRow } from "./api/api-key-row"
import { ApiKeyItem, useApiKeysList } from "./api/use-api-keys"
import { SettingsGroup } from "./group"
import { SettingsRow } from "./row"

const DASHBOARD_LINK = "https://dashboard.blink.sv"

export const ApiScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { apiKeys, loading, hasError } = useApiKeysList()
  const [apiKeyRevoke] = useApiKeyRevokeMutation({
    refetchQueries: [{ query: ApiKeysDocument }],
  })

  const revokeApiKey = React.useCallback(
    (apiKey: ApiKeyItem) => {
      Alert.alert(
        LL.ApiScreen.revokeTitle(),
        LL.ApiScreen.revokeBody({ name: apiKey.name }),
        [
          { text: LL.common.cancel(), style: "cancel" },
          {
            text: LL.ApiScreen.revoke(),
            style: "destructive",
            onPress: async () => {
              try {
                await apiKeyRevoke({ variables: { input: { id: apiKey.id } } })
                toastShow({ type: "success", message: LL.ApiScreen.revokeSuccess(), LL })
              } catch {
                toastShow({ type: "error", message: LL.ApiScreen.revokeError(), LL })
              }
            },
          },
        ],
      )
    },
    [LL, apiKeyRevoke],
  )

  const apiKeyItems: React.FC[] = [
    ...(loading
      ? [() => <SettingsRow title="" action={null} loading />]
      : apiKeys.length === 0
        ? [
            () => (
              <SettingsRow title={LL.ApiScreen.noKeys()} action={null} rightIcon={null} />
            ),
          ]
        : apiKeys.map((apiKey) => {
            const ApiKeyRowItem: React.FC = () => (
              <ApiKeyRow apiKey={apiKey} onRevoke={revokeApiKey} />
            )
            return ApiKeyRowItem
          })),
    () => (
      <SettingsRow
        title={LL.ApiScreen.createKey()}
        leftGaloyIcon="key-outline"
        action={() => navigate("apiKeyCreateScreen")}
      />
    ),
  ]

  const LinkIcon = <GaloyIcon name="arrow-square-out" size={20} color={colors.primary} />

  const apiSettings = [
    () => (
      <SettingsRow
        title={LL.SettingsScreen.apiDocumentation()}
        leftGaloyIcon="document-outline"
        rightIcon={LinkIcon}
        action={() => Linking.openURL(DASHBOARD_LINK)}
      />
    ),
    () => (
      <SettingsRow
        title={LL.SettingsScreen.apiDashboard()}
        leftGaloyIcon="house-outline"
        rightIcon={LinkIcon}
        action={() => Linking.openURL(DASHBOARD_LINK)}
      />
    ),
  ]

  return (
    <Screen style={styles.container} preset="scroll">
      {hasError && <GaloyErrorBox errorMessage={LL.ApiScreen.loadError()} />}
      <SettingsGroup name={LL.ApiScreen.keysGroupTitle()} items={apiKeyItems} />
      <SettingsGroup items={apiSettings} />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    rowGap: 12,
  },
}))
