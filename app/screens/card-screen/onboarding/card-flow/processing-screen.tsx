import * as React from "react"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BusyStateScreen, CHIP_GLYPH_SIZE } from "@app/components/busy-state"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useCardApplicationApproval } from "./use-card-application-approval"

export const CardProcessingScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const {
    params: { applicationId },
  } = useRoute<RouteProp<RootStackParamList, "cardOnboardingProcessingScreen">>()

  const approvalWait = useCardApplicationApproval(applicationId)
  const isWaitOver = approvalWait !== "waiting"

  const handleDone = React.useCallback(() => {
    if (approvalWait === "approved") {
      navigation.replace("cardOnboardingPreapprovedScreen")
      return
    }
    if (approvalWait === "declined") {
      navigation.replace("cardOnboardingDeclinedScreen")
      return
    }
    /** A minute without an answer leaves it to the home and a bulletin. */
    navigation.popTo("Primary")
  }, [approvalWait, navigation])

  return (
    <BusyStateScreen
      icon1={<GaloyIcon name="clock" size={CHIP_GLYPH_SIZE} color={colors.success} />}
      icon2={
        <GaloyIcon name="card" size={CHIP_GLYPH_SIZE} color={colors.textOnBackground} />
      }
      title={LL.CardFlow.Onboarding.CardProcessing.title()}
      body={LL.CardFlow.Onboarding.CardProcessing.subtitle()}
      completion={{ kind: "pending", done: isWaitOver }}
      onDone={handleDone}
    />
  )
}
