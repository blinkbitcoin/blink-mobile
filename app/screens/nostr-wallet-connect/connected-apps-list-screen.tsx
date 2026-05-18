import React, { useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native"

import { useNavigation } from "@react-navigation/native"
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
  useNwcConnectionsQuery,
  useNwcConnectionsRevokeAll,
  type NwcConnectionStatus,
  type NwcManagedConnection,
} from "./hooks"
import { NwcBudgetPeriod } from "./nwc-types"

const REVOKE_ALL_CONFIRMATION = "REVOKE"

export const NwcConnectedAppsListScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { connections, error, loading, refreshing, refresh } = useNwcConnectionsQuery()
  const { revokeAllConnections, loading: isRevokingAll } = useNwcConnectionsRevokeAll()
  const [revokeAllVisible, setRevokeAllVisible] = useState(false)
  const [revokeAllConfirmation, setRevokeAllConfirmation] = useState("")
  const [mutationError, setMutationError] = useState<string | undefined>()
  const [successMessage, setSuccessMessage] = useState<string | undefined>()

  const hasConnections = connections.length > 0
  const showInitialLoading = loading && !hasConnections

  const handleOpenRevokeAll = () => {
    setMutationError(undefined)
    setSuccessMessage(undefined)
    setRevokeAllConfirmation("")
    setRevokeAllVisible(true)
  }

  const handleRevokeAll = async () => {
    setMutationError(undefined)
    const result = await revokeAllConnections()

    if (!result.success) {
      setMutationError(
        result.errors[0]?.message ?? LL.NostrWalletConnect.revokeAllFailed(),
      )
      return
    }

    setRevokeAllVisible(false)
    setSuccessMessage(
      LL.NostrWalletConnect.revokeAllSuccess({ count: result.revokedCount }),
    )
    await refresh()
  }

  const renderConnection = ({ item }: { item: NwcManagedConnection }) => (
    <ConnectionRow
      connection={item}
      formatMoneyAmount={formatMoneyAmount}
      onPress={() =>
        navigation.navigate("nwcConnectionDetail", { connectionId: item.id })
      }
    />
  )

  const listEmpty = showInitialLoading ? (
    <View style={styles.centerState}>
      <ActivityIndicator color={colors.primary} />
    </View>
  ) : (
    <View style={styles.emptyState}>
      <GaloyIcon name="link" size={44} color={colors.primary} />
      <Text style={styles.emptyTitle}>
        {LL.NostrWalletConnect.connectedAppsEmptyTitle()}
      </Text>
      <Text style={styles.emptyBody}>
        {LL.NostrWalletConnect.connectedAppsEmptyBody()}
      </Text>
    </View>
  )

  return (
    <Screen preset="fixed">
      <FlatList
        data={connections}
        keyExtractor={(connection) => connection.id}
        renderItem={renderConnection}
        contentContainerStyle={styles.body}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.screenTitle}>
              {LL.NostrWalletConnect.connectedApps()}
            </Text>
            {error && (
              <GaloyErrorBox
                errorMessage={LL.NostrWalletConnect.connectedAppsLoadError()}
              />
            )}
            {mutationError && <GaloyErrorBox errorMessage={mutationError} />}
            {successMessage && <Text style={styles.successText}>{successMessage}</Text>}
          </View>
        }
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          <View style={styles.footer}>
            <GaloyPrimaryButton
              title={LL.NostrWalletConnect.newConnection()}
              onPress={() => navigation.navigate("nwcNewConnection")}
            />
            {hasConnections && (
              <GaloySecondaryButton
                title={LL.NostrWalletConnect.revokeAllConnections()}
                onPress={handleOpenRevokeAll}
                iconName="trash"
                titleStyle={styles.revokeAllButtonText}
              />
            )}
          </View>
        }
      />

      <CustomModal
        isVisible={revokeAllVisible}
        toggleModal={() => setRevokeAllVisible(false)}
        image={<GaloyIcon name="warning-circle" size={52} color={colors.red} />}
        title={LL.NostrWalletConnect.revokeAllConfirmTitle()}
        body={
          <View style={styles.revokeAllBody}>
            <Text style={styles.modalBody}>
              {LL.NostrWalletConnect.revokeAllConfirmBody()}
            </Text>
            <Text style={styles.confirmationLabel}>
              {LL.NostrWalletConnect.revokeAllTypeConfirm({
                confirmation: REVOKE_ALL_CONFIRMATION,
              })}
            </Text>
            <TextInput
              value={revokeAllConfirmation}
              onChangeText={setRevokeAllConfirmation}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={REVOKE_ALL_CONFIRMATION}
              placeholderTextColor={colors.grey3}
              style={styles.confirmationInput}
            />
          </View>
        }
        primaryButtonTitle={LL.NostrWalletConnect.revokeAllConnections()}
        primaryButtonOnPress={handleRevokeAll}
        primaryButtonLoading={isRevokingAll}
        primaryButtonDisabled={
          revokeAllConfirmation !== REVOKE_ALL_CONFIRMATION || isRevokingAll
        }
        secondaryButtonTitle={LL.common.cancel()}
        secondaryButtonOnPress={() => setRevokeAllVisible(false)}
      />
    </Screen>
  )
}

