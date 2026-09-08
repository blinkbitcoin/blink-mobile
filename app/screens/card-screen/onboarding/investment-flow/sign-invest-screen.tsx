import * as React from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import {
  ESignature,
  createPublicUrlSource,
  type ESignatureProps,
} from "@blinkbitcoin/esign-react-native/webform"

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

/** Read off the Button theme and GaloyPrimaryButton: the library draws squarer buttons than
 *  the pill ones the rest of the flow uses. */
const BUTTON_MIN_HEIGHT = 50
const BUTTON_HORIZONTAL_PADDING = 32
const BUTTON_BORDER_RADIUS = 50

/**
 * The signing step between the Term Sheet and the transfer: the subscription
 * agreement is signed on a published DocuSign Web Form embedded here. Signing
 * advances to the transfer step; cancelling or declining returns to the Term Sheet,
 * which is where the signer chose to start. A failure stays put, so the component
 * can offer its own retry.
 *
 * Needs cardInvestmentEsignFormUrl set in remote config: with no form to embed the
 * session cannot start and the step has no way forward, so the flow must not ship
 * without it.
 */
export const SignInvestScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { theme: esignTheme, styles: esignStyles } = useESignAppearance()
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

  /** Stays on the screen on purpose: the component draws its own Retry, and navigating
   *  away would tear it down before it paints. Leaving is the close button's job. */
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
   *
   * A late price needs no wait of its own: the component embeds nothing until the signer
   * asks it to. Checked on device by pressing both before and after the feed answered, and
   * the form carried the figures either way.
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

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="sign-invest-close" />
      {/* The embedded form paints its own white surface edge to edge, so without a
          gap it butts straight up against the close control. The other screens in
          the flow have their own top spacing and need none. */}
      <View style={styles.content}>
        <ESignature
          source={source}
          label={LL.CardFlow.Onboarding.SignInvest.label()}
          theme={esignTheme}
          styles={esignStyles}
          onComplete={goToTransfer}
          onCancel={goBack}
          onError={reportSigningError}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  content: {
    flex: 1,
    paddingTop: 12,
  },
}))

type ESignAppearance = {
  theme: NonNullable<ESignatureProps["theme"]>
  styles: NonNullable<ESignatureProps["styles"]>
}

/**
 * How the embedded component is dressed. Its built-in screens ship an iOS-blue palette
 * that answers no theme, so it would read as another app's here and keep its light greys
 * in dark mode.
 *
 * Both halves stay stable across renders, or a new object would restart the signing
 * session, the same reason the source is memoized.
 */
const useESignAppearance = (): ESignAppearance => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useESignStyles()

  const theme = React.useMemo(
    () => ({
      primaryColor: colors.primary,
      primaryTextColor: colors.white,
      mutedTextColor: colors.grey1,
      successColor: colors._green,
      errorColor: colors.error,
      warningColor: colors.warning,
    }),
    [colors],
  )

  return { theme, styles }
}

/** Only what the colours above cannot reach: the titles carry no colour of their own, so
 *  they fall back to the platform's black and vanish on a dark background. */
const useESignStyles = makeStyles(({ colors }) => ({
  title: {
    color: colors.black,
  },
  button: {
    minHeight: BUTTON_MIN_HEIGHT,
    paddingHorizontal: BUTTON_HORIZONTAL_PADDING,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  cancelButton: {
    minHeight: BUTTON_MIN_HEIGHT,
  },
}))
