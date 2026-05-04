import React, { useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { Switch } from "@app/components/atomic/switch"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { WalletCurrency } from "@app/graphql/generated"
import { formatUsdInDisplay } from "@app/utils/amounts"
import { testProps } from "@app/utils/testProps"

import { StableBalanceConfirmModal } from "./stable-balance-confirm-modal"
import { useStableBalanceToggle, useStableBalanceToggleQuote } from "./hooks"

const ToggleDirection = {
  Activate: "activate",
  Deactivate: "deactivate",
} as const
type ToggleDirection = (typeof ToggleDirection)[keyof typeof ToggleDirection]

const SCREEN_TEST_ID = "stable-balance-settings-screen"
const SWITCH_TEST_ID = "stable-balance-switch"

export const StableBalanceSettingsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const {
    sdk,
    isStableBalanceActive,
    wallets,
    refreshWallets,
    refreshStableBalanceActive,
  } = useSelfCustodialWallet()
  const [pendingDirection, setPendingDirection] = useState<ToggleDirection | null>(null)

  const { busy, displayValue, switchKey, apply, resyncSwitch } = useStableBalanceToggle({
    sdk,
    isStableBalanceActive: isStableBalanceActive ?? false,
    refreshWallets,
    refreshStableBalanceActive,
    LL,
  })

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
    setPendingDirection(null)
    await apply(activate)
  }

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
        isLoading={toggleQuote.isQuoting}
        hasError={toggleQuote.hasQuoteError}
        showFeeRow={showFeeRow}
        deactivationWarning={
          pendingDirection === ToggleDirection.Deactivate && hasUsdBalance
            ? LL.StableBalance.deactivateWarningBody({
                amount: formatUsdInDisplay(usdBalanceAmount, {
                  formatMoneyAmount,
                  convertMoneyAmount,
                }),
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
