import React, { useCallback, useEffect } from "react"

import {
  RouteProp,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { CloseHeader } from "@app/components/close-header"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useTwoFactorFlowExit } from "@app/custodial/hooks/use-two-factor-flow-exit"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { testProps } from "@app/utils/testProps"

/**
 * The setup: the lock hero and the two ways forward, the same for every account and
 * every tier. An authenticator is what the account is asked for; an email or a phone
 * number added to the one it logs in with protects nothing, since an attacker who takes
 * the account over can change both. The alternative is to leave custody, through the
 * screen that explains what that means, offered only while the self-custodial stack is
 * known to be on: nothing may push the user toward it once it is switched off.
 *
 * Reached from the home card and the Settings banner, the reminder bulletin and the
 * session modal opening the authenticator onboarding directly, and closable from the
 * close control it draws, on the same margin as
 * every other screen of the two-factor flows. Leaving it without an authenticator
 * counts as the session's dismissal for the tiers that count one, reported as the
 * dismissal of the prompt that opened it. The authenticator onboarding opens above it
 * and, once done, closes back into it, which then steps aside to wherever it was opened
 * from.
 */
export const TwoFactorSetupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "twoFactorSetup">>()
  const { params } = useRoute<RouteProp<RootStackParamList, "twoFactorSetup">>()
  const isFocused = useIsFocused()
  const { hasAuthenticator, isCustodyExitOffered } = useTwoFactorEnforcement()
  /** Leaving without an authenticator is the dismissal of the prompt that opened it. The
   *  hardware back leaves the same way, and the swipe is off for this route, so no exit
   *  skips the count. */
  const { leave } = useTwoFactorFlowExit(params)

  useHardwareBackGuard(leave)

  /** The authenticator onboarding closes back into this screen. Once the account holds an
   *  authenticator there is nothing left to offer, so it steps aside rather than asking
   *  for one the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. */
  const isSetupComplete = isFocused && hasAuthenticator
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  /** The setup stays under the onboarding and the explanation, so backing out of either
   *  lands back here, and leaving the setup is what counts. */
  const handleSetAuthenticator = useCallback(() => {
    navigation.navigate("totpRegistrationIntro", {
      isOpenedFromSetupScreen: true,
      origin: params?.origin,
    })
  }, [navigation, params])

  const handleMove = useCallback(() => {
    navigation.navigate("twoFactorNonCustodial", { isOpenedFromSetupScreen: true })
  }, [navigation])

  return (
    <StepLayout
      headerShown={false}
      contentStyle={styles.content}
      header={<CloseHeader onClose={leave} testID="two-factor-setup-close" />}
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            {...testProps("two-factor-setup-authenticator")}
          />
          {isCustodyExitOffered && (
            <GaloySecondaryButton
              title={LL.AccountMigration.moveToNonCustodial()}
              onPress={handleMove}
              {...testProps("two-factor-setup-move")}
            />
          )}
        </>
      }
    >
      <IconHero
        icon="lock-closed"
        iconColor={colors._green}
        title={LL.TwoFactorEnforcement.setupTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.TwoFactorEnforcement.setupDescription()}
          </Text>
        }
      />
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  /** The gap the two-factor screens keep between the header row and the hero. */
  content: {
    paddingTop: 10,
  },
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
