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
import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { TwoFactorMethod, TwoFactorPrompt } from "@app/types/two-factor-enforcement"
import {
  logTwoFactorNonCustodialChosen,
  logTwoFactorPromptShown,
  logTwoFactorSetupStarted,
} from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

/** The gate stands in for the home, so its flows come back to the home. */
const GATE_RETURN_ROUTE = RegistrationReturnRoute.Primary

/** The hero names the wallet that crossed, as the title does: the warning sign for the
 *  bitcoin wallet, the dollar sign for the dollar wallet. */
const highBalanceIcon = (currency: WalletCurrency): IconNamesType =>
  currency === WalletCurrency.Usd ? "dollar" : "warning"

/** The threshold the title quotes, as an amount of the wallet that crossed it. */
const highBalanceAmount = (currency: WalletCurrency, threshold: number) =>
  currency === WalletCurrency.Usd
    ? toUsdMoneyAmount(threshold)
    : toBtcMoneyAmount(threshold)

/**
 * The blocking screen of the high-balance tier, standing in for the home at every
 * session start once the tier's modal has spent its dismissals, so the home is never
 * seen first. It names the threshold of the wallet that crossed it while that wallet
 * still holds it, and offers two ways forward, an authenticator or leaving custody, with
 * no close control: it takes neither the swipe nor the hardware back. Only this tier
 * blocks. It stands only while the self-custodial stack is known to be on; otherwise
 * the modal stays in its place, and should the stack go off while it is up, its move
 * goes with it.
 */
export const TwoFactorProtectionRequiredScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { formatMoneyAmount } = useDisplayCurrency()
  const {
    unmetTier,
    highBalanceCurrency,
    highBalanceThreshold,
    isHoldingHighBalance,
    isCustodyExitOffered,
  } = useTwoFactorEnforcement()

  useEffect(() => {
    logTwoFactorPromptShown({
      tier: unmetTier,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
  }, [unmetTier])

  /** No handler: a blocking screen swallows the hardware back rather than letting the
   *  app go. */
  useHardwareBackGuard(undefined)

  /** A flow started from the gate returns to the home, where the gate decides again
   *  with the authenticator just added. */
  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: unmetTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", {
      returnTo: GATE_RETURN_ROUTE,
      prompt: TwoFactorPrompt.ProtectionRequiredScreen,
    })
  }, [navigation, unmetTier])

  const handleMove = useCallback(() => {
    logTwoFactorNonCustodialChosen({ tier: unmetTier })
    navigation.navigate("accountMigrationEntry")
  }, [navigation, unmetTier])

  /** The amount is stated only while the account still holds it: the tier stays once
   *  reached, and a title that claims a balance the account no longer has is wrong. */
  const title = isHoldingHighBalance
    ? LL.TwoFactorEnforcement.highBalanceTitle({
        amount: formatMoneyAmount({
          moneyAmount: highBalanceAmount(highBalanceCurrency, highBalanceThreshold),
          noFractionDigits: true,
        }),
      })
    : LL.TwoFactorEnforcement.protectionRequiredTitle()

  /** The header row is kept, empty, so the hero sits where it does on every other
   *  screen of the flow instead of climbing into the gap. */
  return (
    <StepLayout
      headerShown={false}
      contentStyle={styles.content}
      header={<CloseHeader isHidden testID="two-factor-protection-close" />}
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            {...testProps("two-factor-protection-authenticator")}
          />
          {isCustodyExitOffered && (
            <GaloySecondaryButton
              title={LL.AccountMigration.moveToNonCustodial()}
              onPress={handleMove}
              {...testProps("two-factor-protection-move")}
            />
          )}
        </>
      }
    >
      <IconHero
        icon={highBalanceIcon(highBalanceCurrency)}
        iconColor={colors.primary}
        title={title}
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
