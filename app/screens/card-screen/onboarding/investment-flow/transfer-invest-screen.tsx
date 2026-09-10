import * as React from "react"
import { ScrollView, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  formatUnitCount,
  formatUsdAmount,
  resolveInvestmentTerms,
} from "./investment-terms"
import { useInvestmentFunding } from "./use-investment-funding"
import { useInvestmentInvoice } from "./use-investment-invoice"

type TransferInvestRoute = RouteProp<
  RootStackParamList,
  "cardOnboardingTransferInvestScreen"
>

export const TransferInvestScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const { selectedAmountUsd, settlementSats } = useRoute<TransferInvestRoute>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const terms = React.useMemo(
    () => resolveInvestmentTerms(selectedAmountUsd),
    [selectedAmountUsd],
  )

  const { cardInvestmentDepositBtcWalletId } = useRemoteConfig()
  const { hasEnoughBalance, isLoading, totalSats } = useInvestmentFunding(terms.totalUsd)
  const { requestInvoice, isRequesting } = useInvestmentInvoice()
  const [hasInvoiceFailed, setHasInvoiceFailed] = React.useState(false)

  /**
   * What the invoice is written for: the satoshis the agreement itself names.
   *
   * The rate was fixed when the investor signed, so converting the dollars again now
   * would charge a different amount of bitcoin than the document says - less if the price
   * rose, more if it fell. The conversion below only stands in while the signing step has
   * no figure to carry, which is until the mint returns the terms it computed.
   */
  const owedSats = settlementSats ?? totalSats

  /**
   * Where the money goes, or the shortfall screen when there is not enough to send.
   *
   * The send flow is opened on an invoice rather than on the receiving account, because
   * an invoice carries its amount: an account alone would let the investor send any sum
   * against an agreement that names one.
   */
  const handleNext = async () => {
    if (!hasEnoughBalance) {
      navigation.navigate("cardOnboardingInsufficientBalanceScreen", {
        selectedAmountUsd,
      })
      return
    }

    setHasInvoiceFailed(false)
    const minted = await requestInvoice(cardInvestmentDepositBtcWalletId, owedSats)

    if (!minted) {
      setHasInvoiceFailed(true)
      return
    }

    navigation.navigate("sendBitcoinDestination", { payment: minted.paymentRequest })
  }

  /**
   * Pressing before the balance is known would send the investor to the shortfall screen
   * on a balance of zero. Pressing with the money ready but no wallet configured would
   * ask for an invoice from nowhere; the shortfall path needs none, so it stays reachable
   * either way.
   */
  const isMissingDepositWallet = hasEnoughBalance && !cardInvestmentDepositBtcWalletId
  const isContinueDisabled = isLoading || isMissingDepositWallet

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="transfer-invest-close" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="send"
          iconColor={colors.black}
          title={LL.CardFlow.Onboarding.TransferInvest.title()}
        />

        <View style={styles.content}>
          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.TransferInvest.paragraphs.body1({
              units: formatUnitCount(terms.units),
            })}
          </Text>

          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.TransferInvest.paragraphs.body2({
              amount: formatUsdAmount(terms.totalUsd),
            })}
          </Text>

          {/* Borrowed from the receive screen, which words this exact failure and is
              already translated everywhere. The flow gets its own key if the wording
              ever has to differ. */}
          {hasInvoiceFailed ? (
            <Text type="p2" style={styles.errorText}>
              {LL.ReceiveScreen.error()}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.TransferInvest.buttonText()}
          disabled={isContinueDisabled}
          loading={isRequesting}
          onPress={handleNext}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 40,
  },
  content: {
    marginTop: 20,
    gap: 22,
  },
  bodyText: {
    lineHeight: 22,
    textAlign: "left",
    width: "100%",
  },
  errorText: {
    color: colors.error,
    lineHeight: 22,
    textAlign: "left",
    width: "100%",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
