import * as React from "react"
import { Linking, TouchableOpacity, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { ApiKeysDocument, useApiKeyRevokeMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"
import { useTheme, makeStyles, Text } from "@rn-vui/themed"

import { ApiKeyRow } from "./api/api-key-row"
import { RevokeApiKeyModal } from "./api/revoke-api-key-modal"
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

  const { activeKeys, inactiveKeys, loading, hasError } = useApiKeysList()
  // not remembered: the section starts collapsed every time the screen opens
  const [inactiveExpanded, setInactiveExpanded] = React.useState(false)
  const [apiKeyRevoke] = useApiKeyRevokeMutation({
    refetchQueries: [{ query: ApiKeysDocument }],
  })

  const [keyToRevoke, setKeyToRevoke] = React.useState<ApiKeyItem | null>(null)
  const [revoking, setRevoking] = React.useState(false)

  const revokeApiKey = async (apiKey: ApiKeyItem) => {
    setRevoking(true)
    try {
      await apiKeyRevoke({ variables: { input: { id: apiKey.id } } })
      toastShow({ type: "success", message: LL.ApiScreen.revokeSuccess(), LL })
    } catch {
      toastShow({ type: "error", message: LL.ApiScreen.revokeError(), LL })
    } finally {
      setRevoking(false)
      setKeyToRevoke(null)
    }
  }

  const toRowItems = (keys: ApiKeyItem[]): React.FC[] =>
    keys.map((apiKey) => {
      const ApiKeyRowItem: React.FC = () => (
        <ApiKeyRow apiKey={apiKey} onRevoke={setKeyToRevoke} />
      )
      return ApiKeyRowItem
    })

  const apiKeyItems: React.FC[] = [
    ...(loading
      ? [() => <SettingsRow title="" action={null} loading />]
      : activeKeys.length === 0
        ? [
            () => (
              <SettingsRow title={LL.ApiScreen.noKeys()} action={null} rightIcon={null} />
            ),
          ]
        : toRowItems(activeKeys)),
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
      {!loading && inactiveKeys.length > 0 && (
        <View style={styles.inactiveSection}>
          <TouchableOpacity
            {...testProps("inactive-keys-toggle")}
            accessibilityRole="button"
            accessibilityState={{ expanded: inactiveExpanded }}
            style={styles.inactiveToggle}
            onPress={() => setInactiveExpanded(!inactiveExpanded)}
          >
            <GaloyIcon name={inactiveExpanded ? "caret-down" : "caret-right"} size={20} />
            <Text type="p2">
              {LL.ApiScreen.inactiveKeys({ count: inactiveKeys.length })}
            </Text>
          </TouchableOpacity>
          {inactiveExpanded && <SettingsGroup items={toRowItems(inactiveKeys)} />}
        </View>
      )}
      <SettingsGroup items={apiSettings} />
      <RevokeApiKeyModal
        apiKey={keyToRevoke}
        revoking={revoking}
        onClose={() => setKeyToRevoke(null)}
        onRevoke={revokeApiKey}
      />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    rowGap: 12,
  },
  inactiveSection: {
    rowGap: 10,
  },
  inactiveToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
}))
