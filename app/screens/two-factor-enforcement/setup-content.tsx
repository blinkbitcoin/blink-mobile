import React, { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

import { StepLayout } from "@app/components/step-layout"

type TwoFactorSetupContentProps = {
  /** The tier the setup was raised for: what the authenticator flow is reported under. */
  promptTier: TwoFactorTier
  /** Where the authenticator flow returns on success, rather than to the destination it
   *  has on its own: the screen this content is shown on, which carries on from there. */
  returnTo: RegistrationReturnRoute
  /** Whether the navigation header, and the close control it carries, is drawn. */
  headerShown?: boolean
  /** A row drawn in place of the navigation header, so a headerless use keeps the
   *  layout of one with a header. */
  header?: React.ReactNode
}

/**
 * The setup itself: the lock hero and the two ways forward, the same for every account
 * and every tier. An authenticator is what the account is asked for; an email or a
 * phone number added to the one it logs in with protects nothing, since an attacker who
 * takes the account over can change both. The alternative is to leave custody, and it
 * goes through the screen that explains what that means. The route shows the setup
 * under a header with a close control; the session gate shows it bare, with no way to
 * close it, once the reminder tier has spent its dismissals.
 */
export const TwoFactorSetupContent: React.FC<TwoFactorSetupContentProps> = ({
  promptTier,
  returnTo,
  headerShown,
  header,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", { returnTo })
  }, [navigation, promptTier, returnTo])

  const handleMove = useCallback(() => {
    navigation.navigate("twoFactorNonCustodial")
  }, [navigation])

  return (
    <StepLayout
      headerShown={headerShown}
      header={header}
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
