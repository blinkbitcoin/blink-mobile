import React, { useCallback, useRef, useState } from "react"
import { Alert } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { CodeInput } from "@app/components/code-input"
import {
  LoginMethodAdditionOutcome,
  useLoginMethodAddition,
} from "@app/custodial/hooks/use-login-method-addition"
import { useCodeCheckHold } from "@app/hooks/use-code-check-hold"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useSessionGuard } from "@app/hooks/use-session-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  mapGqlErrorsToValidatePhoneCodeErrors,
  mapValidatePhoneCodeErrorsToMessage,
} from "@app/screens/phone-auth-screen/phone-registration-validation-errors"
import {
  EmailOnboardingParams,
  LoginMethod,
  LoginMethodAddition,
  LoginMethodAdditionParams,
  LoginMethodAdditionResult,
  loginMethodOf,
  LoginMethodRefusal,
  TotpStepUpErrorCode,
} from "@app/types/two-factor-enforcement"
import {
  logLoginMethodCodeFailed,
  logValidateAuthCodeFailure,
} from "@app/utils/analytics"

type LoginMethodCodeCopy = {
  title: string
  instruction: string
}

/** What the screen says for an addition: adding the email, or confirming it again, which
 *  registers it anew, and adding the phone number. */
export const loginMethodCodeCopy = (
  LL: TranslationFunctions,
  addition: LoginMethodAddition,
): LoginMethodCodeCopy => {
  const isEmail = loginMethodOf(addition) === LoginMethod.Email
  if (isEmail) {
    return {
      title: LL.LoginMethodCode.addEmailTitle(),
      instruction: LL.LoginMethodCode.addEmailCode(),
    }
  }
  return {
    title: LL.LoginMethodCode.addPhoneTitle(),
    instruction: LL.LoginMethodCode.addPhoneCode(),
  }
}

/** Where the onboarding goes once the email is confirmed: only an address added from it
 *  carries that on. */
const emailOnboardingOf = (params: LoginMethodAdditionParams): EmailOnboardingParams => {
  if (params.addition !== LoginMethodAddition.Email) return {}
  const { onboarding, hasUsername } = params
  return { onboarding, hasUsername }
}

/**
 * The authenticator's code for adding a login method, which the server checks with
 * the addition itself. A wrong code, or one too many this hour, is said under the
 * field; a phone code the server refuses sends the user back to enter it again.
 */
export const LoginMethodCodeScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "loginMethodCode">>()
  const { params } = useRoute<RouteProp<RootStackParamList, "loginMethodCode">>()
  const { run } = useLoginMethodAddition()
  const { captureSession } = useSessionGuard()

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const loginMethod = loginMethodOf(params.addition)
  const { instruction } = loginMethodCodeCopy(LL, params.addition)

  /** The refusals the code field answers, where the user can try again. */
  const sayRefusal = useCallback(
    (refusal: LoginMethodRefusal) => {
      const isCodeInvalid = refusal.code === TotpStepUpErrorCode.CodeInvalid
      if (isCodeInvalid) {
        logLoginMethodCodeFailed({ loginMethod })
        setErrorMessage(LL.LoginMethodCode.codeInvalid())
        return
      }
      const isTooManyAttempts = refusal.code === TotpStepUpErrorCode.TooManyAttempts
      if (isTooManyAttempts) {
        setErrorMessage(LL.LoginMethodCode.tooManyAttempts())
        return
      }
      const isPhoneAddition = params.addition === LoginMethodAddition.Phone
      if (isPhoneAddition) {
        const phoneError = mapGqlErrorsToValidatePhoneCodeErrors([
          { code: refusal.code, message: refusal.message ?? "" },
        ])
        if (phoneError) {
          logValidateAuthCodeFailure({ error: phoneError.type })
          Alert.alert(
            LL.common.error(),
            mapValidatePhoneCodeErrorsToMessage(phoneError, LL),
          )
        }
        navigation.goBack()
        return
      }
      Alert.alert(LL.common.error(), refusal.message)
    },
    [LL, loginMethod, navigation, params.addition],
  )

  /** An addition done stays done: adding a phone number waits on its success alert
   *  with the code still in the field, and the field can hand it over again, which the
   *  server would refuse as the number is already added. */
  const isAdditionDoneRef = useRef(false)

  /** What the screen shows for how the addition ended. */
  const showOutcome = useCallback(
    (outcome: LoginMethodAdditionOutcome, isOwnSession: () => boolean) => {
      switch (outcome.result) {
        case LoginMethodAdditionResult.EmailRegistered:
          isAdditionDoneRef.current = true
          navigation.replace("emailRegistrationValidate", {
            email: outcome.email,
            emailRegistrationId: outcome.emailRegistrationId,
            ...emailOnboardingOf(params),
          })
          break
        case LoginMethodAdditionResult.PhoneAdded:
          isAdditionDoneRef.current = true
          Alert.alert(LL.PhoneRegistrationValidateScreen.successTitle(), undefined, [
            {
              text: LL.common.ok(),
              onPress: () => {
                if (isOwnSession()) navigation.popTo("settings")
              },
            },
          ])
          break
        case LoginMethodAdditionResult.Refused:
          sayRefusal(outcome.refusal)
          break
        case LoginMethodAdditionResult.Abandoned:
          break
      }
    },
    [LL, navigation, params, sayRefusal],
  )

  /** Only the screen and the session the code was sent from show its answer: one the
   *  user has left, or a stack an account switch reset, is not moved by it. */
  const runWithCode = useCallback(
    async (code: string) => {
      if (isAdditionDoneRef.current) return
      const isOwnSession = captureSession()
      setLoading(true)
      try {
        const outcome = await run({ params, totpCode: code, isOwnSession })
        if (isOwnSession()) showOutcome(outcome, isOwnSession)
      } catch {
        if (isOwnSession()) Alert.alert(LL.common.error())
      } finally {
        setLoading(false)
      }
    },
    [captureSession, run, params, showOutcome, LL],
  )

  /** An answer that lands after the user left would move a screen they never sent the
   *  code from, and a code sent again from a new one would spend another try. */
  useCodeCheckHold(loading)

  /** A code typed again while one is checked would spend another of the hour's tries. */
  const { run: runOnce } = useInFlightGuard()
  const send = useCallback(
    (code: string) => runOnce(() => runWithCode(code)),
    [runOnce, runWithCode],
  )

  return (
    <CodeInput
      send={send}
      header={instruction}
      loading={loading}
      errorMessage={errorMessage}
      setErrorMessage={setErrorMessage}
    />
  )
}
