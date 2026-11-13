import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Confetti } from "@app/components/confetti"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const CardPreapprovedScreen: React.FC = () => {
  const styles = useStyles()
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
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="check-badge"
          iconColor={colors.success}
          title={LL.CardFlow.Onboarding.CardPreapproved.title()}
          subtitle={LL.CardFlow.Onboarding.CardPreapproved.subtitle()}
        />
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardPreapproved.buttonText()}
          onPress={handleNext}
        />
      </View>
      <Confetti />
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
