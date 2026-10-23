import React, { useCallback, useState } from "react"
import { Alert } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { CodeInput } from "@app/components/code-input"
import {
  ContactChangeRefusal,
  useContactChangeSteps,
} from "@app/custodial/hooks/use-contact-change-steps"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  mapGqlErrorsToValidatePhoneCodeErrors,
  mapValidatePhoneCodeErrorsToMessage,
} from "@app/screens/phone-auth-screen/phone-registration-validation-errors"
import {
  ContactChangeStep,
  ContactField,
  contactFieldOf,
  TotpStepUpErrorCode,
} from "@app/types/two-factor-enforcement"
import { logContactChangeCodeFailed } from "@app/utils/analytics"

type ContactChangeCopy = {
  title: string
  instruction: string
}

/** What the screen says for a step: a change while the method is removed or confirmed
 *  again, an addition once there is none. */
export const contactChangeCopy = (
  LL: TranslationFunctions,
  step: ContactChangeStep,
): ContactChangeCopy => {
  const isEmail = contactFieldOf(step) === ContactField.Email
  const isAddition =
    step === ContactChangeStep.EmailAdd || step === ContactChangeStep.PhoneAdd
  if (isAddition && isEmail) {
    return {
      title: LL.ContactChange.addEmailTitle(),
      instruction: LL.ContactChange.addEmailCode(),
    }
  }
  if (isAddition) {
    return {
      title: LL.ContactChange.addPhoneTitle(),
      instruction: LL.ContactChange.addPhoneCode(),
    }
  }
  if (isEmail) {
    return {
      title: LL.ContactChange.changeEmailTitle(),
      instruction: LL.ContactChange.changeEmailCode(),
    }
  }
  return {
    title: LL.ContactChange.changePhoneTitle(),
    instruction: LL.ContactChange.changePhoneCode(),
  }
}

/**
 * The authenticator's code for a step of a login method change, which the server
 * checks with the step itself. A wrong code, or one too many this hour, is said under
 * the field; a phone code the server refuses sends the user back to enter it again.
 */
export const ContactChangeCodeScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "contactChangeCode">>()
  const { params } = useRoute<RouteProp<RootStackParamList, "contactChangeCode">>()
  const { run } = useContactChangeSteps()

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const field = contactFieldOf(params.step)
  const { instruction } = contactChangeCopy(LL, params.step)

  /** The refusals the code field answers, where the user can try again. */
  const sayRefusal = useCallback(
    (refusal: ContactChangeRefusal) => {
      const isCodeInvalid = refusal.code === TotpStepUpErrorCode.CodeInvalid
      if (isCodeInvalid) {
        logContactChangeCodeFailed({ field })
        setErrorMessage(LL.ContactChange.codeInvalid())
        return
      }
      const isTooManyAttempts = refusal.code === TotpStepUpErrorCode.TooManyAttempts
      if (isTooManyAttempts) {
        setErrorMessage(LL.ContactChange.tooManyAttempts())
        return
      }
      const isPhoneAddition = params.step === ContactChangeStep.PhoneAdd
      if (isPhoneAddition) {
        const phoneError = mapGqlErrorsToValidatePhoneCodeErrors([
          { code: refusal.code, message: refusal.message ?? "" },
        ])
        if (phoneError) {
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
    [LL, field, navigation, params.step],
  )

  const runWithCode = useCallback(
    async (code: string) => {
      setLoading(true)
      try {
        const outcome = await run(params, code)
        if (!outcome.isDone) sayRefusal(outcome.refusal)
      } catch {
        Alert.alert(LL.common.error())
      } finally {
        setLoading(false)
      }
    },
    [run, params, sayRefusal, LL],
  )

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
