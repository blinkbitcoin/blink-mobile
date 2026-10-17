import React, { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"

import { StepLayout } from "@app/components/step-layout"

type TwoFactorSetupContentProps = {
  /** The tier the setup was raised for: what every flow it starts is reported under. */
  promptTier: TwoFactorTier
  /** Where each flow returns on success, rather than to the destination it has on its
   *  own: the screen this content is shown on, which then carries on from there. */
  returnTo: RegistrationReturnRoute
  /** Re-verification of an address the account holds but never verified. The screen
   *  owns it so it can hold its own exits while the sequence runs, and tells it where
   *  the code screen returns. */
  promptReverification: (email: string) => void
  isReverifying: boolean
  /** Whether the navigation header, and the close control it carries, is drawn. */
  headerShown?: boolean
  /** A row drawn in place of the navigation header, so a headerless use keeps the
   *  layout of one with a header. */
  header?: React.ReactNode
}

/**
 * The setup itself: the lock hero and the two ways to add a factor. The route shows it
 * under a header with a close control; the session gate shows it bare, with no way to
 * close it, once the recommended tier has spent its dismissals.
 */
export const TwoFactorSetupContent: React.FC<TwoFactorSetupContentProps> = ({
  promptTier,
  returnTo,
  promptReverification,
  isReverifying,
  headerShown,
  header,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { missingMethod, unverifiedEmail } = useTwoFactorEnforcement()

  const isEmailMissing = missingMethod === TwoFactorMethod.Email
  const missingMethodTitle = isEmailMissing
    ? LL.TwoFactorEnforcement.addEmail()
    : LL.TwoFactorEnforcement.addPhoneNumber()

  /** Each flow is told where to come back to when it succeeds. The phone flow already
   *  pops back to its caller. */
  const handleAddMissingMethod = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: missingMethod })
    if (unverifiedEmail) {
      promptReverification(unverifiedEmail)
      return
    }
    if (isEmailMissing) {
      navigation.navigate("emailRegistrationInitiate", { returnTo })
      return
    }
    navigation.navigate("phoneRegistrationInitiate")
  }, [
    navigation,
    promptTier,
    returnTo,
    missingMethod,
    unverifiedEmail,
    promptReverification,
    isEmailMissing,
  ])

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", { returnTo })
  }, [navigation, promptTier, returnTo])

  return (
    <StepLayout
      headerShown={headerShown}
      header={header}
      contentStyle={styles.content}
      footer={
        /** The authenticator is the call to action, whatever the account holds; the
         *  factor it is missing is offered underneath as the lighter alternative. Both
         *  wait while a re-verification runs: it deletes the address before registering
         *  it again, and a second press must not start that over on top of the first. */
        <>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            disabled={isReverifying}
          />
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
  /** The gap the two-factor screens keep between the header row and the hero. */
  content: {
    paddingTop: 10,
  },
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
