import React, { useEffect, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"

import { useApolloClient } from "@apollo/client"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { parse } from "graphql"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { DropdownComponent } from "@app/components/card-screen/dropdown"
import { InputField } from "@app/components/card-screen/input-field"
import { Screen } from "@app/components/screen"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { ellipsizeMiddle } from "@app/utils/helper"

import { useCreateNwcConnection, useNwcBtcBalance } from "./hooks"
import {
  buildNwcConnectionCreateInput,
  NwcConnectionCreateError,
  NwcConnectionCreateErrorCode,
} from "./nwc-service"
import {
  NwcBudgetPeriod,
  NWC_BUDGET_PERIODS,
  NwcGraphqlPermission,
  NwcPermission,
} from "./nwc-types"
import { NwcUriError, parseNwcUri } from "./nwc-uri"

const DEFAULT_AUTH_BUDGET = "10000"

const NWC_KNOWN_APP_QUERY = parse(`
  query NwcKnownAppForAuthorization($pubkey: String!) {
    nwcKnownApp(pubkey: $pubkey) {
      name
    }
  }
`)

type NwcKnownAppQueryData = {
  nwcKnownApp?: {
    name: string
  } | null
}

const usePermissionLabel = () => {
  const { LL } = useI18nContext()

  return useMemo(
    () =>
      new Map<NwcPermission, string>([
        ["get_info", LL.NostrWalletConnect.permissionGetInfo()],
        ["get_balance", LL.NostrWalletConnect.permissionGetBalance()],
        ["make_invoice", LL.NostrWalletConnect.permissionMakeInvoice()],
        ["pay_invoice", LL.NostrWalletConnect.permissionPayInvoice()],
        ["lookup_invoice", LL.NostrWalletConnect.permissionLookupInvoice()],
        ["list_transactions", LL.NostrWalletConnect.permissionListTransactions()],
        [
          "notifications:payment_sent",
          LL.NostrWalletConnect.permissionNotificationsPaymentSent(),
        ],
        [
          "notifications:payment_received",
          LL.NostrWalletConnect.permissionNotificationsPaymentReceived(),
        ],
      ]),
    [LL],
  )
}

const useKnownNwcAppName = (pubkey: string | undefined) => {
  const client = useApolloClient()
  const [knownAppName, setKnownAppName] = useState<string | undefined>()

  useEffect(() => {
    if (!pubkey) {
      setKnownAppName(undefined)
      return
    }

    let active = true
    client
      .query<NwcKnownAppQueryData>({
        query: NWC_KNOWN_APP_QUERY,
        variables: { pubkey },
        fetchPolicy: "cache-first",
        errorPolicy: "all",
      })
      .then((result) => {
        if (active) setKnownAppName(result.data?.nwcKnownApp?.name ?? undefined)
      })
      .catch(() => {
        if (active) setKnownAppName(undefined)
      })

    return () => {
      active = false
    }
  }, [client, pubkey])

  return knownAppName
}

export const NwcAuthorizationScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "nwcAuthorization">>()
  const { createNwcConnection, loading: isCreating } = useCreateNwcConnection()
  const { formatMoneyAmount } = useDisplayCurrency()
  const permissionLabel = usePermissionLabel()
  const btcWalletBalance = useNwcBtcBalance()

  const [budgetSatsText, setBudgetSatsText] = useState(DEFAULT_AUTH_BUDGET)
  const [budgetPeriod, setBudgetPeriod] = useState<NwcBudgetPeriod>("WEEKLY")
  const [createError, setCreateError] = useState<NwcConnectionCreateError | undefined>()

  const parsed = useMemo(() => parseNwcUri(route.params.uri), [route.params.uri])
  const knownAppName = useKnownNwcAppName(
    parsed.valid && !parsed.appName ? parsed.serverPubkey : undefined,
  )
  const budgetSats = Number(budgetSatsText) || 0
  const hasPayInvoicePermission =
    parsed.valid && parsed.permissions.includes("pay_invoice")
  const canAuthorize = parsed.valid && (!hasPayInvoicePermission || budgetSats > 0)
  const exceedsWalletBalance =
    hasPayInvoicePermission &&
    btcWalletBalance !== undefined &&
    budgetSats > btcWalletBalance

  const budgetPeriodOptions = useMemo(
    () =>
      NWC_BUDGET_PERIODS.map((period) => ({
        value: period,
        label: {
          DAILY: LL.NostrWalletConnect.periodDaily(),
          WEEKLY: LL.NostrWalletConnect.periodWeekly(),
          MONTHLY: LL.NostrWalletConnect.periodMonthly(),
          NEVER: LL.NostrWalletConnect.periodNever(),
        }[period],
      })),
    [LL],
  )

  const formatSatsDisplay = (value: string) =>
    formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(Number(value) || 0) })

  const formatBudgetPeriod = (period: NwcBudgetPeriod) =>
    ({
      DAILY: LL.NostrWalletConnect.periodDaily(),
      WEEKLY: LL.NostrWalletConnect.periodWeekly(),
      MONTHLY: LL.NostrWalletConnect.periodMonthly(),
      NEVER: LL.NostrWalletConnect.periodNever(),
    })[period]

  const appName = parsed.valid
    ? parsed.appName ??
      knownAppName ??
      ellipsizeMiddle(parsed.serverPubkey, {
        maxLength: 28,
        maxResultLeft: 12,
        maxResultRight: 8,
      })
    : ""

  const createErrorMessage = createError
    ? createConnectionErrorMessage(createError.code, LL, createError.message)
    : undefined

  const budgetPreview =
    hasPayInvoicePermission && budgetSats > 0
      ? LL.NostrWalletConnect.budgetPreview({
          amount: formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(budgetSats) }),
          period: formatBudgetPeriod(budgetPeriod),
        })
      : undefined

  const handleCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }

    navigation.navigate("Primary")
  }

  const authorizeConnection = async ({ replaceExisting = false } = {}) => {
    if (!parsed.valid) return

    setCreateError(undefined)

    const createInput = buildNwcConnectionCreateInput({
      parsedUri: parsed,
      alias: appName,
      budgetSats,
      budgetPeriod,
    })
    const result = await createNwcConnection({
      ...createInput,
      appName,
      appPubkey: parsed.serverPubkey,
      replaceExisting,
    })

    if (result.errors.length > 0 || !result.connectionUri || !result.connection) {
      const firstError = result.errors[0]
      setCreateError(firstError)
      return
    }

    navigation.navigate("nwcConnectionCreated", {
      connectionString: result.connectionUri,
      appName: result.connection.appName,
      successMode: "authorization",
      permissions: createInput.permissions as ReadonlyArray<NwcGraphqlPermission>,
      budgets: createInput.budgets,
      returnUrl: parsed.returnUrl,
    })
  }

  const handleAuthorize = () => authorizeConnection()
  const handleReplaceConnection = () => authorizeConnection({ replaceExisting: true })

  if (!parsed.valid) {
    return (
      <Screen preset="fixed">
        <View style={styles.errorBody}>
          <GaloyIcon name="warning-circle" size={52} color={colors.primary} />
          <Text style={styles.errorTitle}>
            {LL.NostrWalletConnect.invalidConnectionRequest()}
          </Text>
          <Text style={styles.errorMessage}>{errorMessage(parsed.error, LL)}</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloySecondaryButton title={LL.common.cancel()} onPress={handleCancel} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>
          {LL.NostrWalletConnect.authorizationAppTitle({ appName })}
        </Text>

        <InputField
          label={LL.NostrWalletConnect.appIdentifier()}
          value={appName}
          valueStyle="regular"
        />

        <PermissionSection title={LL.NostrWalletConnect.willBeAbleTo()}>
          {parsed.permissions.map((permission) => (
            <PermissionRow
              key={permission}
              iconName="check-circle"
              iconColor={colors._green}
              label={permissionLabel.get(permission)!}
            />
          ))}
        </PermissionSection>

        <PermissionSection title={LL.NostrWalletConnect.willNotBeAbleTo()}>
          <PermissionRow
            iconName="close"
            iconColor={colors.red}
            label={LL.NostrWalletConnect.permissionNoKeys()}
          />
          <PermissionRow
            iconName="close"
            iconColor={colors.red}
            label={LL.NostrWalletConnect.permissionNoSecurityChanges()}
          />
          {hasPayInvoicePermission && (
            <PermissionRow
              iconName="close"
              iconColor={colors.red}
              label={LL.NostrWalletConnect.permissionNoOverBudget()}
            />
          )}
        </PermissionSection>

        {hasPayInvoicePermission && (
          <>
            <InputField
              label={LL.NostrWalletConnect.budgetAmount()}
              value={budgetSatsText}
              onChangeText={(value) => setBudgetSatsText(value.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              rightIcon="pencil"
              formatDisplay={formatSatsDisplay}
            />
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {LL.NostrWalletConnect.budgetPeriod()}
              </Text>
              <DropdownComponent
                options={budgetPeriodOptions}
                selectedValue={budgetPeriod}
                onValueChange={(value) => setBudgetPeriod(value as NwcBudgetPeriod)}
              />
            </View>
            {exceedsWalletBalance && (
              <Text style={styles.warningText}>
                {LL.NostrWalletConnect.budgetExceedsBalanceWarning()}
              </Text>
            )}
            {budgetPreview && <Text style={styles.budgetPreview}>{budgetPreview}</Text>}
          </>
        )}

        {createErrorMessage && <GaloyErrorBox errorMessage={createErrorMessage} />}
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.NostrWalletConnect.authorize()}
          disabled={!canAuthorize || isCreating}
          loading={isCreating}
          onPress={handleAuthorize}
        />
        {createError?.retryable && (
          <GaloySecondaryButton
            title={LL.NostrWalletConnect.retry()}
            loading={isCreating}
            onPress={handleAuthorize}
          />
        )}
        {createError?.replaceable && (
          <GaloySecondaryButton
            title={LL.NostrWalletConnect.replaceConnection()}
            loading={isCreating}
            onPress={handleReplaceConnection}
          />
        )}
        <GaloySecondaryButton title={LL.common.cancel()} onPress={handleCancel} />
      </View>
    </Screen>
  )
}

const PermissionSection: React.FC<React.PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => {
  const styles = useStyles()

  return (
    <View style={styles.permissionSection}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.permissionRows}>{children}</View>
    </View>
  )
}

