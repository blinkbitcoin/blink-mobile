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

type FeesInformation = {
  deposit: {
    minBankFee: string
    minBankFeeThreshold: string
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
    const formattedTime = formatExpirationTime(expirationTime, LL)

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
    return (
      <View style={styles.container}>
        <GaloyIcon name="warning" size={16} color={colors.grey1} />
        <Text style={styles.linkText}>
          {LL.ReceiveScreen.depositFee({
            fee: feesInformation.deposit.minBankFee,
          })}
        </Text>
      </View>
    )
  }

  return null
}

type TranslationFunctions = {
  common: {
    day: { one: () => string; other: () => string }
    hour: () => string
    hours: () => string
    minute: () => string
    minutes: () => string
  }
}

const formatExpirationTime = (minutes: number, LL: TranslationFunctions): string => {
  if (minutes === 0) return ""

  const units = [
    { threshold: 1440, singular: LL.common.day.one(), plural: LL.common.day.other() },
    { threshold: 60, singular: LL.common.hour(), plural: LL.common.hours() },
    { threshold: 1, singular: LL.common.minute(), plural: LL.common.minutes() },
  ]

  for (const unit of units) {
    if (minutes >= unit.threshold) {
      const count = Math.floor(minutes / unit.threshold)
      return `${count} ${count === 1 ? unit.singular : unit.plural}`
    }
  }

  return `${minutes} ${LL.common.minutes()}`
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
}))
