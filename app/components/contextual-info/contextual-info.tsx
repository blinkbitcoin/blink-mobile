import React, { useState } from "react"
import { Pressable, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { ExpirationTimeModal } from "@app/components/expiration-time-chooser/expiration-time-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  Invoice,
  InvoiceType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"

const DEFAULT_OVER_FEE = 5000

type FeesInformation = {
  deposit: {
    minBankFee: string
    minBankFeeThreshold: string
    ratio: string
  }
}

type ContextualInfoProps = {
  type: InvoiceType
  expirationTime: number
  setExpirationTime: (time: number) => void
  walletCurrency: WalletCurrency
  canSetExpirationTime: boolean
  feesInformation?: FeesInformation
}

export const ContextualInfo: React.FC<ContextualInfoProps> = ({
  type,
  expirationTime,
  setExpirationTime,
  walletCurrency,
  canSetExpirationTime,
  feesInformation,
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
    const { fee, threshold, overFee } = formatDepositFees(feesInformation.deposit)

    return (
      <View style={styles.depositFeeContainer}>
        <GaloyIcon name="warning" size={16} color={colors.grey1} />
        <Text style={styles.depositFeeText}>
          {LL.ReceiveScreen.depositFee({ fee, threshold, overFee })}
        </Text>
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

const formatDepositFees = (deposit: FeesInformation["deposit"]) => {
  const fee = Number(deposit.minBankFee).toLocaleString("en-US")
  const threshold = new Intl.NumberFormat("en-US", { notation: "compact" }).format(
    Number(deposit.minBankFeeThreshold),
  )
  const computedOverFee = Math.round(
    (Number(deposit.minBankFeeThreshold) * Number(deposit.ratio)) / 10000,
  )
  const overFee = (computedOverFee || DEFAULT_OVER_FEE).toLocaleString("en-US")
  return { fee, threshold, overFee }
}

const useStyles = makeStyles(({ colors }) => ({
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
