import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const WelcomeOnboardScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleNext = () => {
    navigation.navigate("cardOnboardingIntroducingScreen")
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon
                name={"heart-outline"}
                type="ionicon"
                color={colors._green}
                size={40}
              />
            </View>
          </View>

          <Text type="h2" style={styles.welcomeTitle}>
            {LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.title()}
          </Text>

          <Text type="p1" style={styles.subtitle}>
            — {LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.subtitle()} —
          </Text>

          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.paragraphs.body1()}
          </Text>

          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.paragraphs.body2()}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.WelcomeOnboard.buttonText()}
          onPress={handleNext}
        />
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
    paddingTop: 40,
  },
  contentContainer: {
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 15,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeTitle: {
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  subtitle: {
    marginBottom: 40,
    textAlign: "center",
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
