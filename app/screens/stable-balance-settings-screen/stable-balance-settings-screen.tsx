import React, { useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { Switch } from "@app/components/atomic/switch"
import { useI18nContext } from "@app/i18n/i18n-react"
import { logSelfCustodialStableBalanceActivated } from "@app/utils/analytics"
import {
  activateStableBalance,
  deactivateStableBalance,
} from "@app/self-custodial/bridge"
import { SparkToken } from "@app/self-custodial/config"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { WalletCurrency } from "@app/graphql/generated"
import { testProps } from "@app/utils/testProps"

import { StableBalanceConfirmModal } from "./stable-balance-confirm-modal"
import { useStableBalanceToggleQuote } from "./hooks"

const ToggleDirection = {
  Activate: "activate",
  Deactivate: "deactivate",
} as const
type ToggleDirection = (typeof ToggleDirection)[keyof typeof ToggleDirection]

const USD_CENTS_PER_DOLLAR = 100
const USD_FRACTION_DIGITS = 2

const SCREEN_TEST_ID = "stable-balance-settings-screen"
const SWITCH_TEST_ID = "stable-balance-switch"

export const StableBalanceSettingsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    sdk,
    isStableBalanceActive,
    wallets,
    refreshWallets,
    refreshStableBalanceActive,
  } = useSelfCustodialWallet()
  const [busy, setBusy] = useState(false)
  const [pendingValue, setPendingValue] = useState<boolean | null>(null)
  const [switchKey, setSwitchKey] = useState(0)
  const [pendingDirection, setPendingDirection] = useState<ToggleDirection | null>(null)

  const resyncSwitch = () => setSwitchKey((k) => k + 1)

  const btcBalanceAmount =
    wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)?.balance.amount ?? 0
  const usdBalanceAmount =
    wallets.find((w) => w.walletCurrency === WalletCurrency.Usd)?.balance.amount ?? 0
  const hasUsdBalance = usdBalanceAmount > 0
  const hasBtcBalance = btcBalanceAmount > 0

  const isActivating = pendingDirection === ToggleDirection.Activate
  const sourceBalance = isActivating ? btcBalanceAmount : usdBalanceAmount
  const fromCurrency = isActivating ? WalletCurrency.Btc : WalletCurrency.Usd

  const toggleQuote = useStableBalanceToggleQuote({
    fromCurrency,
    sourceBalance,
    enabled: pendingDirection !== null,
  })

  const apply = async (activate: boolean) => {
    if (!sdk || busy) return
    setBusy(true)
    setPendingValue(activate)
    try {
      if (activate) {
        await activateStableBalance(sdk, SparkToken.Label)
        logSelfCustodialStableBalanceActivated({ label: SparkToken.Label })
      } else {
        await deactivateStableBalance(sdk)
      }
      await refreshStableBalanceActive()
      await refreshWallets()
    } finally {
      setBusy(false)
      setPendingValue(null)
    }
  }

  const handleToggle = (next: boolean) => {
    if (next && !hasBtcBalance) {
      apply(true)
      return
    }
    if (!next && !hasUsdBalance) {
      apply(false)
      return
    }
    setPendingDirection(next ? ToggleDirection.Activate : ToggleDirection.Deactivate)
  }

  const closeModal = () => {
    setPendingDirection(null)
    resyncSwitch()
  }

  const handleConfirmModal = async () => {
    const activate = pendingDirection === ToggleDirection.Activate
    setPendingValue(activate)
    setPendingDirection(null)
    await apply(activate)
  }

  const displayValue = pendingValue ?? isStableBalanceActive
  const showFeeRow = sourceBalance > 0

  return (
    <Screen>
      <View style={styles.container} {...testProps(SCREEN_TEST_ID)}>
        <Text type="h2" style={styles.title}>
          {LL.StableBalance.settingsTitle()}
        </Text>
        <Text type="p1" style={styles.description}>
          {LL.StableBalance.settingsDescription()}
        </Text>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text type="p1" style={styles.rowTitle}>
              {LL.StableBalance.activationLabel()}
            </Text>
            <Text type="p2" style={styles.rowHint}>
              {isStableBalanceActive
                ? LL.StableBalance.activeHint()
                : LL.StableBalance.inactiveHint()}
            </Text>
          </View>
          {busy ? <ActivityIndicator style={styles.spinner} /> : null}
          <Switch
            key={switchKey}
            value={displayValue}
            onValueChange={handleToggle}
            disabled={busy || !sdk}
            testID={SWITCH_TEST_ID}
            accessibilityLabel={LL.StableBalance.activationLabel()}
          />
        </View>
      </View>
      <StableBalanceConfirmModal
        isVisible={pendingDirection !== null}
        isActivating={isActivating}
        feeText={toggleQuote.feeText}
        adjustmentText={toggleQuote.adjustmentText}
        isLoading={toggleQuote.isQuoting}
        hasError={toggleQuote.hasQuoteError}
        showFeeRow={showFeeRow}
        deactivationWarning={
          pendingDirection === ToggleDirection.Deactivate && hasUsdBalance
            ? LL.StableBalance.deactivateWarningBody({
                amount: (usdBalanceAmount / USD_CENTS_PER_DOLLAR).toFixed(
                  USD_FRACTION_DIGITS,
                ),
              })
            : undefined
        }
        isSubmitting={busy}
        onConfirm={handleConfirmModal}
        onCancel={closeModal}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    color: colors.grey2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.grey4,
  },
  rowLabel: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontWeight: "600",
  },
  rowHint: {
    color: colors.grey2,
  },
  spinner: {
    marginRight: 4,
  },
}))
