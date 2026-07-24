import * as React from "react"
import { Pressable, View } from "react-native"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyInput } from "@app/components/atomic/galoy-input"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Switch } from "@app/components/atomic/switch"
import { Screen } from "@app/components/screen"
import { ApiKeysDocument, Scope, useApiKeyCreateMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { ApiKeySecretReveal } from "./api-key-secret-reveal"

const MAX_KEY_NAME_LENGTH = 64

type ExpiryPreset = 30 | 90 | null

export const ApiKeyCreateScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [name, setName] = React.useState("")
  const [readEnabled, setReadEnabled] = React.useState(true)
  const [receiveEnabled, setReceiveEnabled] = React.useState(true)
  const [expireInDays, setExpireInDays] = React.useState<ExpiryPreset>(90)
  const [secret, setSecret] = React.useState<string | null>(null)
  const [hasError, setHasError] = React.useState(false)

  const [apiKeyCreate, { loading }] = useApiKeyCreateMutation({
    refetchQueries: [{ query: ApiKeysDocument }],
  })

  const expiryOptions: { label: string; value: ExpiryPreset }[] = [
    { label: LL.ApiScreen.expiry30Days(), value: 30 },
    { label: LL.ApiScreen.expiry90Days(), value: 90 },
    { label: LL.ApiScreen.expiryNever(), value: null },
  ]

  const canSubmit = name.trim().length > 0 && (readEnabled || receiveEnabled) && !loading

  const createApiKey = async () => {
    setHasError(false)
    const scopes: Scope[] = [
      ...(readEnabled ? [Scope.Read] : []),
      ...(receiveEnabled ? [Scope.Receive] : []),
    ]
    try {
      const { data } = await apiKeyCreate({
        variables: { input: { name: name.trim(), scopes, expireInDays } },
      })
      const apiKeySecret = data?.apiKeyCreate.apiKeySecret
      if (apiKeySecret) {
        setSecret(apiKeySecret)
      } else {
        setHasError(true)
      }
    } catch {
      setHasError(true)
    }
  }

  if (secret) {
    return <ApiKeySecretReveal secret={secret} name={name.trim()} />
  }

  return (
    <Screen style={styles.container} preset="scroll" keyboardShouldPersistTaps="handled">
      <GaloyInput
        {...testProps(LL.ApiScreen.keyName())}
        label={LL.ApiScreen.keyName()}
        placeholder={LL.ApiScreen.keyNamePlaceholder()}
        autoFocus
        maxLength={MAX_KEY_NAME_LENGTH}
        value={name}
        onChangeText={setName}
      />

      <View style={styles.scopeCard}>
        <View style={styles.scopeRow}>
          <View style={styles.scopeText}>
            <Text type="p2">{LL.ApiScreen.scopeRead()}</Text>
            <Text type="p4" color={colors.grey2}>
              {LL.ApiScreen.scopeReadDescription()}
            </Text>
          </View>
          <Switch
            testID="scope-read-switch"
            value={readEnabled}
            onValueChange={setReadEnabled}
          />
        </View>
        <View style={styles.scopeRow}>
          <View style={styles.scopeText}>
            <Text type="p2">{LL.ApiScreen.scopeReceive()}</Text>
            <Text type="p4" color={colors.grey2}>
              {LL.ApiScreen.scopeReceiveDescription()}
            </Text>
          </View>
          <Switch
            testID="scope-receive-switch"
            value={receiveEnabled}
            onValueChange={setReceiveEnabled}
          />
        </View>
      </View>
      <Text type="p4" color={colors.grey2} style={styles.footnote}>
        {LL.ApiScreen.writeScopeDashboardOnly()}
      </Text>

      <Text type="p2" style={styles.expiryLabel}>
        {LL.ApiScreen.expiry()}
      </Text>
      <View style={styles.expiryRow}>
        {expiryOptions.map((option) => (
          <Pressable
            key={option.label}
            {...testProps(option.label)}
            style={[
              styles.expiryPill,
              option.value === expireInDays && styles.expiryPillSelected,
            ]}
            onPress={() => setExpireInDays(option.value)}
          >
            <Text
              type="p2"
              color={option.value === expireInDays ? colors.primary : colors.grey1}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {hasError && (
        <View style={styles.errorContainer}>
          <GaloyErrorBox errorMessage={LL.ApiScreen.createError()} />
        </View>
      )}

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          {...testProps(LL.ApiScreen.createKey())}
          title={LL.ApiScreen.createKey()}
          disabled={!canSubmit}
          loading={loading}
          onPress={createApiKey}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    flexGrow: 1,
  },
  scopeCard: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 14,
    rowGap: 4,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    paddingVertical: 12,
  },
  scopeText: {
    flex: 1,
    rowGap: 2,
  },
  footnote: {
    marginTop: 8,
    marginHorizontal: 4,
  },
  expiryLabel: {
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  expiryRow: {
    flexDirection: "row",
    columnGap: 10,
  },
  expiryPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.grey5,
  },
  expiryPillSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  errorContainer: {
    marginTop: 16,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginTop: 32,
    paddingBottom: 20,
  },
}))
