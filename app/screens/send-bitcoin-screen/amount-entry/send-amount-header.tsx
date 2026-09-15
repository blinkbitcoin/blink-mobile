import React, { useEffect, useRef } from "react"
import { Animated, Easing, Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { testProps } from "@app/utils/testProps"

import { PaymentDetail } from "../payment-details/index.types"

export const SEND_AMOUNT_PRIMARY_TEST_ID = "send-amount-primary"
export const SEND_AMOUNT_SECONDARY_TEST_ID = "send-amount-secondary"

const PRIMARY_FONT_SIZE = 26
const PRIMARY_LINE_HEIGHT = 34
const SECONDARY_FONT_SIZE = 18
const SECONDARY_LINE_HEIGHT = 24
/** How far each line's centre travels to reach the other's. */
const SWAP_DISTANCE = PRIMARY_LINE_HEIGHT / 2 + SECONDARY_LINE_HEIGHT / 2
const SWAP_ANIMATION_MS = 220

type SendAmountHeaderProps = {
  destination: string
  paymentType: PaymentDetail<WalletCurrency>["paymentType"]
  primaryAmount: string
  secondaryAmount?: string
  /** Identifies which currency leads; a change swaps the two lines into place. */
  primaryCurrency: string
  /** Present while the amount is typed on the keypad: swaps which currency the keys enter. */
  onSwapCurrency?: () => void
  onCopyDestination: () => void
}

export const SendAmountHeader: React.FC<SendAmountHeaderProps> = ({
  destination,
  paymentType,
  primaryAmount,
  secondaryAmount,
  primaryCurrency,
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

  const swap = useRef(new Animated.Value(1)).current
  const previousPrimaryCurrency = useRef(primaryCurrency)

  useEffect(() => {
    if (previousPrimaryCurrency.current === primaryCurrency) return
    previousPrimaryCurrency.current = primaryCurrency
    swap.setValue(0)
    Animated.timing(swap, {
      toValue: 1,
      duration: SWAP_ANIMATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [primaryCurrency, swap])

  /** Each line starts where, and at the size, the other one was, then settles in its own. */
  const swapStyle = (fromOffset: number, fromScale: number) => ({
    transform: [
      {
        translateY: swap.interpolate({
          inputRange: [0, 1],
          outputRange: [fromOffset, 0],
        }),
      },
      { scale: swap.interpolate({ inputRange: [0, 1], outputRange: [fromScale, 1] }) },
    ],
  })

  const destinationText =
    paymentType === "intraledger" ? `${destination}@${lnAddressHostname}` : destination

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <GaloyIcon name="send" size={32} color={colors.primary} />
      </View>
      <View style={styles.texts}>
        <Pressable onLongPress={onCopyDestination}>
          <Text
            type="p4"
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
        >
          <Animated.Text
            style={[
              styles.primaryAmount,
              swapStyle(SWAP_DISTANCE, SECONDARY_FONT_SIZE / PRIMARY_FONT_SIZE),
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}
            {...testProps(SEND_AMOUNT_PRIMARY_TEST_ID)}
          >
            {primaryAmount}
          </Animated.Text>
          {secondaryAmount ? (
            <Animated.Text
              style={[
                styles.secondaryAmount,
                swapStyle(-SWAP_DISTANCE, PRIMARY_FONT_SIZE / SECONDARY_FONT_SIZE),
              ]}
              numberOfLines={1}
              {...testProps(SEND_AMOUNT_SECONDARY_TEST_ID)}
            >
              {secondaryAmount}
            </Animated.Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    alignItems: "center",
    rowGap: 10,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    alignSelf: "stretch",
    rowGap: 8,
  },
  centered: {
    textAlign: "center",
  },
  primaryAmount: {
    fontFamily: "SourceSansPro-Bold",
    fontSize: PRIMARY_FONT_SIZE,
    lineHeight: PRIMARY_LINE_HEIGHT,
    color: colors.black,
    textAlign: "center",
  },
  secondaryAmount: {
    fontFamily: "SourceSansPro-Bold",
    fontSize: SECONDARY_FONT_SIZE,
    lineHeight: SECONDARY_LINE_HEIGHT,
    color: colors.grey2,
    textAlign: "center",
  },
}))
