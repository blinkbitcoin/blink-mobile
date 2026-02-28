import React from "react"
import { View } from "react-native"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BlinkCard } from "@app/components/blink-card/blink-card"
import { AddToWalletButton } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { CardStatus, MOCK_CARD } from "./card-mock-data"

type CardStatusScreenRouteProp = RouteProp<RootStackParamList, "cardStatusScreen">

export const CardStatusScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation()
  const route = useRoute<CardStatusScreenRouteProp>()

  const {
    title,
    subtitle,
    buttonLabel,
    navigateTo,
    iconName,
    iconColor = colors._green,
  } = route.params

  const handleAddToWallet = () => {
    navigation.dispatch(CommonActions.navigate("cardAddToMobileWalletScreen"))
  }

  const handlePrimaryButtonPress = () => {
    navigation.dispatch(CommonActions.navigate(navigateTo))
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <GaloyIcon name={iconName} size={34} color={iconColor} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <BlinkCard
          cardNumber={MOCK_CARD.cardNumber}
          holderName={MOCK_CARD.holderName}
          validThruDate={MOCK_CARD.validThruDate}
          isFrozen={MOCK_CARD.status === CardStatus.Frozen}
        />

        <AddToWalletButton onPress={handleAddToWallet} />
      </View>

      <View style={styles.bottomSection}>
        <GaloyPrimaryButton title={buttonLabel} onPress={handlePrimaryButtonPress} />
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
    paddingHorizontal: 24,
    paddingTop: 18,
    alignItems: "center",
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
