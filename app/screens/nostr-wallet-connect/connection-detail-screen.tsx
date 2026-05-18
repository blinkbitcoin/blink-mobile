import React, { useState } from "react"
import { ActivityIndicator, DimensionValue, ScrollView, View } from "react-native"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { Screen } from "@app/components/screen"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { formatUnixTimestampYMDHM } from "@app/utils/date"

import {
  getNwcConnectionStatus,
  useNwcConnectionQuery,
  useNwcConnectionRevoke,
  type NwcConnectionStatus,
  type NwcManagedBudget,
} from "./hooks"
import type { NwcBudgetPeriod, NwcGraphqlPermission } from "./nwc-types"

export const NwcConnectionDetailScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "nwcConnectionDetail">>()
  const { connection, error, loading, refresh } = useNwcConnectionQuery(
    route.params.connectionId,
  )
  const { revokeConnection, loading: isRevoking } = useNwcConnectionRevoke()
  const [revokeVisible, setRevokeVisible] = useState(false)
  const [mutationError, setMutationError] = useState<string | undefined>()
  const { formatMoneyAmount } = useDisplayCurrency()

  const status = connection ? getNwcConnectionStatus(connection) : undefined

  const handleRevoke = async () => {
    if (!connection) return
    setMutationError(undefined)

    const result = await revokeConnection(connection.id)

    if (!result.success) {
      setRevokeVisible(false)
      setMutationError(result.errors[0]?.message ?? LL.NostrWalletConnect.revokeFailed())
      return
    }

    setRevokeVisible(false)
    navigation.navigate("nwcConnectedApps")
  }

  if (loading && !connection) {
    return (
      <Screen preset="fixed">
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  if (!connection) {
    return (
      <Screen preset="fixed">
        <View style={styles.errorContainer}>
          <GaloyErrorBox
            errorMessage={
              error
                ? LL.NostrWalletConnect.connectedAppsLoadError()
                : LL.NostrWalletConnect.connectionDetailsUnavailable()
            }
          />
          <GaloySecondaryButton title={LL.common.tryAgain()} onPress={refresh} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <GaloyIcon name="link" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
              {connection.appName}
            </Text>
            {status && <StatusLine status={status} />}
          </View>
        </View>

        {mutationError && <GaloyErrorBox errorMessage={mutationError} />}

        <Section title={LL.NostrWalletConnect.connectionDetails()}>
          <InfoRow
            icon="calendar"
            label={LL.NostrWalletConnect.createdDate()}
            value={formatUnixTimestampYMDHM(connection.createdAt)}
          />
          <InfoRow
            icon="refresh"
            label={LL.NostrWalletConnect.lastUsedDate()}
            value={
              connection.lastUsedAt
                ? formatUnixTimestampYMDHM(connection.lastUsedAt)
                : LL.NostrWalletConnect.neverUsed()
            }
          />
          <InfoRow
            icon="warning-circle"
            label={LL.NostrWalletConnect.expirationDate()}
            value={
              connection.expiresAt
                ? formatUnixTimestampYMDHM(connection.expiresAt)
                : LL.NostrWalletConnect.noExpiration()
            }
          />
          <InfoRow
            icon="key-outline"
            label={LL.NostrWalletConnect.appPubkey()}
            value={connection.appPubkey}
            mono
          />
        </Section>

        <Section title={LL.NostrWalletConnect.permissions()}>
          {connection.permissions.map((permission) => (
            <PermissionRow key={permission} permission={permission} />
          ))}
        </Section>

        {connection.budgets.length > 0 && (
          <Section title={LL.NostrWalletConnect.budgetLimits()}>
            {connection.budgets.map((budget) => (
              <BudgetUsageCard
                key={budget.period}
                budget={budget}
                formatMoneyAmount={formatMoneyAmount}
              />
            ))}
          </Section>
        )}
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.NostrWalletConnect.revokeConnection()}
          onPress={() => setRevokeVisible(true)}
          buttonStyle={styles.revokeButton}
          titleStyle={styles.revokeButtonTitle}
        />
      </View>

      <CustomModal
        isVisible={revokeVisible}
        toggleModal={() => setRevokeVisible(false)}
        image={<GaloyIcon name="warning-circle" size={52} color={colors.red} />}
        title={LL.NostrWalletConnect.revokeConfirmTitle()}
        body={
          <Text style={styles.modalBody}>
            {LL.NostrWalletConnect.revokeConfirmBody({
              appName: connection.appName,
            })}
          </Text>
        }
        primaryButtonTitle={LL.common.cancel()}
        primaryButtonOnPress={() => setRevokeVisible(false)}
        primaryButtonDisabled={isRevoking}
        secondaryButtonTitle={LL.NostrWalletConnect.revokeConnection()}
        secondaryButtonOnPress={handleRevoke}
        secondaryButtonLoading={isRevoking}
      />
    </Screen>
  )
}

const Section: React.FC<React.PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => {
  const styles = useStyles()

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

const InfoRow: React.FC<{
  icon: React.ComponentProps<typeof GaloyIcon>["name"]
  label: string
  value: string
  mono?: boolean
}> = ({ icon, label, value, mono }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.detailRow}>
      <GaloyIcon name={icon} size={18} color={colors.grey2} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text
          style={[styles.detailValue, mono && styles.monoValue]}
          numberOfLines={mono ? 2 : 1}
          ellipsizeMode="middle"
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

const PermissionRow: React.FC<{ permission: NwcGraphqlPermission }> = ({
  permission,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.detailRow}>
      <GaloyIcon name="check-circle" size={18} color={colors._green} />
      <Text style={styles.permissionText}>{graphqlPermissionLabel(permission, LL)}</Text>
    </View>
  )
}

const BudgetUsageCard: React.FC<{
  budget: NwcManagedBudget
  formatMoneyAmount: ReturnType<typeof useDisplayCurrency>["formatMoneyAmount"]
}> = ({ budget, formatMoneyAmount }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const usageRatio = budget.amountSats > 0 ? budget.usedSats / budget.amountSats : 0
  const progressPercent = `${
    Math.min(Math.max(usageRatio, 0), 1) * 100
  }%` as DimensionValue
  const amount = formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(budget.amountSats) })
  const used = formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(budget.usedSats) })
  const remaining = formatMoneyAmount({
    moneyAmount: toBtcMoneyAmount(budget.remainingSats),
  })

  return (
    <View style={styles.budgetCard}>
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetPeriod}>{budgetPeriodLabel(budget.period, LL)}</Text>
        <Text style={styles.budgetAmount}>{amount}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressPercent }]} />
      </View>
      <Text style={styles.budgetUsage}>
        {LL.NostrWalletConnect.budgetUsage({ used, amount })}
      </Text>
      <Text style={styles.budgetMeta}>
        {LL.NostrWalletConnect.budgetRemaining({ amount: remaining })}
      </Text>
      {budget.resetsAt && (
        <Text style={styles.budgetMeta}>
          {LL.NostrWalletConnect.budgetResetsAt({
            date: formatUnixTimestampYMDHM(budget.resetsAt),
          })}
        </Text>
      )}
    </View>
  )
}

