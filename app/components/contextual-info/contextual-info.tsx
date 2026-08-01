import React, { useState } from "react"
import { Pressable, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { ExpirationTimeModal } from "@app/components/expiration-time-chooser/expiration-time-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import {
  Invoice,
  InvoiceType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import {
  DepositFeesInformation,
  FormattedDepositFeeTier,
  formatDepositFeeTiers,
} from "@app/utils/deposit-fees"

type FeesInformation = {
  deposit: DepositFeesInformation
}

/**
 * Two tiers — the only shape in production — keep the long-standing sentence
 * so the 28 existing translations stay accurate. Any other tier count is
 * composed from per-tier fragments instead of being silently misreported.
 */
const depositFeeText = (
  LL: TranslationFunctions,
  tiers: readonly FormattedDepositFeeTier[],
): string => {
  const [first, last] = [tiers[0], tiers[tiers.length - 1]]

  if (tiers.length === 2 && first.maxAmount !== null && last.maxAmount === null) {
    return LL.ReceiveScreen.depositFee({
      fee: first.amount,
      threshold: first.maxAmount,
      overFee: last.amount,
    })
  }

  return LL.ReceiveScreen.depositFeeTiers({
    tiers: tiers
      .map((tier) =>
        tier.maxAmount === null
          ? LL.ReceiveScreen.depositFeeTierAbove({
              fee: tier.amount,
              min: tier.minAmount ?? "0",
            })
          : LL.ReceiveScreen.depositFeeTierUpTo({
              fee: tier.amount,
              max: tier.maxAmount,
            }),
      )
      .join(", "),
  })
}

type ContextualInfoProps = {
  type: InvoiceType
  expirationTime: number
  setExpirationTime: (time: number) => void
  walletCurrency: WalletCurrency
  canSetExpirationTime: boolean
  feesInformation?: FeesInformation
  shouldShowAutoConvertMinWarning?: boolean
  autoConvertMinSats?: number
  autoConvertMinFiat?: string
}

export const ContextualInfo: React.FC<ContextualInfoProps> = ({
  type,
  expirationTime,
  setExpirationTime,
  walletCurrency,
  canSetExpirationTime,
  feesInformation,
  shouldShowAutoConvertMinWarning = false,
  autoConvertMinSats,
  autoConvertMinFiat,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const [isExpirationModalOpen, setIsExpirationModalOpen] = useState(false)

  const onSetExpirationTime = (time: number) => {
    setExpirationTime(time)
    setIsExpirationModalOpen(false)
  }

  const stackedMessages: React.ReactNode[] = []

  if (shouldShowAutoConvertMinWarning && autoConvertMinSats !== undefined) {
    stackedMessages.push(
      <View key="auto-convert-min" style={styles.depositFeeContainer}>
        <GaloyIcon name="warning" size={16} color={colors.grey1} />
        <Text style={styles.depositFeeText}>
          {LL.ReceiveScreen.autoConvertMinAmount({
            minSats: autoConvertMinSats,
            minFiat: autoConvertMinFiat ?? "",
          })}
        </Text>
      </View>,
    )
  }

  if (stackedMessages.length > 0) {
    return <View style={styles.stackedContainer}>{stackedMessages}</View>
  }

  if (type === Invoice.Lightning && canSetExpirationTime) {
    const formattedTime = formatExpirationTime(expirationTime)

    return (
      <>
        <Pressable
          style={({ pressed }) => [styles.container, pressed && { opacity: 0.5 }]}
          onPress={() => setIsExpirationModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={LL.common.expirationTime()}
        >
          <Text style={styles.linkText}>
            {LL.common.expirationTime()}
            {formattedTime ? `: ${formattedTime}` : ""}
          </Text>
          <GaloyIcon name="caret-down" size={12} color={colors.grey1} />
        </Pressable>
        <ExpirationTimeModal
          value={expirationTime}
          walletCurrency={walletCurrency}
          onSetExpirationTime={onSetExpirationTime}
          isOpen={isExpirationModalOpen}
          close={() => setIsExpirationModalOpen(false)}
        />
      </>
    )
  }

  if (type === Invoice.OnChain && feesInformation) {
    const tiers = formatDepositFeeTiers(feesInformation.deposit)

    return (
      <View style={styles.depositFeeContainer}>
        <GaloyIcon name="warning" size={16} color={colors.grey1} />
        <Text style={styles.depositFeeText}>{depositFeeText(LL, tiers)}</Text>
      </View>
    )
  }

  return null
}

const formatExpirationTime = (minutes: number): string => {
  if (minutes === 0) return ""
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return new Intl.NumberFormat("en-US", {
      style: "unit",
      unit: "hour",
      unitDisplay: "narrow",
    }).format(hours)
  }
  return new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "minute",
    unitDisplay: "narrow",
  }).format(minutes)
}

const useStyles = makeStyles(({ colors }) => ({
  stackedContainer: {
    rowGap: 4,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    columnGap: 6,
    paddingVertical: 4,
  },
  linkText: {
    color: colors.grey1,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    textAlign: "center",
  },
  depositFeeContainer: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingVertical: 4,
  },
  depositFeeText: {
    color: colors.grey1,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    flex: 1,
  },
}))
