import React, { useCallback, useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { CloseHeader } from "@app/components/close-header"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { HIGH_BALANCE_THRESHOLD } from "@app/custodial/two-factor-enforcement"
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
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
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"

import { TwoFactorSetupContent } from "./setup-content"

/** The gate stands in for the home, so its flows come back to the home. */
const GATE_RETURN_ROUTE = RegistrationReturnRoute.Primary

/** The hero names the wallet that crossed, as the title does: the warning sign for the
 *  bitcoin wallet, the dollar sign for the dollar wallet. */
const highBalanceIcon = (currency: WalletCurrency): IconNamesType =>
  currency === WalletCurrency.Usd ? "dollar" : "warning"

/** The threshold the title quotes, in the wallet that crossed it. */
const highBalanceThreshold = (currency: WalletCurrency) =>
  currency === WalletCurrency.Usd
    ? toUsdMoneyAmount(HIGH_BALANCE_THRESHOLD.usdCents)
    : toBtcMoneyAmount(HIGH_BALANCE_THRESHOLD.sats)

/**
 * The full-screen prompt of the tiers that stop asking nicely, standing in for the home
 * at the session start that owes it, so the home is never seen first. The reminder
 * tier, once its dismissals are spent, shows the setup itself with no way to close it:
 * the only exits are an authenticator or leaving custody. The high-balance tier shows the
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
  const { formatMoneyAmount } = useDisplayCurrency()
  const { unmetTier, remainingDismissals, highBalanceCurrency, registerDismissal } =
    useTwoFactorEnforcement()
  /** The gate mounts this screen anew for each tier it is raised for, so the tier it
   *  reports and charges its X to is the one it was raised for, for as long as it is
   *  open. */
  const isAuthenticatorTier = unmetTier === TwoFactorTier.HighBalance
  const isDismissible = isAuthenticatorTier && remainingDismissals > 0

  useEffect(() => {
    logTwoFactorPromptShown({
      tier: unmetTier,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
  }, [unmetTier])

  /** Charging the dismissal is what lets the home in: it takes the session start, and
   *  the screen stands in for the home only while that start is still owed. */
  const handleDismiss = useCallback(() => {
    logTwoFactorPromptDismissed({
      tier: unmetTier,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
    registerDismissal(unmetTier)
  }, [unmetTier, registerDismissal])

  /** The hardware back is the X while there is one, and nothing at all once there is
   *  none: a blocking screen swallows it rather than letting the app go. */
  useHardwareBackGuard(isDismissible ? handleDismiss : undefined)

  /** A flow started from the gate returns to the home, where the gate decides again
   *  with the factor just added. */
  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: unmetTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", { returnTo: GATE_RETURN_ROUTE })
  }, [navigation, unmetTier])

  const handleMove = useCallback(() => {
    logTwoFactorNonCustodialChosen({ tier: unmetTier })
    navigation.navigate("accountMigrationEntry")
  }, [navigation, unmetTier])

  /** The setup keeps the header row its route draws, empty: the hero then sits where
   *  it does on every other screen of the flow, instead of climbing into the gap. */
  if (!isAuthenticatorTier) {
    return (
      <TwoFactorSetupContent
        promptTier={unmetTier}
        returnTo={GATE_RETURN_ROUTE}
        headerShown={false}
        header={<CloseHeader isHidden testID="two-factor-protection-close" />}
      />
    )
  }

  return (
    <StepLayout
      headerShown={false}
      contentStyle={styles.content}
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
        icon={highBalanceIcon(highBalanceCurrency)}
        iconColor={colors.primary}
        title={LL.TwoFactorEnforcement.highBalanceTitle({
          amount: formatMoneyAmount({
            moneyAmount: highBalanceThreshold(highBalanceCurrency),
            noFractionDigits: true,
          }),
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
  content: {
    paddingTop: 10,
  },
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
