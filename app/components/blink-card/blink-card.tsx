import React from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import { BlurView } from "@react-native-community/blur"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { useCardHolder } from "@app/hooks/use-card-holder"
import { useI18nContext } from "@app/i18n/i18n-react"
import { fonts } from "@app/rne-theme/fonts"
import { formatCardValidThruDisplay } from "@app/utils/date"
import { formatCardDisplayNumber } from "@app/utils/helper"

const CARD_ASPECT_RATIO = 1.584
const CARD_MAX_WIDTH = 400
const CARD_HORIZONTAL_MARGIN = 40

type BlinkCardProps = {
  cardId?: string
  cardNumber: string
  holderName?: string
  validThruDate: string | Date
  isFrozen: boolean
  showCardDetails?: boolean
}

export const BlinkCard: React.FC<BlinkCardProps> = ({
  cardId,
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

  const { fullName: resolvedName } = useCardHolder(holderName ? undefined : cardId)
  const displayHolderName = holderName ?? resolvedName

  const maskedCardNumber = formatCardDisplayNumber(cardNumber, showCardDetails)
  const maskedValidThru = formatCardValidThruDisplay(validThruDate, showCardDetails)

  return (
    <View style={[styles.cardWrapper, { width: cardWidth, height: cardHeight }]}>
      <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
        <View style={styles.topRow}>
          <GaloyIcon name="blink-icon" width={98} height={30} color={colors.staticWhite} />
          <GaloyIcon
            name="visa-platinum"
            width={69}
            height={35}
            color={colors.staticWhite}
            style={styles.visaLogo}
          />
        </View>

        <Text
          style={[styles.cardNumber, { top: cardHeight / 2 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {maskedCardNumber}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.holderName}>{displayHolderName?.toUpperCase()}</Text>
          <View style={styles.validThruContainer}>
            <Text style={styles.validThruLabel}>{LL.CardFlow.validThruLabel()}</Text>
            {maskedValidThru ? (
              <Text style={styles.validThruValue}>{maskedValidThru}</Text>
            ) : null}
          </View>
        </View>
      </View>

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
    backgroundColor: colors.staticCardBackground,
    borderRadius: 14,
    paddingTop: 11,
    paddingLeft: 13,
    paddingRight: 15,
    paddingBottom: 18,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  /** The digits' side bearing keeps the date's ink 1pt in from its box, while the logo's
   *  ink reaches its edge, so the logo steps in by the same 1pt to line up with the date. */
  visaLogo: {
    marginRight: 1,
  },
  cardNumber: {
    position: "absolute",
    left: 0,
    right: 0,
    color: colors.staticWhite,
    fontSize: 24,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontFamily: fonts.regular,
    lineHeight: 32,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  holderName: {
    color: colors.staticWhite,
    fontSize: 14,
    fontFamily: fonts.bold,
    lineHeight: 18,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  validThruContainer: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
  },
  validThruLabel: {
    color: colors.staticWhite,
    fontSize: 10,
    fontFamily: fonts.regular,
    lineHeight: 13,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  validThruValue: {
    color: colors.staticWhite,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    overflow: "hidden",
  },
  blurOverlay: {
    ...StyleSheet.absoluteFill,
  },
  blurTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.staticBlack,
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
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.error,
    opacity: 0.2,
  },
  frozenTitle: {
    color: colors.staticWhite,
    fontSize: 20,
    fontFamily: fonts.bold,
    lineHeight: 24,
  },
  frozenSubtitle: {
    color: colors.staticWhite,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
}))
