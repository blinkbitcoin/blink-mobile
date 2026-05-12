import React, { useMemo, useState } from "react"
import { Pressable, ScrollView, TextInput, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import Animated from "react-native-reanimated"
import Svg, { Line } from "react-native-svg"

import { useDashedLineFlow } from "@app/components/animations"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { InputField } from "@app/components/card-screen/input-field"
import { Screen } from "@app/components/screen"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"

import {
  type ManualBudgetConfig,
  useCreateNwcConnection,
  useNewConnection,
} from "./hooks"
import { NwcConnectionCreateErrorCode } from "./nwc-service"
import { NwcBudgetPeriod } from "./nwc-types"

const AnimatedLine = Animated.createAnimatedComponent(Line)

export const NwcNewConnectionFormScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { createManualNwcConnection, loading: isCreating } = useCreateNwcConnection()
  const {
    appName,
    setAppName,
    budgetConfigs,
    budgetsForCreate,
    enabledBudgetCount,
    permissions,
    permissionToggles,
    isValid,
    setBudgetAmount,
    setBudgetEnabled,
    setPermissionEnabled,
  } = useNewConnection()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { animatedProps: animatedLineProps, dashArray } = useDashedLineFlow()
  const [createError, setCreateError] = useState<string | undefined>()
  const [isBudgetExpanded, setIsBudgetExpanded] = useState(false)

  const formatSatsDisplay = (value: string) =>
    formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(Number(value) || 0) })

  const budgetSummary = useMemo(
    () =>
      enabledBudgetCount === 0
        ? LL.NostrWalletConnect.noBudgetLimits()
        : LL.NostrWalletConnect.budgetLimitsSet({ count: enabledBudgetCount }),
    [LL, enabledBudgetCount],
  )

  const handleConnect = async () => {
    setCreateError(undefined)

    const result = await createManualNwcConnection({
      appName,
      budgets: budgetsForCreate,
      permissions,
    })

    if (result.errors.length > 0 || !result.connectionUri || !result.connection) {
      const firstError = result.errors[0]
      setCreateError(
        firstError
          ? createConnectionErrorMessage(firstError.code, LL, firstError.message)
          : LL.NostrWalletConnect.connectionCreateFailed(),
      )
      return
    }

    navigation.navigate("nwcConnectionCreated", {
      connectionString: result.connectionUri,
      appName: result.connection.appName,
    })
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.indicatorRow}>
          <GaloyIcon name="blink-bitcoin-circle" size={52} color={colors.black} />
          <View style={styles.lineContainer}>
            <Svg height={1} width="100%">
              <AnimatedLine
                x1="0"
                y1="0.5"
                x2="100%"
                y2="0.5"
                stroke={colors.grey2}
                strokeWidth={1}
                strokeDasharray={dashArray}
                animatedProps={animatedLineProps}
              />
            </Svg>
            <View style={styles.chainCircle}>
              <GaloyIcon name="chain" size={11} color={colors.grey2} />
            </View>
          </View>
          <GaloyIcon name="app-grid-circle" size={52} color={colors.grey5} />
        </View>

        <InputField
          label={LL.NostrWalletConnect.appNameLabel()}
          value={appName}
          onChangeText={setAppName}
          placeholder={LL.NostrWalletConnect.appNamePlaceholder()}
          rightIcon="pencil"
        />

        <View style={styles.budgetSection}>
          <Pressable
            style={styles.budgetTrigger}
            onPress={() => setIsBudgetExpanded((current) => !current)}
            accessibilityRole="button"
          >
            <GaloyIcon
              name={isBudgetExpanded ? "caret-up" : "caret-down"}
              size={18}
              color={colors.black}
            />
            <View style={styles.budgetTriggerTextContainer}>
              <Text style={styles.budgetTriggerText}>
                {LL.NostrWalletConnect.setBudget()}
              </Text>
              <Text style={styles.budgetTriggerSummary}>{budgetSummary}</Text>
            </View>
          </Pressable>

          {isBudgetExpanded && (
            <View style={styles.budgetRows}>
              {budgetConfigs.map((budget) => (
                <BudgetLimitRow
                  key={budget.period}
                  budget={budget}
                  label={budgetPeriodLabel(budget.period, LL)}
                  formatSatsDisplay={formatSatsDisplay}
                  onToggle={(enabled) => setBudgetEnabled(budget.period, enabled)}
                  onChangeAmount={(value) => setBudgetAmount(budget.period, value)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.permissionSection}>
          <Text style={styles.fieldLabel}>{LL.NostrWalletConnect.permissions()}</Text>
          <PermissionToggleRow
            label={LL.NostrWalletConnect.permissionReceiveOnly()}
            enabled={permissionToggles.receiveOnly}
            onChange={(enabled) => setPermissionEnabled("receiveOnly", enabled)}
          />
          <PermissionToggleRow
            label={LL.NostrWalletConnect.permissionReadHistory()}
            enabled={permissionToggles.readHistory}
            onChange={(enabled) => setPermissionEnabled("readHistory", enabled)}
          />
          <PermissionToggleRow
            label={LL.NostrWalletConnect.permissionMakePayments()}
            enabled={permissionToggles.makePayments}
            onChange={(enabled) => setPermissionEnabled("makePayments", enabled)}
          />
        </View>

        {createError && <GaloyErrorBox errorMessage={createError} />}
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.NostrWalletConnect.connectWallet()}
          disabled={!isValid || isCreating}
          loading={isCreating}
          onPress={handleConnect}
        />
      </View>
    </Screen>
  )
}

const BudgetLimitRow: React.FC<{
  budget: ManualBudgetConfig
  label: string
  formatSatsDisplay: (value: string) => string
  onToggle: (enabled: boolean) => void
  onChangeAmount: (value: string) => void
}> = ({ budget, label, formatSatsDisplay, onToggle, onChangeAmount }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const displayAmount =
    budget.amountSatsText.length > 0 ? formatSatsDisplay(budget.amountSatsText) : ""

  return (
    <View style={styles.budgetCard}>
      <View style={styles.optionRow}>
        <Text style={styles.optionText}>{label}</Text>
        <Toggle enabled={budget.enabled} onChange={onToggle} />
      </View>
      {budget.enabled && (
        <View style={styles.budgetAmountRow}>
          <TextInput
            value={budget.amountSatsText}
            onChangeText={onChangeAmount}
            placeholder="0"
            placeholderTextColor={colors.grey3}
            keyboardType="number-pad"
            selectionColor={colors.primary}
            style={styles.budgetAmountInput}
            accessibilityLabel={label}
          />
          <Text style={styles.budgetAmountPreview}>{displayAmount}</Text>
        </View>
      )}
    </View>
  )
}

const PermissionToggleRow: React.FC<{
  label: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}> = ({ label, enabled, onChange }) => {
  const styles = useStyles()

  return (
    <View style={styles.permissionCard}>
      <Text style={styles.optionText}>{label}</Text>
      <Toggle enabled={enabled} onChange={onChange} />
    </View>
  )
}

const Toggle: React.FC<{
  enabled: boolean
  onChange: (enabled: boolean) => void
}> = ({ enabled, onChange }) => {
  const styles = useStyles()

  return (
    <Pressable
      style={[styles.toggleTrack, enabled && styles.toggleTrackEnabled]}
      onPress={() => onChange(!enabled)}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      hitSlop={8}
    >
      <View style={[styles.toggleThumb, enabled && styles.toggleThumbEnabled]} />
    </Pressable>
  )
}

const budgetPeriodLabel = (
  period: NwcBudgetPeriod,
  LL: ReturnType<typeof useI18nContext>["LL"],
) =>
  ({
    DAILY: LL.NostrWalletConnect.periodDaily(),
    WEEKLY: LL.NostrWalletConnect.periodWeekly(),
    MONTHLY: LL.NostrWalletConnect.periodMonthly(),
    NEVER: LL.NostrWalletConnect.periodAnnually(),
  })[period]

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
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    width: 213,
    alignSelf: "center",
  },
  lineContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chainCircle: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetSection: {
    gap: 8,
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  budgetTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 8,
    alignSelf: "center",
  },
  budgetTriggerTextContainer: {
    alignItems: "center",
  },
  budgetTriggerText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.black,
  },
  budgetTriggerSummary: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "400",
    color: colors.grey2,
  },
  budgetRows: {
    width: "100%",
    gap: 8,
  },
  budgetCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  budgetAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 12,
  },
  budgetAmountInput: {
    flex: 1,
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  budgetAmountPreview: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 20,
  },
  permissionSection: {
    gap: 8,
  },
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  optionText: {
    flex: 1,
    color: colors.black,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  toggleTrack: {
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.grey3,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleTrackEnabled: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors._white,
  },
  toggleThumbEnabled: {
    alignSelf: "flex-end",
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
