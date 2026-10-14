import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt, TwoFactorTier } from "@app/types/two-factor-enforcement"
import {
  logTwoFactorPromptDismissed,
  logTwoFactorPromptShown,
} from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

type TwoFactorSessionModalProps = {
  isVisible: boolean
  tier: TwoFactorTier
  remainingDismissals: number
  /** The X, the backdrop and the Android back: the dismissal this session counts. */
  onDismiss: () => void
  /** Either button: the modal makes way for the flow it opens, with no dismissal yet.
   *  Leaving that flow unfinished is what counts, and the flow reports it itself. */
  onLeave: () => void
}

export const TwoFactorSessionModal: React.FC<TwoFactorSessionModalProps> = ({
  isVisible,
  tier,
  remainingDismissals,
  onDismiss,
  onLeave,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    if (isVisible) logTwoFactorPromptShown({ tier, prompt: TwoFactorPrompt.SessionModal })
  }, [isVisible, tier])

  const handleDismiss = useCallback(() => {
    logTwoFactorPromptDismissed({ tier, prompt: TwoFactorPrompt.SessionModal })
    onDismiss()
  }, [tier, onDismiss])

  const handleSetNow = useCallback(() => {
    onLeave()
    navigation.navigate("twoFactorSetup")
  }, [onLeave, navigation])

  const handleDecline = useCallback(() => {
    onLeave()
    navigation.navigate("twoFactorNonCustodial")
  }, [onLeave, navigation])

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={handleDismiss}
      showCloseIconButton={true}
      image={
        <GaloyIcon
          name="lock-closed"
          size={52}
          color={colors.primary}
          {...testProps("two-factor-modal-icon")}
        />
      }
      title={LL.TwoFactorEnforcement.title()}
      body={
        <>
          <Text style={styles.description}>
            {LL.TwoFactorEnforcement.cardDescription()}{" "}
            {countdownCopy(LL, remainingDismissals)}
          </Text>
          <Text style={styles.description}>
            {LL.TwoFactorEnforcement.modalReminder()}
          </Text>
        </>
      }
      primaryButtonTitle={LL.TwoFactorEnforcement.setNow()}
      primaryButtonOnPress={handleSetNow}
      secondaryButtonTitle={LL.TwoFactorEnforcement.dontWantTo()}
      secondaryButtonOnPress={handleDecline}
      {...testProps("two-factor-session-modal")}
    />
  )
}

type Translations = ReturnType<typeof useI18nContext>["LL"]

/** The body counts down what is left after the dismissal the user is looking at. */
const countdownCopy = (LL: Translations, remainingDismissals: number): string => {
  if (remainingDismissals >= 3) return LL.TwoFactorEnforcement.dismissTwoMore()
  if (remainingDismissals === 2) return LL.TwoFactorEnforcement.dismissOneMore()
  return LL.TwoFactorEnforcement.dismissLast()
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    marginBottom: 20,
  },
}))
