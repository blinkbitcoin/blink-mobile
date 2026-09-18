import * as React from "react"
import { ScrollView, View } from "react-native"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RESET_TO_HOME } from "@app/navigation/reset-to-home"
import { isCardInvestmentCurrent } from "@app/store/persistent-state/card-investment"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { formatUnitCount, formatUsdAmount } from "./investment-figures"
import { resolveInvestmentTerms } from "./investment-terms"
import { useInvestmentFunding, useInvestmentSats } from "./use-investment-funding"
import { isInvoiceReusable, useInvestmentInvoice } from "./use-investment-invoice"

type TransferInvestRoute = RouteProp<
  RootStackParamList,
  "cardOnboardingTransferInvestScreen"
>

/**
 * The stack an investor who has signed lands on: the home and this step, nothing else.
 * Every screen of the flow left underneath would be a way to sign a second agreement,
 * and back from here belongs on the home, where the bulletin points at the payment.
 * Built here, by the step it leads to, so the signing step and every re-entry into the
 * flow rebuild the same stack.
 */
export const resetToTransferStep = (
  params: RootStackParamList["cardOnboardingTransferInvestScreen"],
) =>
  CommonActions.reset({
    index: 1,
    routes: [{ name: "Primary" }, { name: "cardOnboardingTransferInvestScreen", params }],
  })

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
  const { progress, recordInvoice, isEligible, accountId, isAccountResolved } =
    useCardInvestmentProgress()
  /** The satoshis the agreement names, from the route or the signed record: the debt
   *  the balance is measured against, and the figure the invoice is written for. */
  const signedSats = settlementSats ?? progress?.settlementSats
  const { hasEnoughBalance, balanceWalletId, isLoading } = useInvestmentFunding(
    terms.totalUsd,
    signedSats,
  )
  const totalSats = useInvestmentSats(terms.totalUsd)
  const { requestInvoice, isRequesting } = useInvestmentInvoice()
  const [hasInvoiceFailed, setHasInvoiceFailed] = React.useState(false)

  /**
   * This step can be reached by link, with an amount in it, and it would issue an
   * invoice for that amount with no agreement behind it. An account that cannot take
   * part in the investment is sent home before it can, and so is one with no signed
   * agreement on record: a record that lapsed with the step open would otherwise let an
   * invoice be minted and paid with nothing left to record the payment on. The record is
   * only read once the account is known, since until then there is none to read. This
   * catches the lapse on the next render; the tap itself checks the clock again below.
   */
  const hasNothingToPayFor = isAccountResolved && !progress
  const isLeavingFlow = !isEligible || hasNothingToPayFor
  React.useEffect(() => {
    if (isLeavingFlow) navigation.dispatch(RESET_TO_HOME)
  }, [isLeavingFlow, navigation])

  /**
   * What the invoice is written for: the satoshis the agreement itself names, carried
   * here from the step that minted it, or read back from the signed record when the
   * route came without them (a return from the home, or from a conversion).
   *
   * The rate was fixed when the agreement was minted, so converting the dollars again now
   * would charge a different amount of bitcoin than the document says: less if the price
   * rose, more if it fell. The conversion only stands in when no figure exists anywhere,
   * so the investor is still billed rather than sent on with nothing.
   */
  const owedSats = signedSats ?? totalSats

  /**
   * Where the money goes, or the shortfall screen when there is not enough to send.
   *
   * The send flow is opened on an invoice rather than on the receiving account, because
   * an invoice carries its amount: an account alone would let the investor send any sum
   * against an agreement that names one. It is opened on the wallet judged to cover the
   * investment, too: left to its own default the flow may pick the other wallet and turn
   * away a payment this step just said could be made.
   */
  const handleNext = async () => {
    /** The record was read at render; a tap after its day is out would mint and pay on
     *  a record the receipt can no longer find, so the clock is read again here. */
    if (!progress || !isCardInvestmentCurrent(progress, Date.now())) {
      navigation.dispatch(RESET_TO_HOME)
      return
    }

    if (!hasEnoughBalance) {
      navigation.navigate("cardOnboardingInsufficientBalanceScreen", {
        selectedAmountUsd,
      })
      return
    }

    setHasInvoiceFailed(false)
    const paymentRequest = await resolvePaymentRequest()

    /** The investor may have closed the step while the invoice was being issued; a send
     *  flow opened over whatever they moved on to would be neither expected nor safe. */
    if (!navigation.isFocused()) return

    if (!paymentRequest) {
      setHasInvoiceFailed(true)
      return
    }

    navigation.navigate("sendBitcoinDestination", {
      payment: paymentRequest,
      sendingWalletId: balanceWalletId,
    })
  }

  /**
   * The invoice to pay: the one already issued for this investment while it can still be
   * paid, a fresh one otherwise. A payment that went through without the receipt ever
   * recording it (the app killed with the payment in flight) leaves the home asking for
   * the money again; paying the same invoice then meets a claim the recipient has already
   * settled, where a fresh one would be paid a second time.
   */
  async function resolvePaymentRequest(): Promise<string | null> {
    const issued = progress?.invoice
    if (issued && isInvoiceReusable(issued.issuedAt, Date.now())) {
      return issued.paymentRequest
    }

    const minted = await requestInvoice(cardInvestmentDepositBtcWalletId, owedSats, {
      accountId,
      amountUsd: selectedAmountUsd,
    })
    if (!minted) return null
    recordInvoice(minted.paymentRequest)
    return minted.paymentRequest
  }

  /**
   * Pressing before the balance is known would send the investor to the shortfall screen
   * on a balance of zero. Pressing with the money ready but no wallet configured would
   * ask for an invoice from nowhere; the shortfall path needs none, so it stays reachable
   * either way. The missing wallet is said out loud: a button that stays grey with the
   * money in place, and nothing to explain it, reads as the app being broken. The paying
   * account is waited on the same way, and only on the send path, since the invoice is
   * filed under it; the home has usually read it already, so the wait is the cache's.
   */
  const isMissingDepositWallet = hasEnoughBalance && !cardInvestmentDepositBtcWalletId
  const isMissingPayerAccount = hasEnoughBalance && !isAccountResolved
  const isContinueDisabled = isLoading || isMissingDepositWallet || isMissingPayerAccount

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

          {isMissingDepositWallet ? (
            <Text type="p2" style={styles.errorText}>
              {LL.CardFlow.Onboarding.TransferInvest.paymentsUnavailable()}
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
