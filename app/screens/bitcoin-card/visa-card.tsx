import * as React from "react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { View, Image, ScrollView } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { VisaCard as VisaCardComponent } from "@app/components/visa-card"

export const VisaCard: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleNext = () => {
    navigation.navigate("Primary")
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <GaloyIcon name={"verified-badge"} size={45} color={colors._green} />
            </View>
          </View>

          <Text type="h1" style={styles.welcomeTitle}>
            {LL.VisaCardScreen.cardTitle()}
          </Text>

          <Text type="p1" style={styles.bodyText} color={colors.grey3}>
            {LL.VisaCardScreen.cardSubTitle()}
          </Text>
        </View>
        <VisaCardComponent
          expiredDate={"../.."}
          name={"satoshi nakamoto"}
          cardNumber=".... .... .... 2121"
          useGradient
          gradientDegrees={-60}
        />
        <View style={styles.appleButton}>
          <Text type="h2" color={colors.white}>
            {LL.VisaCardScreen.VisaButtonText()}{" "}
          </Text>
          <GaloyIcon name={"apple-pay"} size={45} color={colors.white} />
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton title={LL.VisaCardScreen.buttonText()} onPress={handleNext} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    marginBottom: 15,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 50,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeTitle: {
    marginBottom: 12,
    paddingHorizontal: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  bodyText: {
    paddingHorizontal: 20,
    marginBottom: 5,
    lineHeight: 26,
    textAlign: "center",
    width: "100%",
  },
  appleButton: {
    marginTop: 20,
    backgroundColor: colors.black,
    height: 50,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    width: "100%",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
