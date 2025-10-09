import * as React from "react"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { View } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const WelcomeCard: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleNext = () => {
    navigation.navigate("BitcoinCard")
  }

  return (
    <Screen>
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Icon name={"heart-outline"} type="ionicon" color={colors._green} size={45} />
          </View>
        </View>

        <Text type="h1" style={styles.welcomeTitle}>
          {LL.CardWelcomeScreen.welcomeMessage.title()}
        </Text>

        <Text type="h2" style={styles.subtitle}>
          — {LL.CardWelcomeScreen.welcomeMessage.subtitle()} —
        </Text>

        <Text type="p1" style={styles.bodyText}>
          {LL.CardWelcomeScreen.welcomeMessage.paragraphs.body1()}
        </Text>

        <Text type="p1" style={styles.bodyText}>
          {LL.CardWelcomeScreen.welcomeMessage.paragraphs.body2()}
        </Text>
      </View>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardWelcomeScreen.buttonText()}
          onPress={handleNext}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  contentContainer: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 60,
    alignItems: "center",
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
    marginBottom: 16,
    textAlign: "center",
    fontWeight: "bold",
  },
  subtitle: {
    marginBottom: 40,
    textAlign: "center",
    fontStyle: "italic",
  },
  bodyText: {
    marginBottom: 24,
    lineHeight: 26,
    textAlign: "left",
    width: "100%",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
