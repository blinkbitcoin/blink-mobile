import * as React from "react"
import { ActivityIndicator, View } from "react-native"
import { WebView, WebViewMessageEvent } from "react-native-webview"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  createHostedFormSource,
  getErrorMessage,
  useESignature,
} from "@blinkbitcoin/esign-react-native/webform"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logError } from "@app/utils/log-error"

import { mintSigningInstance, resolveMintOrigin } from "./esign-mint"
import { mintInvestmentAgreement } from "./investment-agreement"

type SignInvestRoute = RouteProp<RootStackParamList, "cardOnboardingSignInvestScreen">

/** Offline is a status of its own, not an error, so it carries no code. This is the one
 *  the library words as a lost connection, which is what the signer is looking at. */
const OFFLINE_MESSAGE_CODE = "NETWORK_ERROR"

/**
 * How long a cold open waits for the price feed before it stops waiting and says so. A
 * spinner with no end and no button is a dead end; a feed that has not answered in this
 * long means the device is most likely offline, which is what the signer is then told.
 */
const START_WAIT_TIMEOUT_MS = 15_000

/** What the script below posts once the signing page has drawn something. */
const PAGE_READY_MESSAGE = "blink-signing-page-ready"

/** How long the page is given to draw before it is shown regardless, so a page that
 *  never reports (one that draws inside a frame the script does not run in, or never
 *  gets visible text) is not hidden behind the spinner for good. */
const PAGE_READY_TIMEOUT_MS = 20_000

/** How often the script below looks, and how many looks it gives up after: the same
 *  span as the timeout, so no copy keeps measuring a page that was shown long ago. */
const PAGE_READY_POLL_MS = 250
const PAGE_READY_POLL_LIMIT = PAGE_READY_TIMEOUT_MS / PAGE_READY_POLL_MS

/**
 * Runs inside the signing page and reports the moment it has visible content.
 *
 * The page is DocuSign's own app: it lands as an empty shell, spins on its own indicator
 * for a few seconds, then draws its interface at once. The first visible text is that
 * moment, and it is what lets this step keep its own spinner up until then rather than
 * hand the signer a second, different one. Measured against the page as it is today:
 * the shell and the redirects it arrives through carry no text at all until the
 * interface is drawn. The WebView runs this on every page it loads, so it polls rather
 * than assumes; each copy stops once it has reported, or once the step would have
 * uncovered the page anyway.
 */
const REPORT_PAGE_READY_SCRIPT = `
  (function () {
    var looks = 0;
    var tick = setInterval(function () {
      looks += 1;
      var body = document.body;
      var hasDrawn = body && body.innerText && body.innerText.trim();
      if (!hasDrawn && looks < ${PAGE_READY_POLL_LIMIT}) return;
      clearInterval(tick);
      if (!hasDrawn) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "${PAGE_READY_MESSAGE}" }));
    }, ${PAGE_READY_POLL_MS});
  })();
  true;
`

const isPageReadyMessage = (data: string): boolean => {
  try {
    return JSON.parse(data)?.type === PAGE_READY_MESSAGE
  } catch {
    return false
  }
}

/**
 * The signing step between the Term Sheet and the transfer: the agreement is minted from
 * its DocuSign templates and signed on the documents themselves, embedded here. Signing
 * advances to the transfer step; cancelling or declining returns to the Term Sheet,
 * which is where the signer chose to start. A failure stays put, so the retry below
 * is reachable.
 *
 * Driven headless, with the library's own screens left out: the signer already chose
 * to sign on the Term Sheet, so a second "Sign Document" gate asks the same question
 * twice. The session starts as the screen opens and the form is what the signer sees.
 *
 * The envelope is minted by the e-sign service rather than opened from a published url,
 * which is what lets the agreement's values arrive locked: values prefilled through a url
 * cannot be made read only, so the signer could otherwise edit what they are agreeing
 * to. The step has no way forward while that service is unreachable.
 */
