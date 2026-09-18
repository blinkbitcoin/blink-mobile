import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { RESET_TO_HOME, resetToTransferStep } from "./transfer-invest-screen"

export const WelcomeInvestScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { progress, isEligible, isAccountResolved, markInvited } =
    useCardInvestmentProgress()

  /** The investment is paid from a custodial balance; a self-custodial account that
   *  arrives here, by a link or a notification, has no part in it and is sent home. */
  React.useEffect(() => {
    if (!isEligible) navigation.dispatch(RESET_TO_HOME)
  }, [isEligible, navigation])

  /**
   * Opening this screen is what records the invitation, whichever way it was opened: the
   * server's own invitation card is gone the moment it is tapped, and the home needs a
   * record to hold a way back into the flow for an investor who leaves before signing.
   * Recorded once the account it is filed under is known, and never over an agreement
   * already signed.
   */
  React.useEffect(() => {
    if (isAccountResolved) markInvited()
  }, [isAccountResolved, markInvited])

  /**
   * An investor who already signed is not walked through the flow again: every way in,
   * the home's cards, a link, a notification, lands here, and the screens beyond would
   * let them sign a second agreement. A signed investment resumes at its payment, on the
   * same stack the signing step leaves, whatever was open underneath; a paid one goes
   * back to the home, where its welcome is.
   */
  React.useEffect(() => {
    if (!progress) return
    if (progress.paidAt) {
      navigation.dispatch(RESET_TO_HOME)
      return
    }
    navigation.dispatch(
      resetToTransferStep({
        selectedAmountUsd: progress.selectedAmountUsd,
        settlementSats: progress.settlementSats,
      }),
    )
  }, [progress, navigation])

  const handleNext = () => {
    navigation.navigate("cardOnboardingCompanyValuationScreen")
  }

  /** Until the account is known the record cannot be read, and a tap in that window
   *  would push the next screen over a welcome about to send the investor elsewhere. */
  const isContinueDisabled = !isAccountResolved

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="welcome-invest-close" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="heart-outline"
          iconColor={colors._green}
          title={LL.CardFlow.Onboarding.WelcomeInvest.welcomeMessage.title()}
        />

        <View style={styles.content}>
          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.WelcomeInvest.welcomeMessage.paragraphs.body1()}
          </Text>

          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.WelcomeInvest.welcomeMessage.paragraphs.body2()}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.WelcomeInvest.buttonText()}
          disabled={isContinueDisabled}
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
    paddingBottom: 20,
    paddingTop: 40,
  },
  content: {
    marginTop: 20,
    gap: 22,
  },
  bodyText: {
    lineHeight: 22,
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
