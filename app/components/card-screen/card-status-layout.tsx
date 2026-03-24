import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BlinkCard } from "@app/components/blink-card/blink-card"
import { Screen } from "@app/components/screen"

import { AddToWalletButton } from "./add-to-wallet-button"

type CardStatusLayoutProps = {
  title: string
  subtitle: string
  buttonLabel: string
  onPrimaryButtonPress: () => void
  iconName: IconNamesType
  iconColor?: string
  showCard?: boolean
  cardId?: string
  cardNumber?: string
  validThruDate?: string | Date
  isFrozen?: boolean
  showAddToWallet?: boolean
}

export const CardStatusLayout: React.FC<CardStatusLayoutProps> = ({
  title,
  subtitle,
  buttonLabel,
  onPrimaryButtonPress,
  iconName,
  iconColor,
  showCard = true,
  cardId,
  cardNumber = "",
  validThruDate = "",
  isFrozen = false,
  showAddToWallet = true,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const resolvedIconColor = iconColor ?? colors._green

  const handleAddToWallet = () => {
    // TODO: Phase 3 - Implement MeaWallet SDK integration
    console.log("Add to wallet pressed")
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <GaloyIcon name={iconName} size={34} color={resolvedIconColor} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.cardSection}>
          {showCard && (
            <BlinkCard
              cardId={cardId}
              cardNumber={cardNumber}
              validThruDate={validThruDate}
              isFrozen={isFrozen}
            />
          )}

          {showAddToWallet ? <AddToWalletButton onPress={handleAddToWallet} /> : null}
        </View>
      </View>

      <View style={styles.bottomSection}>
        <GaloyPrimaryButton title={buttonLabel} onPress={onPrimaryButtonPress} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  heroSection: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  cardSection: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: colors.black,
    fontSize: 20,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 264,
  },
  subtitle: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 264,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
}))
