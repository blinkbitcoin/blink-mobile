import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Confetti } from "@app/components/confetti"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const CardPreapprovedScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Back to the Home under it: navigating would stack a second one on top. */
  const handleNext = () => {
    navigation.popTo("Primary")
  }

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardPreapproved.buttonText()}
          onPress={handleNext}
        />
      }
      overlay={<Confetti />}
    >
      <IconHero
        icon="check-badge"
        iconColor={colors.success}
        title={LL.CardFlow.Onboarding.CardPreapproved.title()}
        subtitle={LL.CardFlow.Onboarding.CardPreapproved.subtitle()}
      />
    </StepLayout>
  )
}
