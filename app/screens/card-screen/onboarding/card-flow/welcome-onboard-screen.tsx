import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const WelcomeOnboardScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleNext = () => {
    navigation.navigate("cardOnboardingIntroducingScreen")
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="heart-outline"
          iconColor={colors.success}
          title={LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.title()}
          subtitle={
            <Text type="p1" style={styles.subtitle}>
              — {LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.subtitle()} —
            </Text>
          }
        />

        <View style={styles.paragraphs}>
          <Text type="p2">
            {LL.CardFlow.Onboarding.WelcomeOnboard.welcomeMessage.paragraphs.body1()}
          </Text>
          <Text type="p2">
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

const useStyles = makeStyles(() => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  subtitle: {
    textAlign: "center",
  },
  paragraphs: {
    marginTop: 30,
    gap: 24,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
