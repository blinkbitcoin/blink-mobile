import React, { useState } from "react"
import { Pressable, View } from "react-native"
import Animated from "react-native-reanimated"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { AmountInputModal } from "@app/components/amount-input/amount-input-modal"
import { useAlternatingSpin } from "@app/components/animations"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"
import {
  DisplayCurrency,
  isNonZeroMoneyAmount,
  MoneyAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"

type FormattedAmounts = { formattedPrimary: string; formattedSecondary: string }

type FormatAmountsParams = {
  unitOfAccountAmount?: MoneyAmount<WalletOrDisplayCurrency>
  convertMoneyAmount: ConvertMoneyAmount
  formatMoneyAmount: ReturnType<typeof useDisplayCurrency>["formatMoneyAmount"]
  getSecondaryAmountIfCurrencyIsDifferent: ReturnType<
    typeof useDisplayCurrency
  >["getSecondaryAmountIfCurrencyIsDifferent"]
}

const formatAmounts = ({
  unitOfAccountAmount,
  convertMoneyAmount,
  formatMoneyAmount,
  getSecondaryAmountIfCurrencyIsDifferent,
}: FormatAmountsParams): FormattedAmounts => {
  if (!isNonZeroMoneyAmount(unitOfAccountAmount))
    return { formattedPrimary: "", formattedSecondary: "" }

  const displayAmount = convertMoneyAmount(unitOfAccountAmount, DisplayCurrency)
  const btcAmount = convertMoneyAmount(unitOfAccountAmount, WalletCurrency.Btc)

  const secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: displayAmount,
    walletAmount: btcAmount,
    displayAmount,
  })

  return {
    formattedPrimary: formatMoneyAmount({ moneyAmount: displayAmount }),
    formattedSecondary: secondaryAmount
      ? formatMoneyAmount({ moneyAmount: secondaryAmount })
      : "",
  }
}

type ReceiveAmountRowProps = {
  unitOfAccountAmount?: MoneyAmount<WalletOrDisplayCurrency>
  walletCurrency: WalletCurrency
  convertMoneyAmount: ConvertMoneyAmount
  setAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  canSetAmount: boolean
  onToggleWallet: () => void
  canToggleWallet: boolean
  disabled?: boolean
}

export const ReceiveAmountRow: React.FC<ReceiveAmountRowProps> = ({
  unitOfAccountAmount,
  walletCurrency,
  convertMoneyAmount,
  setAmount,
  canSetAmount,
  onToggleWallet,
  canToggleWallet,
  disabled,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { formatMoneyAmount, getSecondaryAmountIfCurrencyIsDifferent } =
    useDisplayCurrency()
  const [isPressed, setIsPressed] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()
  const { triggerSpin, spinStyle } = useAlternatingSpin()

  const { formattedPrimary, formattedSecondary } = formatAmounts({
    unitOfAccountAmount,
    convertMoneyAmount,
    formatMoneyAmount,
    getSecondaryAmountIfCurrencyIsDifferent,
  })

  const onPressAmount = () => {
    if (!canSetAmount) return
    setIsModalOpen(true)
  }

  const onSetAmount = (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setAmount(amount)
    setIsModalOpen(false)
  }

  return (
    <>
      <View style={[styles.container, isPressed && styles.pressedBg]}>
        {disabled && <View pointerEvents="none" style={styles.disabledOverlay} />}
        <Pressable
          style={[styles.amountSection, disabled && styles.textDisabled]}
          onPress={onPressAmount}
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          disabled={disabled || !canSetAmount}
          accessibilityRole="button"
          accessibilityLabel={formattedPrimary || LL.AmountInputButton.tapToSetAmount()}
        >
          <Text style={formattedPrimary ? styles.amountText : styles.placeholderText}>
            {formattedPrimary || LL.AmountInputButton.tapToSetAmount()}
          </Text>
          {formattedSecondary ? (
            <Text style={styles.secondaryText}>{formattedSecondary}</Text>
          ) : null}
        </Pressable>
        <Pressable
          style={[styles.walletSection, !canToggleWallet && styles.textDisabled]}
          onPress={() => {
            triggerSpin()
            onToggleWallet()
          }}
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          disabled={!canToggleWallet}
          accessibilityRole="button"
          accessibilityLabel="Toggle wallet"
        >
          <Animated.View style={spinStyle}>
            <GaloyIcon name="refresh" size={16} color={colors.grey1} />
          </Animated.View>
          <CurrencyPill
            currency={walletCurrency}
            containerSize="medium"
            containerStyle={pillWidthStyle}
            onLayout={onPillLayout(walletCurrency)}
          />
        </Pressable>
      </View>
      <AmountInputModal
        moneyAmount={unitOfAccountAmount}
        walletCurrency={walletCurrency}
        convertMoneyAmount={convertMoneyAmount}
        onSetAmount={onSetAmount}
        isOpen={isModalOpen}
        close={() => setIsModalOpen(false)}
      />
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    borderRadius: 12,
    minHeight: 67,
    overflow: "hidden",
    backgroundColor: colors.grey5,
  },
  disabledOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    opacity: 0.5,
  },
  textDisabled: {
    opacity: 0.5,
  },
  amountSection: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 14,
    paddingVertical: 14,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.black,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    color: colors.black,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    color: colors.black,
  },
  walletSection: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pressedBg: {
    backgroundColor: colors.grey6,
  },
}))
