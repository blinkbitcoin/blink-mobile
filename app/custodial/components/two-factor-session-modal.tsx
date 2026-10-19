import React, { useCallback, useEffect, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"
import { testProps } from "@app/utils/testProps"

type TwoFactorSessionModalProps = {
  isVisible: boolean
  remainingDismissals: number
  /** The X, the backdrop and the Android back: the dismissal this session counts, and
   *  reports once it counts it. */
  onDismiss: () => void
}

export const TwoFactorSessionModal: React.FC<TwoFactorSessionModalProps> = ({
  isVisible,
  remainingDismissals,
  onDismiss,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Either button makes way for the flow it opens, with no dismissal yet: the modal
   *  hides in the same frame as the push, since a native modal dismissed while a
   *  native-stack transition runs can hang, and stays down with the home while the
   *  flow is up. It comes back with the home if the flow was left without adding the
   *  factor or reporting the dismissal that leaving it unfinished is. */
  const [isLeavingForFlow, setIsLeavingForFlow] = useState(false)
  useEffect(() => {
    if (!isVisible) setIsLeavingForFlow(false)
  }, [isVisible])

  const handleSetNow = useCallback(() => {
    setIsLeavingForFlow(true)
    navigation.navigate("twoFactorSetup", { prompt: TwoFactorPrompt.SessionModal })
  }, [navigation])

  const handleDecline = useCallback(() => {
    setIsLeavingForFlow(true)
    navigation.navigate("twoFactorNonCustodial", {
      origin: { prompt: TwoFactorPrompt.SessionModal },
    })
  }, [navigation])

  const isShown = isVisible && !isLeavingForFlow

  return (
    <CustomModal
      isVisible={isShown}
      toggleModal={onDismiss}
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
