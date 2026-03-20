import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { RouteProp, useRoute } from "@react-navigation/native"

import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BlinkCard } from "@app/components/blink-card/blink-card"
import { AddToWalletButton, InfoCard } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

type AddToMobileWalletRouteProp = RouteProp<
  RootStackParamList,
  "cardAddToMobileWalletScreen"
>

export const CardAddToMobileWalletScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const route = useRoute<AddToMobileWalletRouteProp>()
  const { lastFour, holderName } = route.params
  const [isLoading, setIsLoading] = useState(false)

  const handleAddToWallet = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement actual wallet integration
      console.log("Add to wallet pressed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <GaloyIcon name="physical-card" size={34} color={colors._green} />
          </View>
          <Text style={styles.title}>{LL.CardFlow.AddToMobileWallet.addYourCard()}</Text>
          <Text style={styles.subtitle}>
            {LL.CardFlow.AddToMobileWallet.addYourCardDescription()}
          </Text>
        </View>

        <BlinkCard
          cardNumber={lastFour}
          holderName={holderName}
          validThruDate=""
          isFrozen={false}
        />

        <AddToWalletButton onPress={handleAddToWallet} disabled={isLoading} />

        <InfoCard
          title={LL.CardFlow.AddToMobileWallet.Benefits.title()}
          bulletItems={[
            LL.CardFlow.AddToMobileWallet.Benefits.contactless(),
            LL.CardFlow.AddToMobileWallet.Benefits.security(),
            LL.CardFlow.AddToMobileWallet.Benefits.noPhysicalCard(),
            LL.CardFlow.AddToMobileWallet.Benefits.worksLocked(),
          ]}
          showIcon={false}
          size="lg"
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  heroSection: {
    alignItems: "center",
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 12,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 264,
  },
}))
