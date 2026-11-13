import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

/** Where the wait ends when the card issuer refuses the application. */
export const CardDeclinedScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Back to the Home under it: navigating would stack a second one on top. */
  const handleClose = () => {
    navigation.popTo("Primary")
  }

  return (
    <StepLayout
      footer={<GaloyPrimaryButton title={LL.common.close()} onPress={handleClose} />}
    >
      <IconHero
        icon="declined"
        iconColor={colors.error}
        title={LL.CardFlow.Onboarding.CardDeclined.title()}
        subtitle={
          <Text type="p2" style={styles.subtitle}>
            {LL.CardFlow.Onboarding.CardDeclined.subtitle()}
          </Text>
        }
      />
    </StepLayout>
  )
}

const useStyles = makeStyles(() => ({
  subtitle: {
    textAlign: "center",
  },
}))
