import * as React from "react"
import { ActivityIndicator, View } from "react-native"
import { WebView } from "react-native-webview"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  createPublicUrlSource,
  getErrorMessage,
  useESignature,
} from "@blinkbitcoin/esign-react-native/webform"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { ESIGN_ALLOWED_ORIGIN } from "@app/config"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logError } from "@app/utils/log-error"

import { buildESignFormUrl } from "./esign-form-url"
import {
  resolveInvestmentTerms,
  resolveSettlementQuote,
  type SettlementQuote,
} from "./investment-terms"

type SignInvestRoute = RouteProp<RootStackParamList, "cardOnboardingSignInvestScreen">

/** Offline is a status of its own, not an error, so it carries no code. This is the one
 *  the library words as a lost connection, which is what the signer is looking at. */
const OFFLINE_MESSAGE_CODE = "NETWORK_ERROR"

/**
 * How long the step waits on the price before opening the form without it.
 *
 * The form is opened with the figures as they stand at that moment and keeps them for the
 * rest of the session, so opening before the feed answers signs an agreement with no rate,
 * no settlement and no stamp. Long enough for a feed that is merely slow; short enough
 * that one which never answers does not strand the step, which the three figures being
 * optional is what allows.
 */
const PRICE_GRACE_MS = 5000

/**
 * The signing step between the Term Sheet and the transfer: the subscription
 * agreement is signed on a published DocuSign Web Form embedded here. Signing
 * advances to the transfer step; cancelling or declining returns to the Term Sheet,
 * which is where the signer chose to start. A failure stays put, so the retry below
 * is reachable.
 *
 * Driven headless, with the library's own screens left out: the signer already chose
 * to sign on the Term Sheet, so a second "Sign Document" gate asks the same question
 * twice. The session starts as the screen opens and the form is what the signer sees.
 *
 * Needs cardInvestmentEsignFormUrl set in remote config: with no form to embed the
 * session cannot start and the step has no way forward, so the flow must not ship
 * without it.
 */