const StatusLine: React.FC<{ status: NwcConnectionStatus }> = ({ status }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const statusLabel = {
    active: LL.NostrWalletConnect.statusActive(),
    expired: LL.NostrWalletConnect.statusExpired(),
    revoked: LL.NostrWalletConnect.statusRevoked(),
  }[status]
  const statusColor = {
    active: colors._green,
    expired: colors.warning,
    revoked: colors.grey2,
  }[status]

  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
    </View>
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
    ANNUAL: LL.NostrWalletConnect.periodAnnually(),
  })[period]

const graphqlPermissionLabel = (
  permission: NwcGraphqlPermission,
  LL: ReturnType<typeof useI18nContext>["LL"],
) =>
  ({
    GET_INFO: LL.NostrWalletConnect.permissionGetInfo(),
    GET_BALANCE: LL.NostrWalletConnect.permissionGetBalance(),
    MAKE_INVOICE: LL.NostrWalletConnect.permissionMakeInvoice(),
    PAY_INVOICE: LL.NostrWalletConnect.permissionPayInvoice(),
    LOOKUP_INVOICE: LL.NostrWalletConnect.permissionLookupInvoice(),
    LIST_TRANSACTIONS: LL.NostrWalletConnect.permissionListTransactions(),
    NOTIFICATIONS_PAYMENT_SENT:
      LL.NostrWalletConnect.permissionNotificationsPaymentSent(),
    NOTIFICATIONS_PAYMENT_RECEIVED:
      LL.NostrWalletConnect.permissionNotificationsPaymentReceived(),
  })[permission]

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.black,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.black,
  },
  sectionCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  detailText: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.grey2,
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  monoValue: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 17,
  },
  permissionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  budgetCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  budgetPeriod: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.black,
  },
  budgetAmount: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.grey4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  budgetUsage: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.black,
  },
  budgetMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.grey2,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  revokeButton: {
    minHeight: 50,
    backgroundColor: colors.red,
  },
  revokeButtonTitle: {
    color: colors._white,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
}))
