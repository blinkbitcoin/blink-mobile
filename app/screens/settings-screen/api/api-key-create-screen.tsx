import * as React from "react"
import { View } from "react-native"

import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { InputField, SwitchRow } from "@app/components/card-screen"
import { PercentageSelector } from "@app/components/percentage-selector"
import { Screen } from "@app/components/screen"
import { ApiKeysDocument, Scope, useApiKeyCreateMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { SettingsGroup } from "../group"
import { ApiKeySecretReveal } from "./api-key-secret-reveal"

const MAX_KEY_NAME_LENGTH = 64

/** The expiry chips take numbers, so "never" rides as 0 and goes out as null. */
const NEVER_EXPIRES = 0
const EXPIRY_OPTIONS = [30, 90, NEVER_EXPIRES] as const
const DEFAULT_EXPIRY = 90

export const ApiKeyCreateScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [name, setName] = React.useState("")
  const [readEnabled, setReadEnabled] = React.useState(true)
  const [receiveEnabled, setReceiveEnabled] = React.useState(true)
  const [expireInDays, setExpireInDays] = React.useState<number>(DEFAULT_EXPIRY)
  const [secret, setSecret] = React.useState<string | null>(null)
  const [hasError, setHasError] = React.useState(false)

  const [apiKeyCreate, { loading }] = useApiKeyCreateMutation({
    refetchQueries: [{ query: ApiKeysDocument }],
  })

  const expiryLabel = (days: number) => {
    if (days === NEVER_EXPIRES) return LL.ApiScreen.expiryNever()
    return days === 30 ? LL.ApiScreen.expiry30Days() : LL.ApiScreen.expiry90Days()
  }

  const hasName = name.trim().length > 0
  const hasScope = readEnabled || receiveEnabled
  const canSubmit = hasName && hasScope && !loading

  const createApiKey = async () => {
    setHasError(false)
    const scopes: Scope[] = [
      ...(readEnabled ? [Scope.Read] : []),
      ...(receiveEnabled ? [Scope.Receive] : []),
    ]
    try {
      const { data } = await apiKeyCreate({
        variables: {
          input: {
            name: name.trim(),
            scopes,
            expireInDays: expireInDays === NEVER_EXPIRES ? null : expireInDays,
          },
        },
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
      <View style={styles.body}>
        <InputField
          testID="api-key-name"
          label={LL.ApiScreen.keyName()}
          placeholder={LL.ApiScreen.keyNamePlaceholder()}
          rightIcon="pencil"
          valueStyle="regular"
          maxLength={MAX_KEY_NAME_LENGTH}
          reserveHelperLine={false}
          value={name}
          onChangeText={setName}
        />

        <SettingsGroup
          containerStyle={styles.scopeCard}
          items={[
            () => (
              <SwitchRow
                title={LL.ApiScreen.scopeRead()}
                description={LL.ApiScreen.scopeReadDescription()}
                value={readEnabled}
                onValueChange={setReadEnabled}
              />
            ),
            () => (
              <SwitchRow
                title={LL.ApiScreen.scopeReceive()}
                description={LL.ApiScreen.scopeReceiveDescription()}
                value={receiveEnabled}
                onValueChange={setReceiveEnabled}
              />
            ),
          ]}
        />
        <Text type="p3" color={colors.grey2}>
          {LL.ApiScreen.writeScopeDashboardOnly()}
        </Text>

        <View style={styles.expiry}>
          <Text type="p3">{LL.ApiScreen.expiry()}</Text>
          <PercentageSelector
            testIdPrefix="api-key-expiry"
            options={EXPIRY_OPTIONS}
            selectedPercent={expireInDays}
            onSelect={setExpireInDays}
            formatLabel={expiryLabel}
            isLocked={loading}
            loadingPercent={null}
            containerStyle={styles.expiryOptions}
          />
        </View>

        {hasError && <GaloyErrorBox errorMessage={LL.ApiScreen.createError()} />}
      </View>

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

const useStyles = makeStyles(() => ({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
  },
  body: {
    rowGap: 20,
  },
  scopeCard: {
    marginTop: 0,
    borderRadius: 8,
  },
  expiry: {
    rowGap: 5,
  },
  expiryOptions: {
    justifyContent: "flex-start",
    columnGap: 10,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginTop: 32,
  },
}))
