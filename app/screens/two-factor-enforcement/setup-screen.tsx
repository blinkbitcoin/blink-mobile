import React, { useCallback, useEffect, useLayoutEffect, useState } from "react"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { headerCloseControlOptions } from "@app/components/header-close-control"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { TwoFactorMethod } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

/**
 * The setup: the lock hero and the two ways forward, the same for every account and
 * every tier. An authenticator is what the account is asked for; an email or a phone
 * number added to the one it logs in with protects nothing, since an attacker who takes
 * the account over can change both. The alternative is to leave custody, through the
 * screen that explains what that means.
 *
 * Reached from the home card, the reminder bulletin, the Settings banner and the
 * session modal, and closable from its header. Leaving it without an authenticator
 * counts as the session's dismissal for the tiers that count one. The authenticator
 * flow returns into it on success, and it then steps aside to wherever it was opened
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
  const isFocused = useIsFocused()
  const { unmetTier, hasAuthenticator, registerDismissal } = useTwoFactorEnforcement()
  /** The tier this screen was opened for: what it reports, and what leaving it unfinished
   *  is charged to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)

  /** Leaving without an authenticator is a dismissal for the tiers that count one; the
   *  provider ignores it below them. The hardware back leaves the same way, and the
   *  swipe is off for this route, so no exit skips the count. */
  const handleClose = useCallback(() => {
    registerDismissal(promptTier)
    navigation.goBack()
  }, [registerDismissal, promptTier, navigation])

  useHardwareBackGuard(handleClose)

  useLayoutEffect(() => {
    navigation.setOptions(headerCloseControlOptions({ onPress: handleClose }))
  }, [navigation, handleClose])

  /** The authenticator flow returns into this screen. Once the account holds an
   *  authenticator there is nothing left to offer, so it steps aside rather than asking
   *  for one the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. */
  const isSetupComplete = isFocused && hasAuthenticator
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", {
      returnTo: RegistrationReturnRoute.TwoFactorSetup,
    })
  }, [navigation, promptTier])

  /** The setup stays under the explanation, so backing out of it lands back here. */
  const handleMove = useCallback(() => {
    navigation.navigate("twoFactorNonCustodial", { isFromSetup: true })
  }, [navigation])

  return (
    <StepLayout
      contentStyle={styles.content}
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            {...testProps("two-factor-setup-authenticator")}
          />
          <GaloySecondaryButton
            title={LL.AccountMigration.moveToNonCustodial()}
            onPress={handleMove}
            {...testProps("two-factor-setup-move")}
          />
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
