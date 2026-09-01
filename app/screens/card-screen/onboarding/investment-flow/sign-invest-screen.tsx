import * as React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import {
  ESignature,
  createPublicUrlSource,
} from "@blinkbitcoin/esign-react-native/webform"

import { Screen } from "@app/components/screen"
import { ESIGN_ALLOWED_ORIGIN, ESIGN_INVESTMENT_FORM_URL } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logError } from "@app/utils/log-error"

/**
 * The signing step between the Term Sheet and the transfer: the subscription
 * agreement is signed on a published DocuSign Web Form embedded here. Signing
 * advances to the transfer step; cancelling or declining returns to the Term Sheet,
 * which is where the signer chose to start. A failure stays put, so the component
 * can offer its own retry.
 *
 * Needs ESIGN_INVESTMENT_FORM_URL set: with no form to embed the session cannot
 * start and the step has no way forward, so the flow must not ship without it.
 */
export const SignInvestScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Replaces rather than pushes: the agreement cannot be unsigned, so leaving this
   *  screen behind would let a back swipe land on a finished session with no way on. */
  const goToTransfer = React.useCallback(
    () => navigation.replace("cardOnboardingTransferInvestScreen"),
    [navigation],
  )

  const goBack = React.useCallback(() => navigation.goBack(), [navigation])

  /** Deliberately stays on the screen: the component renders its own error state with
   *  a Retry, and a session that merely expired offers a Restart. Navigating away here
   *  would tear both down before they paint and drop the signer at the Term Sheet with
   *  no idea what went wrong. Leaving is the header close button's job. */
  const reportSigningError = React.useCallback(
    (error: { code: string; message: string }) =>
      logError({
        scope: "card-investment-esign",
        error: new Error(error.message),
        context: { code: error.code },
      }),
    [],
  )

  /** Built once: rebuilding it on every render would restart the signing session. */
  const source = React.useMemo(
    () =>
      createPublicUrlSource({
        url: ESIGN_INVESTMENT_FORM_URL,
        allowedOrigin: ESIGN_ALLOWED_ORIGIN,
      }),
    [],
  )

  return (
    <Screen>
      <ESignature
        source={source}
        label={LL.CardFlow.Onboarding.SignInvest.label()}
        onComplete={goToTransfer}
        onCancel={goBack}
        onError={reportSigningError}
      />
    </Screen>
  )
}
