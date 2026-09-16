import * as React from "react"
import { ActivityIndicator, Linking, View } from "react-native"
import { WebView, WebViewMessageEvent } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  createHostedFormSource,
  useESignature,
} from "@blinkbitcoin/esign-react-native/webform"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { SATS_PER_BTC, usePriceConversion } from "@app/hooks/use-price-conversion"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { logError } from "@app/utils/log-error"

import {
  mintSigningInstance,
  resolveMintOrigin,
  trustedRemoteMintOrigin,
} from "./esign-mint"
import {
  isSigningError,
  mintInvestmentAgreement,
  ROUTE_MISSING_CODE,
} from "./investment-agreement"

type SignInvestRoute = RouteProp<RootStackParamList, "cardOnboardingSignInvestScreen">

/** The code the library files a mint refused for a reason the signer should read under;
 *  its message is the service's own words, and the one case the copy is not the app's. */
const REFUSAL_CODE = "VALIDATION_ERROR"

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
 * uncovered the page anyway. Exported for the spec that runs it, since no test renders
 * a real WebView.
 */
export const REPORT_PAGE_READY_SCRIPT = `
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
 * The hosts the signing happens on: DocuSign's own, which the signing page and the
 * redirects it arrives through live on, and the mint origin, which serves the page the
 * outcome comes back through. Any other navigation is a link inside the document, and
 * belongs in the browser rather than in this WebView.
 */
const SIGNING_PAGE_HOSTS = ["docusign.net", "docusign.com"]

/** The scheme and host of a url, lowercased, or null for anything that has none. Only a
 *  plain host name and at most a port count as one: userinfo, a backslash or an escape
 *  before the first slash would let a url parser reach a different host than the one
 *  a suffix check reads. */
const originOf = (url: string): string | null =>
  url.match(/^(https?:\/\/[a-z0-9.-]+(?::\d{1,5})?)(?:[/?#]|$)/i)?.[1]?.toLowerCase() ??
  null

const hostOf = (origin: string): string =>
  origin.replace(/^https?:\/\//, "").split(":")[0]

const isSigningPageHost = (host: string): boolean =>
  SIGNING_PAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))

/** Whether the WebView may move to this url: a page of the signing itself. The empty
 *  page a WebView starts on counts, since it is where the first load comes from. */
export const isSigningPageUrl = (url: string, mintOrigin: string): boolean => {
  if (url === "about:blank") return true
  const origin = originOf(url)
  if (!origin) return false
  return origin === mintOrigin.toLowerCase() || isSigningPageHost(hostOf(origin))
}

/**
 * The copy for a failed session, from the app's own strings: the library's are English
 * only. A refusal carries the service's reason, which is worded for the signer already,
 * so it is shown as is, the way the library shows it.
 */
const signingErrorCopy = (
  LL: TranslationFunctions,
  error: { code: string; message?: string } | null,
): string => {
  const copy = LL.CardFlow.Onboarding.SignInvest.errors
  if (error?.code === REFUSAL_CODE && error.message) return error.message

  const byCode: Record<string, () => string> = {
    ENVELOPE_CREATION_FAILED: copy.envelopeCreationFailed,
    NETWORK_ERROR: copy.networkError,
    UNAUTHORIZED: copy.unauthorized,
    SESSION_EXPIRED: copy.sessionExpired,
    PROVIDER_UNAVAILABLE: copy.providerUnavailable,
    [ROUTE_MISSING_CODE]: copy.routeMissing,
  }
  return (byCode[error?.code ?? ""] ?? copy.generic)()
}

/** The schemes a link inside the document may be handed to the phone under. */
const EXTERNAL_LINK_SCHEMES = /^(https?|mailto|tel):/i

/** What a mint left behind: the envelope it opened, the satoshis its document names,
 *  and the origin it was made at, kept together so the figure is never read against
 *  another envelope and the session's messages are checked against the service that
 *  actually minted it, not against whatever the origin has become since. */
type MintedTerms = {
  envelopeId?: string
  settlementSats: number
  origin: string
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
  const copy = LL.CardFlow.Onboarding.SignInvest
  const {
    appConfig: { galoyInstance, token },
  } = useAppConfig()
  const { cardInvestmentEsignMintUrl } = useRemoteConfig()
  const { convertMoneyAmount } = usePriceConversion()
  const { selectedAmountUsd } = useRoute<SignInvestRoute>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { start: startCardInvestment, isAccountResolved } = useCardInvestmentProgress()

  /**
   * What the latest mint left behind, kept from the mint so the transfer step bills
   * exactly the figure the signed document names.
   *
   * A ref rather than state: the signing source is rebuilt whenever what it closes over
   * changes, and a state update here would restart the session the moment the document
   * opened. It is written before the signer can reach the end, so it is set by the time
   * the outcome lands. Only the latest mint writes it: the library gives up on a mint
   * after a while but cannot stop it, and one that lands after the signer has moved on
   * to a fresh one must not put the older price's figure under the newer document.
   */
  const mintedTerms = React.useRef<MintedTerms | undefined>(undefined)
  const mintCount = React.useRef(0)

  /** The status the service answered the last failed mint with. The library hands the
   *  screen a failure's code and message alone, so the status is kept here on the way
   *  through, for the log to name beside the code. */
  const lastMintStatus = React.useRef<number | undefined>(undefined)

  /** The price of one bitcoin in whole cents, or null while the feed has not answered:
   *  the rate the agreement states, taken with its cents rather than as the per-satoshi
   *  figure the hook also offers, which only holds whole dollars. */
  const usdCentsPerBtc = convertMoneyAmount
    ? convertMoneyAmount(toBtcMoneyAmount(SATS_PER_BTC), WalletCurrency.Usd).amount
    : null

  /**
   * What the mint reads the moment it runs, kept out of the source's dependencies for the
   * same reason: the price ticks every few seconds, and a source rebuilt on each tick
   * would restart the session mid-signature. The rate is read as the document is minted,
   * which is the stamped moment the agreement names.
   */
  const mintInputs = React.useRef({ token, usdCentsPerBtc })
  React.useEffect(() => {
    mintInputs.current = { token, usdCentsPerBtc }
  }, [token, usdCentsPerBtc])

  /**
   * Set when the session that completed is not the envelope this step minted last. The
   * transfer step would bill the figure of one document against the signature on
   * another, so the step stops and says so instead of moving on.
   */
  const [hasSignedOtherEnvelope, setHasSignedOtherEnvelope] = React.useState(false)

  /**
   * Replaces rather than pushes: the agreement cannot be unsigned, so leaving this
   * screen behind would let a back swipe land on a finished session with no way on.
   * The figure carried is the one minted with the envelope that was signed; when the
   * library names the envelope and it is not that one, nothing is carried and the step
   * does not move on. The same moment records the investment, so the home can steer
   * the investor back to paying it if they leave before they do.
   */
  const goToTransfer = React.useCallback(
    (result: { envelopeId?: string }) => {
      const minted = mintedTerms.current
      const isOtherEnvelope =
        result.envelopeId !== undefined &&
        minted?.envelopeId !== undefined &&
        result.envelopeId !== minted.envelopeId
      if (isOtherEnvelope) {
        logError({
          scope: "card-investment-esign",
          error: new Error("the signed envelope is not the one minted last"),
          context: { signed: result.envelopeId, minted: minted?.envelopeId },
        })
        setHasSignedOtherEnvelope(true)
        return
      }

      const investment = { selectedAmountUsd, settlementSats: minted?.settlementSats }
      startCardInvestment(investment)
      navigation.replace("cardOnboardingTransferInvestScreen", investment)
    },
    [navigation, selectedAmountUsd, startCardInvestment],
  )

  /**
   * A signer who declines is sent back, and the session returns to idle as they go.
   * Idle is also where the document is opened from, so without this mark the step would
   * mint a fresh envelope, and could reopen the page, right after they said no.
   */
  const isLeaving = React.useRef(false)
  const goBack = React.useCallback(() => {
    isLeaving.current = true
    navigation.goBack()
  }, [navigation])

  /** Stays on the screen on purpose: the retry below is what a failed session needs, and
   *  navigating away would tear it down. Leaving is the close button's job. The error is
   *  logged as it came, stack and identity included, with its code and the status the
   *  service answered beside it. */
  const reportSigningError = React.useCallback(
    (error: { code: string; message: string }) =>
      logError({
        scope: "card-investment-esign",
        error,
        context: { code: error.code, status: lastMintStatus.current },
      }),
    [],
  )

  /**
   * The service's own origin, which is what mints the envelope and serves the page the
   * outcome comes back through, so it is also what a message from the WebView is checked
   * against. Remote config names it first, so it can be switched or withdrawn without a
   * release; the instance's value stands until it does. Empty means this build cannot
   * mint anywhere, which the step says instead of offering a retry that cannot win.
   */
  const mintOrigin = resolveMintOrigin(
    trustedRemoteMintOrigin(cardInvestmentEsignMintUrl) || galoyInstance.esignMintUrl,
  )
  const isSigningAvailable = mintOrigin !== ""

  /**
   * Rebuilt only when the chosen amount or the service changes: a new source on every
   * render would restart the signing session, possibly mid-signature.
   *
   * The document is written from what the app knows at that moment: the figures from the
   * chosen amount at the price just read; the signer's details the service asks its host
   * for. A price that has not answered yet cannot be minted around, so it is reported
   * and the retry asks again.
   */
  const source = React.useMemo(
    () =>
      createHostedFormSource({
        createInstance: async () => {
          const { token: session, usdCentsPerBtc: price } = mintInputs.current
          mintCount.current += 1
          const generation = mintCount.current

          /** A mint the library gave up on lands here late; a newer one has written
           *  the terms since, and this one is not the document the signer sees. */
          const isLatestMint = () => generation === mintCount.current

          lastMintStatus.current = undefined
          const agreement = await mintInvestmentAgreement({
            totalUsd: selectedAmountUsd,
            usdCentsPerBtc: price,
            mint: (prefill) =>
              mintSigningInstance({ origin: mintOrigin, token: session, prefill }),
          }).catch((error: unknown) => {
            if (isSigningError(error) && isLatestMint()) {
              lastMintStatus.current = error.status
            }
            throw error
          })

          if (isLatestMint()) {
            mintedTerms.current = {
              envelopeId: agreement.minted.envelopeId,
              settlementSats: agreement.settlementSats,
              origin: mintOrigin,
            }
          }

          return agreement.minted
        },
      }),
    [selectedAmountUsd, mintOrigin],
  )

  const {
    status,
    error,
    isCheckingConnection,
    sign,
    retry,
    checkConnection,
    webViewProps,
  } = useESignature({
    source,
    onComplete: goToTransfer,
    onCancel: goBack,
    onError: reportSigningError,
  })

  /** The agreement cannot be minted before the price feed has answered, and it must not
   *  be signed before the investment can be recorded against the account, or the home
   *  would never steer the investor back to paying it. A cold open waits on the spinner
   *  for both rather than failing the session it is about to start. */
  const isPriceQuoted = usdCentsPerBtc !== null
  const isReadyToMint = isPriceQuoted && isAccountResolved

  /**
   * Whether that wait has gone on too long. While it is waiting a timer runs; once both
   * are in, or the session has moved on, the flag drops so a later wait starts fresh.
   * Trying again drops it too, which starts the timer over: the feed and the account
   * answer on their own once the device is back, and the session then starts without
   * another tap.
   */
  const isWaitingToStart = status === "idle" && !isReadyToMint
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
   * one. Not started at all while this build has nowhere to mint, nor while the step is
   * telling the signer that another envelope was signed: that is a tap to try again,
   * not a session to open on its own.
   */
  const canStartSigning = isReadyToMint && isSigningAvailable && !hasSignedOtherEnvelope
  const hasStartedFromIdle = React.useRef(false)
  React.useEffect(() => {
    if (status !== "idle") {
      hasStartedFromIdle.current = false
      return
    }

    if (hasStartedFromIdle.current || isLeaving.current || !canStartSigning) return

    hasStartedFromIdle.current = true
    sign()
  }, [status, sign, canStartSigning])

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
      return
    }
    const uncover = setTimeout(() => setIsPageReady(true), PAGE_READY_TIMEOUT_MS)
    return () => clearTimeout(uncover)
  }, [isSigning])

  /** While covered, the page is kept out of the accessibility tree too, so a screen
   *  reader cannot land on a form the signer cannot yet see; the cover takes its place
   *  as the one thing to read. Android and iOS each have their own prop for it. */
  const isPageCovered = !isPageReady
  const webViewAccessibilityImportance = isPageCovered ? "no-hide-descendants" : "auto"

  /** The one spinner this step shows, whether the session is being opened or the
   *  page is still drawing, and what a screen reader says it is. */
  const spinner = (
    <ActivityIndicator
      size="large"
      color={colors.primary}
      accessibilityRole="progressbar"
      accessibilityLabel={copy.loading()}
      testID="sign-invest-loading"
    />
  )

  if (status === "signing" && webViewProps) {
    /** The service this session was minted at, which is the one whose page may post
     *  its outcome; the origin the screen would mint at now may have moved since. */
    const sessionOrigin = mintedTerms.current?.origin ?? mintOrigin

    /**
     * The page's own report is this step's to read, from whichever page draws it. Every
     * other message is the library's, which is how the outcome of the signing reaches
     * it, and only the page the service serves may post one: a WebView message names
     * the page it came from, and a page reached through a link inside the document
     * could otherwise post a completion nobody signed. The service has to serve its
     * return page at the origin it mints at for this to hold, which a deployment is
     * held to; a drop is logged as the failure it would be if it did not.
     */
    const handleWebViewMessage = (event: WebViewMessageEvent) => {
      if (isPageReadyMessage(event.nativeEvent.data)) {
        setIsPageReady(true)
        return
      }
      const pageUrl = event.nativeEvent.url ?? ""
      const isFromService = originOf(pageUrl) === sessionOrigin.toLowerCase()
      if (!isFromService) {
        logError({
          scope: "card-investment-esign",
          error: new Error("a signing message from a page the service does not serve"),
          context: { url: pageUrl },
        })
        return
      }
      webViewProps.onMessage?.(event)
    }

    /**
     * The WebView stays on the signing's own pages; a link inside the document opens in
     * the browser, where it belongs, and never takes the signing page's place. Only the
     * page itself is held to that: the frames it loads inside are its own business, and
     * iOS asks about those too. Only a link the phone can open is handed to it, and a
     * phone that cannot is not a failure of the signing.
     */
    const shouldLoadInWebView = (request: ShouldStartLoadRequest): boolean => {
      if (request.isTopFrame === false) return true
      if (isSigningPageUrl(request.url, sessionOrigin)) return true
      if (EXTERNAL_LINK_SCHEMES.test(request.url)) {
        Linking.openURL(request.url).catch(() => undefined)
      }
      return false
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
            onShouldStartLoadWithRequest={shouldLoadInWebView}
            importantForAccessibility={webViewAccessibilityImportance}
            accessibilityElementsHidden={isPageCovered}
            style={styles.webview}
            testID="sign-invest-webview"
          />
          {isPageCovered && (
            <View style={styles.pageCover} accessibilityViewIsModal>
              {spinner}
            </View>
          )}
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

  /** A failure: the title, the app's wording for it, and what can be done about it, if
   *  anything. */
  const failure = (message: string, action?: React.ReactNode) => (
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

  /** Nowhere to mint in this build: not a failure a tap can cure, so no button. */
  if (!isSigningAvailable) {
    return centredOnScreen(failure(copy.notAvailable()))
  }

  if (status === "offline") {
    return centredOnScreen(
      failure(
        copy.errors.networkError(),
        <GaloyPrimaryButton
          title={LL.common.tryAgain()}
          loading={isCheckingConnection}
          onPress={checkConnection}
        />,
      ),
    )
  }

  if (hasSignedOtherEnvelope) {
    const startOver = () => {
      setHasSignedOtherEnvelope(false)
      retry()
    }
    return centredOnScreen(
      failure(
        copy.errors.envelopeMismatch(),
        <GaloyPrimaryButton title={LL.common.tryAgain()} onPress={startOver} />,
      ),
    )
  }

  if (status === "error") {
    /** A route the service does not serve is not cured by tapping again. */
    const isRetryable = error?.code !== ROUTE_MISSING_CODE
    return centredOnScreen(
      failure(
        signingErrorCopy(LL, error),
        isRetryable ? (
          <GaloyPrimaryButton title={LL.common.tryAgain()} onPress={retry} />
        ) : undefined,
      ),
    )
  }

  /** Worded as a lost connection, which is what a price feed this long silent means. */
  if (isWaitingToStart && hasGivenUpWaiting) {
    return centredOnScreen(
      failure(
        copy.errors.networkError(),
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
