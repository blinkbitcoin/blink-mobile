import React, { useCallback, useEffect, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { CloseHeader } from "@app/components/close-header"
import { IconHero } from "@app/components/icon-hero"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { AUTHENTICATOR_THRESHOLD } from "@app/custodial/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import { formatCurrencyHelper, usdDisplayCurrency } from "@app/hooks/use-display-currency"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import {
  TwoFactorMethod,
  TwoFactorPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
import {
  logTwoFactorNonCustodialChosen,
  logTwoFactorPromptDismissed,
  logTwoFactorPromptShown,
  logTwoFactorSetupStarted,
} from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

import { TwoFactorSetupContent } from "./setup-content"
import { StepLayout } from "./step-layout"

const SATS_CODE = "SAT"
const CENTS_PER_DOLLAR = 100
/** The gate stands in for the home, so its flows come back to the home. */
const GATE_RETURN_ROUTE = RegistrationReturnRoute.Primary

/** The threshold the title quotes, in the wallet that crossed it: "5,000,000 SAT" or
 *  "$5,000", whole units only. */
const formatHighBalanceAmount = (currency: WalletCurrency): string => {
  if (currency === WalletCurrency.Usd) {
    return formatCurrencyHelper({
      amountInMajorUnits: AUTHENTICATOR_THRESHOLD.usdCents / CENTS_PER_DOLLAR,
      symbol: usdDisplayCurrency.symbol,
      fractionDigits: 0,
    })
  }
  return formatCurrencyHelper({
    amountInMajorUnits: AUTHENTICATOR_THRESHOLD.sats,
    symbol: "",
    fractionDigits: 0,
    currencyCode: SATS_CODE,
  })
}

/**
 * The full-screen prompt of the tiers that stop asking nicely, standing in for the home
 * at the session start that owes it, so the home is never seen first. The required
 * tier, once its dismissals are spent, shows the setup itself with no way to close it:
 * the only exits are the factors it offers. The authenticator tier shows the
 * high-balance screen, with an X while it still has dismissals left and none after, and
 * offers exactly two ways forward. Neither takes the swipe or the hardware back.
 */
export const TwoFactorProtectionRequiredScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { unmetTier, remainingDismissals, highBalanceCurrency, registerDismissal } =
    useTwoFactorEnforcement()
  const { promptReverification, spinner: isReverifying } = useEmailReverification({
    returnTo: GATE_RETURN_ROUTE,
  })
  /** The tier this screen was raised for: what it reports, and what its X is charged
   *  to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)

  const isAuthenticatorTier = promptTier === TwoFactorTier.Authenticator
  const isDismissible = isAuthenticatorTier && remainingDismissals > 0

  useEffect(() => {
    logTwoFactorPromptShown({
      tier: promptTier,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
  }, [promptTier])

  /** Charging the dismissal is what lets the home in: it takes the session start, and
   *  the screen stands in for the home only while that start is still owed. */
  const handleDismiss = useCallback(() => {
    logTwoFactorPromptDismissed({
      tier: promptTier,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
    registerDismissal(promptTier)
  }, [promptTier, registerDismissal])

  /** The hardware back is the X while there is one, and nothing at all once there is
   *  none: a blocking screen swallows it rather than letting the app go. */
  useHardwareBackGuard(isDismissible ? handleDismiss : undefined)

  /** A flow started from the gate returns to the home, where the gate decides again
   *  with the factor just added. */
  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", { returnTo: GATE_RETURN_ROUTE })
  }, [navigation, promptTier])

  const handleMove = useCallback(() => {
    logTwoFactorNonCustodialChosen({ tier: promptTier })
    navigation.navigate("accountMigrationEntry")
  }, [navigation, promptTier])

  /** The setup keeps the header row its route draws, empty: the hero then sits where
   *  it does on every other screen of the flow, instead of climbing into the gap. */
  if (!isAuthenticatorTier) {
    return (
      <TwoFactorSetupContent
        promptTier={promptTier}
        returnTo={GATE_RETURN_ROUTE}
        promptReverification={promptReverification}
        isReverifying={isReverifying}
        headerShown={false}
        header={<CloseHeader isHidden testID="two-factor-protection-close" />}
      />
    )
  }

  return (
    <StepLayout
      headerShown={false}
      header={
        <CloseHeader
          onClose={handleDismiss}
          isHidden={!isDismissible}
          testID="two-factor-protection-close"
        />
      }
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            {...testProps("two-factor-protection-authenticator")}
          />
          <GaloySecondaryButton
            title={LL.AccountMigration.moveToNonCustodial()}
            onPress={handleMove}
            {...testProps("two-factor-protection-move")}
          />
        </>
      }
    >
      <IconHero
        icon="dollar"
        iconColor={colors.primary}
        title={LL.TwoFactorEnforcement.highBalanceTitle({
          amount: formatHighBalanceAmount(highBalanceCurrency),
        })}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.TwoFactorEnforcement.protectionRequiredBody()}
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
