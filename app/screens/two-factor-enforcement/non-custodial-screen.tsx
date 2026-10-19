import React, { useCallback, useEffect, useState } from "react"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { CloseHeader } from "@app/components/close-header"
import { IconHero } from "@app/components/icon-hero"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { TwoFactorPrompt } from "@app/types/two-factor-enforcement"
import {
  logTwoFactorNonCustodialChosen,
  logTwoFactorPromptShown,
} from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

import { StepLayout } from "@app/components/step-layout"

export const TwoFactorNonCustodialScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "twoFactorNonCustodial">
    >()
  const { params } = useRoute<RouteProp<RootStackParamList, "twoFactorNonCustodial">>()
  const isFromSetup = params?.isFromSetup ?? false
  const { unmetTier, registerDismissal } = useTwoFactorEnforcement()
  /** The tier this screen was opened for: what it reports, and what backing out of it
   *  is charged to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)
  /** The prompt that opened it, whose dismissal backing out is. */
  const [origin] = useState(params?.origin)

  useEffect(() => {
    logTwoFactorPromptShown({
      tier: promptTier,
      prompt: TwoFactorPrompt.NonCustodialScreen,
    })
  }, [promptTier])

  /** Backing out here, by Cancel, the X or the hardware back, is the dismissal the modal
   *  deferred. The swipe is off for this route, so no exit skips the count. Opened from
   *  the setup, it only returns there: the setup is still up, and leaving it is what
   *  counts. */
  const handleCancel = useCallback(() => {
    if (!isFromSetup) registerDismissal(promptTier, origin)
    navigation.goBack()
  }, [isFromSetup, registerDismissal, promptTier, origin, navigation])

  useHardwareBackGuard(handleCancel)

  const handleMove = useCallback(() => {
    logTwoFactorNonCustodialChosen({ tier: promptTier })
    navigation.navigate("accountMigrationEntry")
  }, [navigation, promptTier])

  return (
    <StepLayout
      headerShown={false}
      contentStyle={styles.content}
      header={
        <CloseHeader onClose={handleCancel} testID="two-factor-non-custodial-close" />
      }
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.AccountMigration.moveToNonCustodial()}
            onPress={handleMove}
            {...testProps("two-factor-non-custodial-move")}
          />
          <GaloySecondaryButton
            title={LL.common.cancel()}
            onPress={handleCancel}
            {...testProps("two-factor-non-custodial-cancel")}
          />
        </>
      }
    >
      <IconHero
        icon="key-outline"
        iconColor={colors._green}
        title={LL.TwoFactorEnforcement.nonCustodialTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.TwoFactorEnforcement.nonCustodialBody()}
          </Text>
        }
      />
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingTop: 10,
  },
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
