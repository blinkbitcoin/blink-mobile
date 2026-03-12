import * as React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BlinkCard } from "@app/components/blink-card/blink-card"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { MOCK_CARD_DISPLAY } from "../onboarding-mock-data"

export const CardIntroducingScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <Screen>
      <View style={styles.cardStyle}>
        <BlinkCard
          cardNumber={MOCK_CARD_DISPLAY.cardNumber}
          holderName={MOCK_CARD_DISPLAY.holderName}
          validThruDate={MOCK_CARD_DISPLAY.validThruDate}
          showCardDetails
          isFrozen={false}
        />
        <View style={styles.textContainer}>
          <Text type="h2" style={styles.boldText}>
            {LL.CardFlow.Onboarding.CardIntroducing.cardInfo.bitcoinCard()}
          </Text>
          <View style={styles.forContainer}>
            <View style={styles.lineStyle} />
            <Text type="p1">{LL.CardFlow.Onboarding.CardIntroducing.cardInfo.for()}</Text>
            <View style={styles.lineStyle} />
          </View>
          <Text type="h2" style={styles.boldText}>
            {LL.CardFlow.Onboarding.CardIntroducing.cardInfo.maximalist()}
          </Text>
        </View>
      </View>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardIntroducing.buttonText()}
          onPress={() => navigation.navigate("cardOnboardingDetailsScreen")}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  cardStyle: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    padding: 20,
    gap: 50,
    marginTop: -70,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 2,
  },
  textContainer: {
    gap: 5,
    alignItems: "center",
  },
  boldText: {
    fontWeight: "bold",
  },
  forContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
  },
  lineStyle: {
    height: 1,
    width: 16,
    backgroundColor: colors.black,
  },
}))
