/* eslint-disable react-native/no-color-literals */
/* eslint-disable react-native/no-unused-styles */
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { Text, View } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
import Swiper from "react-native-swiper"
import { OnboardingScreen } from "../../components/onboarding"
import { Screen } from "../../components/screen"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import type { ScreenType } from "../../types/jsx"
import BitcoinBitcoin from "./bitcoin-bitcoin-01.svg"
import BankShop from "./cc-bank-shop-01.svg"
import MascotDollarBitcoin from "./honey-badger-money-bitcoin-01.svg"
import HoneyBadgerShovel from "./honey-badger-shovel-01.svg"

const styles = EStyleSheet.create({
  $color: palette.blue,
  $fontWeight: "bold",
  $paddingHorizontal: "40rem",
  $textAlign: "center",

  dot: {
    backgroundColor: palette.white,
    borderRadius: 4,
    height: 8,
    marginBottom: 3,
    marginLeft: 3,
    marginRight: 3,
    marginTop: 3,
    width: 8,
  },

  text: {
    color: "$color",
    fontSize: "20rem",
    paddingHorizontal: "$paddingHorizontal",
    paddingTop: "24rem",
    textAlign: "$textAlign",
    // fontWeight: "$fontWeight",
  },

  title: {
    color: "$color",
    fontSize: "30rem",
    fontWeight: "$fontWeight",
    paddingTop: "24rem",
    textAlign: "$textAlign",
  },
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "welcomeFirst">
}

export const WelcomeFirstScreen: ScreenType = ({ navigation }: Props) => (
  <Swiper loop={false} activeDot={<View style={styles.dot} />}>
    <Screen backgroundColor={palette.offWhite} statusBar="light-content">
      <OnboardingScreen Svg={MascotDollarBitcoin}>
        <Text style={styles.title}>Bitcoin:</Text>
        <Text style={styles.text}>{translate("WelcomeFirstScreen.care")}</Text>
      </OnboardingScreen>
    </Screen>
    <Screen backgroundColor={palette.offWhite}>
      <OnboardingScreen Svg={BitcoinBitcoin}>
        <Text style={styles.text}>{translate("WelcomeFirstScreen.bank")}</Text>
      </OnboardingScreen>
    </Screen>
    <Screen backgroundColor={palette.offWhite} statusBar="light-content">
      <OnboardingScreen Svg={BankShop}>
        <Text style={styles.text}>{translate("WelcomeFirstScreen.before")}</Text>
      </OnboardingScreen>
    </Screen>
    <Screen backgroundColor={palette.offWhite} statusBar="light-content">
      <OnboardingScreen
        action={async () => {
          navigation.replace("Primary")
          setTimeout(() => {
            navigation.navigate("phoneValidation")
          }, 500)
          
        }}
        Svg={HoneyBadgerShovel}
        nextTitle={translate("WelcomeFirstScreen.learnToEarn")}
      >
        <Text style={styles.text}>{translate("WelcomeFirstScreen.learn")}</Text>
      </OnboardingScreen>
    </Screen>
  </Swiper>
)
