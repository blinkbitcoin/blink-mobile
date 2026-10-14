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
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
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

import { StepLayout } from "./step-layout"

const SATS_CODE = "SAT"
const CENTS_PER_DOLLAR = 100

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
 * The full-screen prompt of the tiers that stop asking nicely: the required tier once
 * its dismissals are spent, and the authenticator tier from its first session. It
 * stands in for the home at the session start that owes it, so the home is never seen
 * first, and offers exactly two ways forward. While the authenticator tier still has
 * dismissals left it also offers an X; otherwise there is no header, no gesture and no
 * hardware back, so the only exits are the two buttons.
 */
export const TwoFactorProtectionRequiredScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const {
    unmetTier,
    remainingDismissals,
    highBalanceCurrency,
    registerDismissal,
    consumeSessionStart,
  } = useTwoFactorEnforcement()
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

  /** Charging the dismissal and taking the session start is what lets the home in: the
   *  screen stands in for the home only while that start is still owed. */
  const handleDismiss = useCallback(() => {
    logTwoFactorPromptDismissed({
      tier: promptTier,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
    registerDismissal(promptTier)
    consumeSessionStart()
  }, [promptTier, registerDismissal, consumeSessionStart])

  /** The hardware back is the X while there is one, and nothing at all once there is
   *  none: a blocking screen swallows it rather than letting the app go. */
  useHardwareBackGuard(isDismissible ? handleDismiss : undefined)

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate")
  }, [navigation, promptTier])

  const handleMove = useCallback(() => {
    logTwoFactorNonCustodialChosen({ tier: promptTier })
    navigation.navigate("accountMigrationEntry")
  }, [navigation, promptTier])

  const highBalancePresentation = {
    icon: "dollar" as const,
    iconColor: colors.primary,
    title: LL.TwoFactorEnforcement.highBalanceTitle({
      amount: formatHighBalanceAmount(highBalanceCurrency),
    }),
  }
  const requiredPresentation = {
    icon: "warning" as const,
    iconColor: colors.warning,
    title: LL.TwoFactorEnforcement.protectionRequiredTitle(),
  }
  const presentation = isAuthenticatorTier
    ? highBalancePresentation
    : requiredPresentation

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
        icon={presentation.icon}
        iconColor={presentation.iconColor}
        title={presentation.title}
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