const ConnectionRow: React.FC<{
  connection: NwcManagedConnection
  formatMoneyAmount: ReturnType<typeof useDisplayCurrency>["formatMoneyAmount"]
  onPress: () => void
}> = ({ connection, formatMoneyAmount, onPress }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const status = getNwcConnectionStatus(connection)
  const lastUsedText = connection.lastUsedAt
    ? LL.NostrWalletConnect.lastUsed({
        date: formatUnixTimestampYMDHM(connection.lastUsedAt),
      })
    : LL.NostrWalletConnect.neverUsed()
  const budgetSummary = useMemo(
    () => formatBudgetSummary(connection, LL, formatMoneyAmount),
    [LL, connection, formatMoneyAmount],
  )

  return (
    <Pressable style={styles.connectionRow} onPress={onPress}>
      <View style={styles.connectionIcon}>
        <GaloyIcon name="link" size={20} color={colors.primary} />
      </View>
      <View style={styles.connectionContent}>
        <Text style={styles.connectionTitle} numberOfLines={1} ellipsizeMode="tail">
          {connection.appName}
        </Text>
        <Text style={styles.connectionSubtitle} numberOfLines={1} ellipsizeMode="tail">
          {lastUsedText}
        </Text>
        {budgetSummary && (
          <Text style={styles.connectionBudget} numberOfLines={1} ellipsizeMode="tail">
            {budgetSummary}
          </Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <ConnectionStatusBadge status={status} />
        <GaloyIcon name="caret-right" size={18} color={colors.grey2} />
      </View>
    </Pressable>
  )
}

const ConnectionStatusBadge: React.FC<{ status: NwcConnectionStatus }> = ({ status }) => {
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
    <View style={[styles.statusBadge, { borderColor: statusColor }]}>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
    </View>
  )
}

const formatBudgetSummary = (
  connection: NwcManagedConnection,
  LL: ReturnType<typeof useI18nContext>["LL"],
  formatMoneyAmount: ReturnType<typeof useDisplayCurrency>["formatMoneyAmount"],
) => {
  if (connection.budgets.length === 0) return undefined
  if (connection.budgets.length > 1) {
    return LL.NostrWalletConnect.budgetLimitsSet({
      count: connection.budgets.length,
    })
  }

  const budget = connection.budgets[0]
  return LL.NostrWalletConnect.budgetPreview({
    amount: formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(budget.amountSats) }),
    period: budgetPeriodLabel(budget.period, LL),
  })
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

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    flexGrow: 1,
  },
  header: {
    gap: 10,
  },
  screenTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.black,
  },
  centerState: {
    flex: 1,
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.black,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
    textAlign: "center",
  },
  separator: {
    height: 8,
  },
  connectionRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  connectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  connectionContent: {
    flex: 1,
    minWidth: 0,
  },
  connectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.black,
  },
  connectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.grey2,
  },
  connectionBudget: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.grey2,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  footer: {
    gap: 8,
    paddingTop: 12,
  },
  revokeAllButtonText: {
    color: colors.red,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
  revokeAllBody: {
    gap: 12,
  },
  confirmationLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.grey2,
    textAlign: "center",
  },
  confirmationInput: {
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "700",
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors._green,
  },
}))
