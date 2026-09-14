import React from "react"
import { Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { testProps } from "@app/utils/testProps"

import { PaymentDetail } from "../payment-details/index.types"

export const SEND_AMOUNT_PRIMARY_TEST_ID = "send-amount-primary"
export const SEND_AMOUNT_SECONDARY_TEST_ID = "send-amount-secondary"

type SendAmountHeaderProps = {
  destination: string
  paymentType: PaymentDetail<WalletCurrency>["paymentType"]
  primaryAmount: string
  secondaryAmount?: string
  /** Present while the amount is typed on the keypad: swaps which currency the keys enter. */
  onSwapCurrency?: () => void
  onCopyDestination: () => void
}

export const SendAmountHeader: React.FC<SendAmountHeaderProps> = ({
  destination,
  paymentType,
  primaryAmount,
  secondaryAmount,
  onSwapCurrency,
  onCopyDestination,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const destinationText =
    paymentType === "intraledger" ? `${destination}@${lnAddressHostname}` : destination

  return (
    <View style={styles.container}>
      <GaloyIcon name="send" size={40} color={colors.primary} />
      <Pressable onLongPress={onCopyDestination} style={styles.destination}>
        <Text
          type="p3"
          numberOfLines={1}
          ellipsizeMode="middle"
          style={styles.centered}
          {...testProps("send-destination")}
        >
          {destinationText}
        </Text>
      </Pressable>
      <Pressable
        onPress={onSwapCurrency}
        disabled={!onSwapCurrency || !secondaryAmount}
        accessibilityRole={onSwapCurrency ? "button" : undefined}
        style={styles.amounts}
      >
        <Text
          type="h1"
          bold
          style={[styles.centered, styles.primaryAmount]}
          adjustsFontSizeToFit
          numberOfLines={1}
          {...testProps(SEND_AMOUNT_PRIMARY_TEST_ID)}
        >
          {primaryAmount}
        </Text>
        {secondaryAmount ? (
          <Text
            type="p1"
            bold
            color={colors.grey2}
            style={styles.centered}
            {...testProps(SEND_AMOUNT_SECONDARY_TEST_ID)}
          >
            {secondaryAmount}
          </Text>
        ) : null}
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  destination: {
    alignSelf: "stretch",
  },
  amounts: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  centered: {
    textAlign: "center",
  },
  primaryAmount: {
    fontSize: 32,
    lineHeight: 40,
  },
}))