const PermissionRow: React.FC<{
  iconName: "check-circle" | "close"
  iconColor: string
  label: string
}> = ({ iconName, iconColor, label }) => {
  const styles = useStyles()

  return (
    <View style={styles.permissionRow}>
      <GaloyIcon name={iconName} size={18} color={iconColor} />
      <Text style={styles.permissionText}>{label}</Text>
    </View>
  )
}

const errorMessage = (
  error: NwcUriError,
  LL: ReturnType<typeof useI18nContext>["LL"],
) => {
  switch (error) {
    case "invalid-scheme":
    case "invalid-uri":
      return LL.NostrWalletConnect.invalidNwcUri()
    case "invalid-pubkey":
      return LL.NostrWalletConnect.invalidNwcPubkey()
    case "missing-relay":
      return LL.NostrWalletConnect.missingNwcRelay()
    case "invalid-relay":
      return LL.NostrWalletConnect.invalidNwcRelay()
    case "missing-secret":
      return LL.NostrWalletConnect.missingNwcSecret()
    case "unsupported-permissions":
      return LL.NostrWalletConnect.unsupportedNwcPermissions()
  }
}

const createConnectionErrorMessage = (
  errorCode: NwcConnectionCreateErrorCode,
  LL: ReturnType<typeof useI18nContext>["LL"],
  fallbackMessage?: string,
) => {
  switch (errorCode) {
    case "DUPLICATE_CONNECTION":
      return LL.NostrWalletConnect.connectionAlreadyExists()
    case "NETWORK_ERROR":
      if (__DEV__ && fallbackMessage) return fallbackMessage
      return LL.NostrWalletConnect.connectionNetworkError()
    case "RELAY_UNREACHABLE":
      if (__DEV__ && fallbackMessage) return fallbackMessage
      return LL.NostrWalletConnect.connectionRelayUnreachable()
    case "UNSUPPORTED_PERMISSIONS":
      return LL.NostrWalletConnect.unsupportedNwcPermissions()
    case "UNKNOWN_ERROR":
      if (__DEV__ && fallbackMessage) return fallbackMessage
      return LL.NostrWalletConnect.connectionCreateFailed()
  }
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.black,
    paddingTop: 20,
  },
  fieldGroup: {
    gap: 3,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  permissionSection: {
    gap: 3,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  permissionRows: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
  },
  permissionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  errorBody: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.black,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    textAlign: "center",
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
  },
  budgetPreview: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
    gap: 10,
  },
}))
