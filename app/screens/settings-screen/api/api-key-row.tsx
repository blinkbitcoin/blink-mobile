import * as React from "react"
import { View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles } from "@rn-vui/themed"

import { SettingsRow } from "../row"
import { ApiKeyItem, apiKeyStatus, formatScopes } from "./use-api-keys"

const formatDate = (timestamp: number): string =>
  new Date(timestamp * 1000).toLocaleDateString()

type Props = {
  apiKey: ApiKeyItem
  onRevoke: (apiKey: ApiKeyItem) => void
}

export const ApiKeyRow: React.FC<Props> = ({ apiKey, onRevoke }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const status = apiKeyStatus(apiKey)

  if (status !== "active") {
    const statusLabel =
      status === "revoked"
        ? LL.ApiScreen.revoked()
        : LL.ApiScreen.expired({ date: formatDate(apiKey.expiresAt ?? apiKey.createdAt) })
    return (
      <View style={styles.inactive}>
        <SettingsRow
          title={apiKey.name}
          subtitle={`${formatScopes(apiKey.scopes, LL)} · ${statusLabel}`}
          subtitleShorter
          action={null}
          rightIcon={null}
        />
      </View>
    )
  }

  const expiryLabel = apiKey.expiresAt
    ? LL.ApiScreen.expiresOn({ date: formatDate(apiKey.expiresAt) })
    : LL.ApiScreen.neverExpires()

  return (
    <SettingsRow
      title={apiKey.name}
      subtitle={`${formatScopes(apiKey.scopes, LL)} · ${expiryLabel}`}
      subtitleShorter
      action={null}
      rightIcon="close"
      rightIconAction={() => onRevoke(apiKey)}
    />
  )
}

const useStyles = makeStyles(() => ({
  inactive: {
    opacity: 0.5,
  },
}))
