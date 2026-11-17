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
import { useCodeCheckHold } from "@app/hooks/use-code-check-hold"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TotpStepUpErrorCode } from "@app/types/two-factor-enforcement"
import { CommonActions, useNavigation, useRoute } from "@react-navigation/native"
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
 * Turns the authenticator off with its current code, which the server checks once its
 * step-up check is on (`twoFactor.stepUpEnabled`); while it is off, the server takes any
 * code. A code that is wrong, or one too many this hour, is said under the field and
 * leaves the authenticator on; a balance the server finds too high leaves it on as well,
 * and the manual reset sheet says how support can help. An answer that is lost, or a
 * refusal nothing explains, is checked against the account: the removal may have landed.
 * The tier reached is read again before the code is sent, as it can rise while the
 * screen is open.
 */
export const TotpDeleteValidateScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "totpDeleteValidate">>()
  const { LL } = useI18nContext()
  const { key: routeKey } = useRoute()
  const isMounted = useIsMounted()
  const { isTurnOffBlocked, isTurnOffDecided, reportBlocked } = useTwoFactorTurnOff()
  const [totpDelete] = useUserTotpDeleteMutation()
  const [readAccount] = useTotpRegistrationStateLazyQuery({ fetchPolicy: "network-only" })

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isManualResetVisible, setIsManualResetVisible] = useState(false)

  /** An answer can land under a screen pushed over this one, as the app lock is: only
   *  this screen takes itself off the stack, and the screens above it stay. Asked twice,
   *  as a sheet closed twice in a row can, it leaves once: the second finds it gone. */
  const leaveScreen = useCallback(() => {
    navigation.dispatch((state) => {
      const routes = state.routes.filter((stackRoute) => stackRoute.key !== routeKey)
      return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
    })
  }, [navigation, routeKey])

  /** Not once the user has left: the answer must not move the screen they are on now. */
  const finish = useCallback(() => {
    if (!isMounted()) return
    leaveScreen()
    Alert.alert(LL.AccountScreen.totpDeactivated())
  }, [LL, isMounted, leaveScreen])

  const showError = useCallback(
    (message?: string) => {
      if (!isMounted()) return
      Alert.alert(LL.common.error(), message)
    },
    [LL, isMounted],
  )

  const showManualReset = useCallback(() => {
    reportBlocked()
    setIsManualResetVisible(true)
  }, [reportBlocked])

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
      /** No code is sent while the tier reached is unknown, after a launch or an
       *  account switch, nor once it is the one where the authenticator is mandatory. */
      if (!isTurnOffDecided) {
        setErrorMessage(LL.errors.generic())
        return
      }
      if (isTurnOffBlocked) {
        showManualReset()
        return
      }
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
          showManualReset()
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
        showError(refusal?.message)
      } catch (err) {
        const isAnswerLost = isNetworkFailure(err)
        const isTurnedOff = isAnswerLost && (await isTurnedOffOnServer())
        if (isTurnedOff) {
          finish()
          return
        }
        showError()
      } finally {
        setLoading(false)
      }
    },
    [
      LL,
      finish,
      isTurnOffBlocked,
      isTurnOffDecided,
      isTurnedOffOnServer,
      showError,
      showManualReset,
      totpDelete,
    ],
  )

  /** A removal that lands after the user left would have them back on a screen they
   *  never saw it from, and a code sent again from a new one would spend another try. */
  useCodeCheckHold(loading)

  /** A code typed again while one is checked would spend another of the hour's tries,
   *  and fail once the first has turned the authenticator off. */
  const { run } = useInFlightGuard()
  const send = useCallback(
    (code: string) => run(() => removeWithCode(code)),
    [run, removeWithCode],
  )

  const closeManualReset = useCallback(() => {
    setIsManualResetVisible(false)
    leaveScreen()
  }, [leaveScreen])

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
