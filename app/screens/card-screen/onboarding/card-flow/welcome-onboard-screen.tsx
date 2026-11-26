import * as React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
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
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.WelcomeOnboard.buttonText()}
          onPress={handleNext}
        />
      }
    >
      <View style={styles.content}>
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
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(() => ({
  content: {
    paddingHorizontal: 20,
  },
  subtitle: {
    textAlign: "center",
  },
  paragraphs: {
    marginTop: 30,
    gap: 24,
  },
}))