export const SignInvestScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { cardInvestmentEsignFormUrl } = useRemoteConfig()
  const { usdPerSat } = usePriceConversion()
  const { selectedAmountUsd } = useRoute<SignInvestRoute>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Replaces rather than pushes: the agreement cannot be unsigned, so leaving this
   *  screen behind would let a back swipe land on a finished session with no way on. */
  const goToTransfer = React.useCallback(
    () => navigation.replace("cardOnboardingTransferInvestScreen", { selectedAmountUsd }),
    [navigation, selectedAmountUsd],
  )

  const goBack = React.useCallback(() => navigation.goBack(), [navigation])

  /** Stays on the screen on purpose: the retry below is what a failed session needs, and
   *  navigating away would tear it down. Leaving is the close button's job. */
  const reportSigningError = React.useCallback(
    (error: { code: string; message: string }) =>
      logError({
        scope: "card-investment-esign",
        error: new Error(error.message),
        context: { code: error.code },
      }),
    [],
  )

  /**
   * Taken once, from the first price that answers, and then held for the rest of the visit.
   *
   * The price feed polls, and following it would rewrite the form's url on every tick,
   * restarting the signing session, possibly mid-signature. It would also be wrong on its
   * own terms: the agreement fixes one rate, at one stamped moment, and owes the payment
   * against that.
   */
  const [settlement, setSettlement] = React.useState<SettlementQuote | null>(null)
  React.useEffect(() => {
    if (settlement) return

    const quote = resolveSettlementQuote(usdPerSat, new Date())
    if (quote) setSettlement(quote)
  }, [usdPerSat, settlement])

  /** Rebuilt only when the form, the amount or the rate changes: a new source on every
   *  render would restart the signing session. */
  const source = React.useMemo(
    () =>
      createPublicUrlSource({
        url: buildESignFormUrl(
          cardInvestmentEsignFormUrl,
          resolveInvestmentTerms(selectedAmountUsd, settlement),
        ),
        allowedOrigin: ESIGN_ALLOWED_ORIGIN,
      }),
    [cardInvestmentEsignFormUrl, selectedAmountUsd, settlement],
  )

  const {
    status,
    error,
    isSessionExpired,
    isCheckingConnection,
    sign,
    retry,
    restart,
    checkConnection,
    webViewProps,
  } = useESignature({
    source,
    onComplete: goToTransfer,
    onCancel: goBack,
    onError: reportSigningError,
  })

  const [hasWaitedForPrice, setHasWaitedForPrice] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => setHasWaitedForPrice(true), PRICE_GRACE_MS)

    return () => clearTimeout(timer)
  }, [])

  const isPriceSettled = settlement !== null || hasWaitedForPrice

  /**
   * Opens the form once the agreement's figures are settled. Idle is also where a retry
   * and a recovered connection land, so each of those starts the session again without a
   * second tap.
   *
   * Started once per stay in idle, which the flag is for: `sign` is rebuilt whenever the
   * source is, and the price arriving while the first call is still checking connectivity
   * would otherwise fire a second session on top of it. Leaving idle clears the flag, so
   * the retry and the recovered connection still start one.
   */
  const hasStartedFromIdle = React.useRef(false)
  React.useEffect(() => {
    if (status !== "idle") {
      hasStartedFromIdle.current = false
      return
    }

    if (!isPriceSettled || hasStartedFromIdle.current) return

    hasStartedFromIdle.current = true
    sign()
  }, [status, sign, isPriceSettled])

  /** An expired session keeps its envelope, so it is restarted rather than retried: a
   *  retry would drop what the signer already filled in. */
  const recoverFromFailure = isSessionExpired ? restart : retry

  if (status === "signing" && webViewProps) {
    return (
      <Screen headerShown={false}>
        <CloseHeader testID="sign-invest-close" />
        {/* The embedded form paints its own white surface edge to edge, so without a
            gap it butts straight up against the close control. The other screens in
            the flow have their own top spacing and need none. */}
        <View style={styles.content}>
          <WebView
            {...webViewProps}
            style={styles.webview}
            testID="sign-invest-webview"
          />
        </View>
      </Screen>
    )
  }

  /** Everything shown while the form is not: the same chrome, centred on one message. */
  const centredOnScreen = (body: React.ReactNode) => (
    <Screen headerShown={false}>
      <CloseHeader testID="sign-invest-close" />
      <View style={styles.centered}>{body}</View>
    </Screen>
  )

  /** The status is the library's, so the wording of a failure is too. Only the title and
   *  the button are the app's, which is as far as translation reaches today. */
  const failure = (message: string, action: React.ReactNode) => (
    <>
      <Text type="p1" style={styles.statusTitle}>
        {LL.common.error()}
      </Text>
      <Text type="p2" style={styles.statusMessage}>
        {message}
      </Text>
      {action}
    </>
  )

  if (status === "offline") {
    return centredOnScreen(
      failure(
        getErrorMessage(OFFLINE_MESSAGE_CODE),
        <GaloyPrimaryButton
          title={LL.common.tryAgain()}
          loading={isCheckingConnection}
          onPress={checkConnection}
        />,
      ),
    )
  }

  if (status === "error") {
    return centredOnScreen(
      failure(
        getErrorMessage(error?.code ?? "", error?.message),
        <GaloyPrimaryButton title={LL.common.tryAgain()} onPress={recoverFromFailure} />,
      ),
    )
  }

  return centredOnScreen(
    <ActivityIndicator
      size="large"
      color={colors.primary}
      testID="sign-invest-loading"
    />,
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    flex: 1,
    paddingTop: 12,
  },
  webview: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  statusTitle: {
    color: colors.error,
    textAlign: "center",
  },
  statusMessage: {
    color: colors.grey1,
    textAlign: "center",
    marginBottom: 8,
  },
}))
