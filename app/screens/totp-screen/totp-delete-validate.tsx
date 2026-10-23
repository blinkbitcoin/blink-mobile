import React, { useCallback, useState } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import { CodeInput } from "@app/components/code-input"
import { TwoFactorManualResetSheet } from "@app/custodial/components/two-factor-manual-reset-sheet"
import { useTwoFactorTurnOff } from "@app/custodial/hooks/use-two-factor-turn-off"
import {
  SettingsScreenDocument,
  useTotpRegistrationStateLazyQuery,
  useUserTotpDeleteMutation,
} from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TotpStepUpErrorCode } from "@app/types/two-factor-enforcement"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

gql`
  mutation userTotpDelete($input: UserTotpDeleteInput) {
    userTotpDelete(input: $input) {
      errors {
        message
        code
      }
      me {
        id
        phone
        totpEnabled
        email {
          address
          verified
        }
      }
    }
  }
`

/**
 * Turns the authenticator off with its current code, which the server checks. A code
 * that is wrong, or one too many this hour, is said under the field and leaves the
 * authenticator on; a balance the server finds too high leaves it on as well, and the
 * manual reset sheet says how support can help. An answer that is lost, or a refusal
 * nothing explains, is checked against the account: the removal may have landed.
 */
export const TotpDeleteValidateScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "totpDeleteValidate">>()
  const { LL } = useI18nContext()
  const { reportBlocked } = useTwoFactorTurnOff()
  const [totpDelete] = useUserTotpDeleteMutation()
  const [readAccount] = useTotpRegistrationStateLazyQuery({ fetchPolicy: "network-only" })

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isManualResetVisible, setIsManualResetVisible] = useState(false)

  const finish = useCallback(() => {
    navigation.goBack()
    Alert.alert(LL.AccountScreen.totpDeactivated())
  }, [LL, navigation])

  /** Whether the authenticator is off after all, as the server has it; the read also
   *  brings the settings up to date. False when it is on or cannot be read. */
  const isTurnedOffOnServer = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await readAccount()
      return data?.me?.totpEnabled === false
    } catch {
      return false
    }
  }, [readAccount])

  const removeWithCode = useCallback(
    async (code: string) => {
      setLoading(true)
      try {
        const res = await totpDelete({
          variables: { input: { totpCode: code } },
          refetchQueries: [SettingsScreenDocument],
        })
        const payload = res.data?.userTotpDelete
        const isTurnedOff = payload?.me?.totpEnabled === false
        if (isTurnedOff) {
          finish()
          return
        }

        const refusal = payload?.errors[0]
        const isBalanceTooHigh =
          refusal?.code === TotpStepUpErrorCode.RemovalBalanceTooHigh
        if (isBalanceTooHigh) {
          reportBlocked()
          setIsManualResetVisible(true)
          return
        }

        /** The refusals the code field answers: the user can try again there. */
        const refusalMessages: Partial<Record<string, string>> = {
          [TotpStepUpErrorCode.CodeInvalid]: LL.TwoFactorTurnOff.codeInvalid(),
          [TotpStepUpErrorCode.TooManyAttempts]: LL.TwoFactorTurnOff.tooManyAttempts(),
        }
        const refusalMessage = refusalMessages[refusal?.code ?? ""]
        if (refusalMessage) {
          setErrorMessage(refusalMessage)
          return
        }
        if (await isTurnedOffOnServer()) {
          finish()
          return
        }
        Alert.alert(LL.common.error(), refusal?.message)
      } catch (err) {
        const isAnswerLost = isNetworkFailure(err)
        const isTurnedOff = isAnswerLost && (await isTurnedOffOnServer())
        if (isTurnedOff) {
          finish()
          return
        }
        Alert.alert(LL.common.error())
      } finally {
        setLoading(false)
      }
    },
    [LL, finish, isTurnedOffOnServer, reportBlocked, totpDelete],
  )

  /** A code typed again while one is checked would spend another of the hour's tries,
   *  and fail once the first has turned the authenticator off. */
  const { run } = useInFlightGuard()
  const send = useCallback(
    (code: string) => run(() => removeWithCode(code)),
    [run, removeWithCode],
  )

  const closeManualReset = useCallback(() => {
    setIsManualResetVisible(false)
    navigation.goBack()
  }, [navigation])

  return (
    <>
      <CodeInput
        send={send}
        header={LL.TwoFactorTurnOff.codeInstruction()}
        loading={loading}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
      />
      <TwoFactorManualResetSheet
        isVisible={isManualResetVisible}
        onClose={closeManualReset}
      />
    </>
  )
}
