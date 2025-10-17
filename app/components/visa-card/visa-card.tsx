import React, { FunctionComponent, useState } from "react"
import { View, ViewStyle, DimensionValue, LayoutChangeEvent } from "react-native"
import LinearGradient from "react-native-linear-gradient"

import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import LogoLightMode from "@app/assets/images/app-logo-white.svg"
import VisaPlatinumLightMode from "@app/assets/images/visa-platinum-light.svg"

interface VisaCardProps {
  cardNumber?: string
  name: string
  expiredDate: string
  backgroundColor?: string
  gradientColors?: string[]
  gradientLocations?: number[]
  useGradient?: boolean
  gradientStart?: { x: number; y: number }
  gradientEnd?: { x: number; y: number }
  gradientDegrees?: number
  textColor?: string
  cardHeight?: number
  cardWidth?: DimensionValue
  borderRadius?: number
  logoWidth?: number
  visaLogoHeight?: number
  cardNumberFontSize?: number
  expiryDateFontSize?: number
  style?: ViewStyle
}

export const VisaCard: FunctionComponent<VisaCardProps> = ({
  cardNumber = "•••• •••• •••• ••••",
  name,
  expiredDate,
  backgroundColor,
  gradientColors,
  gradientLocations,
  useGradient = false,
  gradientStart,
  gradientEnd,
  gradientDegrees,
  textColor,
  cardHeight = 197,
  cardWidth = "100%",
  borderRadius = 14,
  logoWidth = 120,
  visaLogoHeight = 83,
  cardNumberFontSize,
  expiryDateFontSize,
  style,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const styles = useStyles({
    backgroundColor,
    textColor,
    cardHeight,
    cardWidth,
    borderRadius,
    cardNumberFontSize,
    expiryDateFontSize,
  })
  const { LL } = useI18nContext()

  const [cardWidthPx, setCardWidthPx] = useState<number>(0)
  const designReferenceWidth = 360

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setCardWidthPx(Math.round(width))
  }

  const scaleFactor = cardWidthPx > 0 ? cardWidthPx / designReferenceWidth : 1

  const scale = (value: number, min = 8, max?: number) => {
    const s = Math.round(value * scaleFactor)
    if (max !== undefined) return Math.min(Math.max(s, min), max)
    return Math.max(s, min)
  }

  const scaledLogoWidth = cardWidthPx > 0 ? scale(logoWidth, 24) : logoWidth
  const scaledVisaSize = cardWidthPx > 0 ? scale(visaLogoHeight, 20) : visaLogoHeight
  const scaledVisaMarginTop = cardWidthPx > 0 ? Math.round(-15 * scaleFactor) : -15

  const dynamicTextStyles = {
    cardNumberText: {
      fontSize: cardWidthPx > 0 ? scale(24) : 24,
    },
    cardholderName: {
      fontSize: cardWidthPx > 0 ? scale(14) : 14,
    },
    expiryLabel: {
      fontSize: cardWidthPx > 0 ? scale(11) : 11,
    },
    expiryDate: {
      fontSize: cardWidthPx > 0 ? scale(14) : 14,
    },
  }

  const degreesToGradientCoords = (degrees: number) => {
    const adjustedDegrees = degrees - 90
    const radians = (adjustedDegrees * Math.PI) / 180

    const x = Math.cos(radians)
    const y = Math.sin(radians)

    return {
      start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
      end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
    }
  }

  const gradientCoords =
    gradientDegrees !== undefined
      ? degreesToGradientCoords(gradientDegrees)
      : {
          start: gradientStart || { x: 0.2, y: 0 },
          end: gradientEnd || { x: 0.8, y: 1 },
        }

  const formatCardNumber = (number: string) => {
    const cleaned = number.replace(/\s/g, "")
    const normalized = cleaned.replaceAll(".", "•")
    const groups = normalized.match(/.{1,4}/g)
    return groups ? groups.join("  ") : number
  }

  const formatCardExpiredDate = (number: string) => {
    const normalized = number.replaceAll(".", "•")
    const format = normalized.replace("/", "/ ")
    return format
  }

  const CardContent = () => (
    <>
      <View style={styles.cardHeader}>
        <LogoLightMode
          width={scaledLogoWidth}
          height={Math.round(scaledLogoWidth * 0.3)}
          style={{ marginLeft: -6 }}
        />

        <VisaPlatinumLightMode
          height={scaledVisaSize}
          width={scaledVisaSize}
          style={[{ marginTop: scaledVisaMarginTop }]}
        />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardNumberContainer}>
          <Text
            style={[styles.cardNumberText, dynamicTextStyles.cardNumberText]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling
          >
            {formatCardNumber(cardNumber)}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text
            style={[styles.cardholderName, dynamicTextStyles.cardholderName]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling
          >
            {name}
          </Text>
          <View style={styles.expiryContainer}>
            <Text
              style={[styles.expiryLabel, dynamicTextStyles.expiryLabel]}
              allowFontScaling
            >
              {LL.common.validThru()}
            </Text>
            <Text
              style={[styles.expiryDate, dynamicTextStyles.expiryDate]}
              allowFontScaling
            >
              {formatCardExpiredDate(expiredDate)}
            </Text>
          </View>
        </View>
      </View>
    </>
  )

  if (useGradient) {
    return (
      <LinearGradient
        colors={gradientColors ?? ["#feac0a", colors.orange]}
        locations={gradientLocations}
        start={gradientCoords.start}
        end={gradientCoords.end}
        style={[styles.cardContainer, style]}
        onLayout={handleLayout}
      >
        <CardContent />
      </LinearGradient>
    )
  }

  return (
    <View style={[styles.cardContainer, style]} onLayout={handleLayout}>
      <CardContent />
    </View>
  )
}

const useStyles = makeStyles(
  (
    { colors },
    props: {
      backgroundColor?: string
      textColor?: string
      cardHeight: number
      cardWidth: DimensionValue
      borderRadius: number
      cardNumberFontSize?: number
      expiryDateFontSize?: number
    },
  ) => ({
    cardContainer: {
      backgroundColor: props.backgroundColor || colors.orange,
      borderRadius: props.borderRadius,
      width: props.cardWidth,
      aspectRatio: 1.585,
      paddingHorizontal: 15,
      paddingVertical: 10,
      paddingTop: 9,
      justifyContent: "space-between",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    cardContent: {
      gap: 19,
    },
    cardNumberContainer: {
      width: "100%",
      alignItems: "center",
    },
    cardNumberText: {
      fontWeight: "bold",
      fontFamily: "Courier New",
      color: props.textColor ?? colors._white,
      letterSpacing: 1,
      textShadowColor: "rgba(0, 0, 0, 0.39)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingBottom: 12,
    },
    cardholderName: {
      textTransform: "uppercase",
      fontWeight: "600",
      color: props.textColor ?? colors._white,
      textShadowColor: "rgba(0, 0, 0, 0.39)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
      paddingLeft: 2,
    },
    expiryContainer: {
      alignItems: "flex-end",
    },
    expiryLabel: {
      textTransform: "uppercase",
      color: props.textColor ?? colors._white,
      textShadowColor: "rgba(0, 0, 0, 0.39)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
      marginBottom: -1,
    },
    expiryDate: {
      color: props.textColor ?? colors._white,
      textShadowColor: "rgba(0, 0, 0, 0.39)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
  }),
)
