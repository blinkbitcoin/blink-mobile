import * as React from "react"
import { ActivityIndicator, View } from "react-native"
import { WebView } from "react-native-webview"
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
