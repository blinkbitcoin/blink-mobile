import React, { useCallback, useEffect, useLayoutEffect, useState } from "react"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { headerCloseControlOptions } from "@app/components/header-close-control"
import { IconHero } from "@app/components/icon-hero"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { TwoFactorMethod } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"

import { StepLayout } from "./step-layout"

const RETURN_ROUTE = RegistrationReturnRoute.TwoFactorSetup

export const TwoFactorSetupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "twoFactorSetup">>()
  const isFocused = useIsFocused()
  const { unmetTier, hasTwoFactor, missingMethod, unverifiedEmail, registerDismissal } =
    useTwoFactorEnforcement()
  /** The screen holds the user for a re-verification asked for from it, for as long
   *  as the hook runs it: the hook bounds that with its own deadline, so the hold, the
   *  spinner and the buttons release together. One joined from elsewhere, started on
   *  another screen before this one opened, only shows its spinner, since the user
   *  pressed nothing here. */
  const {
    promptReverification,
    spinner: isReverifying,
    isAskedHere: isHeld,
  } = useEmailReverification({ returnTo: RETURN_ROUTE })
  /** The tier this screen was opened for: what it reports, and what leaving it unfinished
   *  is charged to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)

  const isEmailMissing = missingMethod === TwoFactorMethod.Email
  const missingMethodTitle = isEmailMissing
    ? LL.TwoFactorEnforcement.addEmail()
    : LL.TwoFactorEnforcement.addPhoneNumber()

  /** Leaving without a factor is a dismissal for the tiers that prompt at session start;
   *  the provider ignores it below them. The hardware back leaves the same way, and the
   *  swipe is off for this route, so no exit skips the count. While held, the screen
   *  stays instead: the hook navigates to the code screen when it is done, and that
   *  must land on this screen, not on whatever lies beneath once this one is gone. The
   *  close control is greyed out meanwhile, so the refusal shows. */
  const handleClose = useCallback(() => {
    if (isHeld) return
    registerDismissal(promptTier)
    navigation.goBack()
  }, [isHeld, registerDismissal, promptTier, navigation])

  useHardwareBackGuard(handleClose)

  useLayoutEffect(() => {
    navigation.setOptions(
      headerCloseControlOptions({ onPress: handleClose, disabled: isHeld }),
    )
  }, [navigation, handleClose, isHeld])

  /** The flows this screen hands off to return into it. Once the account holds two
   *  factors there is nothing left to offer, so it steps aside rather than asking for a
   *  factor the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. And only once
   *  the hold above has lifted: the flow it holds for returns into this screen. */
  const isSetupComplete = isFocused && hasTwoFactor && !isHeld
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  /** Each flow is told to come back here when it succeeds, rather than to the
   *  destination it has on its own; this screen then steps aside to wherever it was
   *  opened from. The phone flow already pops back to its caller. */
  const handleAddMissingMethod = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: missingMethod })
    if (unverifiedEmail) {
      promptReverification(unverifiedEmail)
      return
    }
    if (isEmailMissing) {
      navigation.navigate("emailRegistrationInitiate", { returnTo: RETURN_ROUTE })
      return
    }
    navigation.navigate("phoneRegistrationInitiate")
  }, [
    navigation,
    promptTier,
    missingMethod,
    unverifiedEmail,
    promptReverification,
    isEmailMissing,
  ])

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", { returnTo: RETURN_ROUTE })
  }, [navigation, promptTier])

  return (
    <StepLayout
      footer={
        /** The authenticator is the call to action, whatever the account holds; the
         *  factor it is missing is offered underneath as the lighter alternative. */
        <>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            disabled={isReverifying}
          />
          {/** Re-verifying an email deletes it before registering it again, so the
           *   button waits for that to finish rather than let a second press start the
           *   sequence over on top of the first. */}
          <GaloySecondaryButton
            title={missingMethodTitle}
            onPress={handleAddMissingMethod}
            loading={isReverifying}
            disabled={isReverifying}
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
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