export const SignInvestScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const {
    appConfig: { galoyInstance, token },
  } = useAppConfig()
  const { cardInvestmentAgreementPrefill } = useRemoteConfig()
  const { usdPerSat } = usePriceConversion()
  const { selectedAmountUsd } = useRoute<SignInvestRoute>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /**
   * The satoshis the minted agreement settles at, kept from the mint so the transfer step
   * bills exactly the figure the signed document names.
   *
   * A ref rather than state: the signing source is rebuilt whenever what it closes over
   * changes, and a state update here would restart the session the moment the document
   * opened. It is written before the signer can reach the end, so it is set by the time
   * the outcome lands.
   */
  const settlementSats = React.useRef<number | undefined>(undefined)

  /**
   * What the mint reads the moment it runs, kept out of the source's dependencies for the
   * same reason: the price ticks every few seconds, and a source rebuilt on each tick
   * would restart the session mid-signature. The rate is read as the document is minted,
   * which is the stamped moment the agreement names.
   */
  const mintInputs = React.useRef({
    token,
    fields: cardInvestmentAgreementPrefill,
    usdPerSat,
  })
  React.useEffect(() => {
    mintInputs.current = { token, fields: cardInvestmentAgreementPrefill, usdPerSat }
  }, [token, cardInvestmentAgreementPrefill, usdPerSat])

  /** Replaces rather than pushes: the agreement cannot be unsigned, so leaving this
   *  screen behind would let a back swipe land on a finished session with no way on. */
  const goToTransfer = React.useCallback(
    () =>
      navigation.replace("cardOnboardingTransferInvestScreen", {
        selectedAmountUsd,
        settlementSats: settlementSats.current,
      }),
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

  /** The service's own origin, which also serves the page that posts the outcome back,
   *  so it is both what mints the envelope and the origin those events come from. */
  const mintOrigin = resolveMintOrigin(galoyInstance.esignMintUrl)

  /**
   * Rebuilt only when the chosen amount or the service changes: a new source on every
   * render would restart the signing session, possibly mid-signature.
   *
   * The document is written from what the app knows at that moment: the figures from the
   * chosen amount at the price just read, and the host's fields from remote config. A
   * price that has not answered yet or a signer the host has not named cannot be minted
   * around, so each is reported and the retry asks again.
   */
  const source = React.useMemo(
    () =>
      createHostedFormSource({
        allowedOrigin: mintOrigin,
        createInstance: async () => {
          const { token: session, fields, usdPerSat: price } = mintInputs.current

          const agreement = await mintInvestmentAgreement({
            totalUsd: selectedAmountUsd,
            usdPerSat: price,
            fields,
            mint: (recipient, prefill) =>
              mintSigningInstance({
                origin: mintOrigin,
                token: session,
                recipient,
                prefill,
              }),
          })

          settlementSats.current = agreement.settlementSats

          return agreement.minted
        },
      }),
    [selectedAmountUsd, mintOrigin],
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

  /** The agreement cannot be minted before the price feed has answered, so a cold open
   *  waits on the spinner for it rather than failing the session it is about to start. */
  const isPriceQuoted = usdPerSat !== null

  /**
   * Whether that wait has gone on too long. While it is waiting a timer runs; once the
   * price is in, or the session has moved on, the flag drops so a later wait starts
   * fresh. Trying again drops it too, which starts the timer over: the feed answers on
   * its own once the device is back, and the session then starts without another tap.
   */
  const isWaitingToStart = status === "idle" && !isPriceQuoted
  const [hasGivenUpWaiting, setHasGivenUpWaiting] = React.useState(false)
  React.useEffect(() => {
    if (!isWaitingToStart) {
      setHasGivenUpWaiting(false)
      return
    }
    if (hasGivenUpWaiting) return
    const giveUp = setTimeout(() => setHasGivenUpWaiting(true), START_WAIT_TIMEOUT_MS)
    return () => clearTimeout(giveUp)
  }, [isWaitingToStart, hasGivenUpWaiting])

  /**
   * Opens the document as the screen does, once the price is in. Idle is also where a
   * retry and a recovered connection land, so each of those starts the session again
   * without a second tap.
   *
   * Started once per stay in idle, which the flag is for: `sign` is rebuilt whenever the
   * source is, and starting twice would open a second session on top of the first.
   * Leaving idle clears the flag, so the retry and the recovered connection still start
   * one.
   */
  const hasStartedFromIdle = React.useRef(false)
  React.useEffect(() => {
    if (status !== "idle") {
      hasStartedFromIdle.current = false
      return
    }

    if (hasStartedFromIdle.current || !isPriceQuoted) return

    hasStartedFromIdle.current = true
    sign()
  }, [status, sign, isPriceQuoted])

  /** An expired session keeps its envelope, so it is restarted rather than retried: a
   *  retry would drop what the signer already filled in. */
  const recoverFromFailure = isSessionExpired ? restart : retry

  /**
   * Whether the signing page has drawn its interface. Until it has, this step's own
   * spinner covers the WebView: the page spins on an indicator of its own for a few
   * seconds after it loads, and the signer would otherwise see two spinners in a row.
   * The WebView's own loading indicator is switched off for the same reason: it only
   * lasts until the page has loaded, which comes seconds before it has drawn. Cleared
   * whenever the session leaves the signing state, so a restarted session is covered
   * again while its page draws; uncovered after a timeout regardless.
   */
  const [isPageReady, setIsPageReady] = React.useState(false)
  const isSigning = status === "signing"
  React.useEffect(() => {
    if (!isSigning) {
      setIsPageReady(false)
  /** While covered, the page is kept out of the accessibility tree too, so a screen
   *  reader cannot land on a form the signer cannot yet see. Android and iOS each have
   *  their own prop for it. */
  const isPageCovered = !isPageReady
  const webViewAccessibilityImportance = isPageCovered ? "no-hide-descendants" : "auto"

      return
    }
    const uncover = setTimeout(() => setIsPageReady(true), PAGE_READY_TIMEOUT_MS)
    return () => clearTimeout(uncover)
  }, [isSigning])

  /** The one spinner this step shows, whether the session is being opened or the
   *  page is still drawing. */
  const spinner = (
    <ActivityIndicator size="large" color={colors.primary} testID="sign-invest-loading" />
  )

  if (status === "signing" && webViewProps) {
    /** The page's own report is this step's to read; every other message is the
     *  library's, which is how the outcome of the signing reaches it. */
    const handleWebViewMessage = (event: WebViewMessageEvent) => {
      if (isPageReadyMessage(event.nativeEvent.data)) {
        setIsPageReady(true)
        return
      }
      webViewProps.onMessage?.(event)
    }

    return (
      <Screen headerShown={false}>
        <CloseHeader testID="sign-invest-close" />
        {/* The embedded form paints its own white surface edge to edge, so without a
            gap it butts straight up against the close control. The other screens in
            the flow have their own top spacing and need none. */}
        {/* The signing page asks the browser for the signer's location, and Android's
            WebView answers by prompting for the system permission on every visit. The
            location is DocuSign's optional audit extra, not something the signature
            needs, and the account has no brand file to switch the request off, so the
            WebView declines it before it reaches the signer. iOS has no such switch. */}
        <View style={styles.content}>
          <WebView
            {...webViewProps}
            startInLoadingState={false}
            geolocationEnabled={false}
            injectedJavaScript={REPORT_PAGE_READY_SCRIPT}
            onMessage={handleWebViewMessage}
            importantForAccessibility={webViewAccessibilityImportance}
            accessibilityElementsHidden={isPageCovered}
            style={styles.webview}
            testID="sign-invest-webview"
          />
          {isPageCovered && <View style={styles.pageCover}>{spinner}</View>}
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

  /** Worded as a lost connection, which is what a price feed this long silent means. */
  if (isWaitingToStart && hasGivenUpWaiting) {
    return centredOnScreen(
      failure(
        getErrorMessage(OFFLINE_MESSAGE_CODE),
        <GaloyPrimaryButton
          title={LL.common.tryAgain()}
          onPress={() => setHasGivenUpWaiting(false)}
        />,
      ),
    )
  }

  return centredOnScreen(spinner)
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    flex: 1,
    paddingTop: 12,
  },
  webview: {
    flex: 1,
  },
  /** Sits over the WebView on the screen's own surface while the page draws, so the
   *  wait reads as this step still working rather than as the page's own spinner. */
  pageCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
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
