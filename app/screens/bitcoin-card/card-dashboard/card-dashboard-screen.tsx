import * as React from "react"
import { makeStyles, Text } from "@rn-vui/themed"
import { View } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { Screen } from "../../../components/screen"
import { VisaCard } from "../../../components/visa-card/visa-card"

export const CardDashboardScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <Screen>
      <View style={styles.cardStyle}>
        <VisaCard
          expiredDate={"01/28"}
          name={"satoshi nakamoto"}
          cardNumber="2121 2121 2121 2121"
          useGradient
          gradientDegrees={45}
        />
        <View style={styles.textContainer}>
          <Text type="h2" style={styles.boldText}>
            {LL.BitcoinCardScreen.cardInfo.bitcoinCard()}
          </Text>
          <View style={styles.forContainer}>
            <View style={styles.lineStyle} />
            <Text type="p1" style={styles.italicText}>
              {LL.BitcoinCardScreen.cardInfo.for()}
            </Text>
            <View style={styles.lineStyle} />
          </View>
          <Text type="h2" style={styles.boldText}>
            {LL.BitcoinCardScreen.cardInfo.maximalist()}
          </Text>
        </View>
      </View>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.BitcoinCardScreen.buttonText()}
          onPress={() => navigation.navigate("cardDetails")}
          disabled={false}
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
  italicText: {
    fontStyle: "italic",
  },
  lineStyle: {
    height: 1,
    width: 16,
    backgroundColor: colors.black,
  },
}))
