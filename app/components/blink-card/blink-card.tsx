import React from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import { BlurView } from "@react-native-community/blur"
import { LinearGradient } from "react-native-linear-gradient"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { formatCardDisplayNumber } from "@app/utils/helper"
import { formatCardValidThruDisplay } from "@app/utils/date"
import { useI18nContext } from "@app/i18n/i18n-react"

const CARD_ASPECT_RATIO = 1.584
const CARD_MAX_WIDTH = 400
const CARD_HORIZONTAL_MARGIN = 40

type BlinkCardProps = {
  cardNumber: string
  holderName?: string
  validThruDate: string | Date
  isFrozen: boolean
  showCardDetails?: boolean
}

export const BlinkCard: React.FC<BlinkCardProps> = ({
  cardNumber,
  holderName,
  validThruDate,
  isFrozen,
  showCardDetails = false,
}) => {
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = Math.min(screenWidth - CARD_HORIZONTAL_MARGIN, CARD_MAX_WIDTH)
  const cardHeight = cardWidth / CARD_ASPECT_RATIO

  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const maskedCardNumber = formatCardDisplayNumber(cardNumber, showCardDetails)

  const maskedValidThru = formatCardValidThruDisplay(validThruDate, showCardDetails)

  return (
    <View style={[styles.cardWrapper, { width: cardWidth, height: cardHeight }]}>
      <LinearGradient
        colors={[colors._primary2, colors._primary1]}
        useAngle={true}
        angle={249}
        style={[styles.card, { width: cardWidth, height: cardHeight }]}
      >
        <View style={styles.topRow}>
          <GaloyIcon name="blink-icon" width={98} height={30} color={colors._white} />
          <GaloyIcon name="visa-platinum" width={69} height={35} color={colors._white} />
        </View>

        <View style={styles.cardNumberSpacer} />
        <Text style={styles.cardNumber}>{maskedCardNumber}</Text>

        <View style={styles.bottomRow}>
          <Text style={styles.holderName}>{holderName}</Text>
          <View style={styles.validThruContainer}>
            <Text style={styles.validThruLabel}>{LL.CardFlow.validThruLabel()}</Text>
            {maskedValidThru ? (
              <Text style={styles.validThruValue}>{maskedValidThru}</Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {isFrozen && (
        <>
          <View style={styles.blurContainer}>
            <BlurView style={styles.blurOverlay} blurType="light" blurRadius={2} />
            <View style={styles.blurTint} />
          </View>
          <View style={styles.frozenOverlay}>
            <View style={styles.lockCircle}>
              <View style={styles.lockCircleBackground} />
              <GaloyIcon name="lock-closed" size={32} color={colors.error} />
            </View>
            <Text style={styles.frozenTitle}>{LL.CardFlow.cardFrozenTitle()}</Text>
            <Text style={styles.frozenSubtitle}>{LL.CardFlow.cardFrozenSubtitle()}</Text>
          </View>
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  cardWrapper: {
    alignSelf: "center",
    overflow: "hidden",
  },
  card: {
    borderRadius: 14,
    paddingTop: 7,
    paddingHorizontal: 11,
    paddingBottom: 15,
    justifyContent: "flex-start",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardNumber: {
    color: colors._white,
    fontSize: 24,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontFamily: "Source Sans Pro",
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 32,
    marginBottom: 7,
  },
  cardNumberSpacer: {
    flexGrow: 1,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  holderName: {
    color: colors._white,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Source Sans Pro",
    lineHeight: 20,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 1,
    marginLeft: 5,
  },
  validThruContainer: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
  },
  validThruLabel: {
    color: colors._white,
    fontSize: 10,
    fontFamily: "Source Sans Pro",
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 13,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  validThruValue: {
    color: colors._white,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 20,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: "hidden",
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  blurTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors._black,
    opacity: 0.6,
  },
  lockCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  lockCircleBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.error,
    opacity: 0.2,
  },
  frozenTitle: {
    color: colors._white,
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Source Sans Pro",
    fontStyle: "normal",
    lineHeight: 24,
  },
  frozenSubtitle: {
    color: colors._white,
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "Source Sans Pro",
    fontStyle: "normal",
    lineHeight: 18,
  },
}))
