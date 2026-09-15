import React from "react"
import { TouchableOpacity, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { formatDestination } from "../amount-entry/send-amount-header"
import { PaymentDetail } from "../payment-details/index.types"

type SendReviewDestinationProps = {
  destination: string
  paymentType: PaymentDetail<WalletCurrency>["paymentType"]
  onCopy: () => void
}

export const SendReviewDestination: React.FC<SendReviewDestinationProps> = ({
  destination,
  paymentType,
  onCopy,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const typeLabel = {
    intraledger: LL.common.intraledger(),
    onchain: LL.common.onchain(),
    lightning: LL.common.lightning(),
    lnurl: LL.common.lightning(),
    spark: LL.common.spark(),
  }[paymentType]

  return (
    <View style={styles.container}>
      <Text type="p3">
        {LL.SendBitcoinScreen.destination()} - {typeLabel}
      </Text>
      {/* The whole field copies, not just the icon. */}
      <TouchableOpacity
        style={styles.field}
        onPress={onCopy}
        accessibilityRole="button"
        {...testProps("send-review-copy-destination")}
      >
        <Text
          type="p3"
          style={styles.value}
          numberOfLines={1}
          ellipsizeMode="middle"
          {...testProps("send-review-destination")}
        >
          {formatDestination({ destination, paymentType, lnAddressHostname })}
        </Text>
        <GaloyIcon name="copy-paste" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    rowGap: 7,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.grey5,
  },
  value: {
    flex: 1,
    color: colors.black,
  },
}))
