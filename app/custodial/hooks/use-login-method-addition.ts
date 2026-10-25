import { useCallback } from "react"
import { Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import {
  useUserEmailRegistrationInitiateMutation,
  useUserPhoneRegistrationValidateMutation,
} from "@app/graphql/generated"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  LoginMethodAddition,
  LoginMethodAdditionParams,
  LoginMethodRefusal,
} from "@app/types/two-factor-enforcement"
import { logAddPhoneAttempt } from "@app/utils/analytics"

import { useEmailRemoval } from "./use-email-removal"

/** An addition either ran and moved the flow on, or the server refused it. */
export type LoginMethodAdditionOutcome =
  | { isDone: true }
  | { isDone: false; refusal: LoginMethodRefusal }

const DONE: LoginMethodAdditionOutcome = { isDone: true }

const refusedWith = (refusal: LoginMethodRefusal): LoginMethodAdditionOutcome => ({
  isDone: false,
  refusal,
})

/**
 * Runs the addition of a login method with the authenticator's code the server asks
 * for, and moves the flow on to the addition's own confirmation. Confirming an email
 * again removes it first, with no code, as the server refuses to register an address
 * while one is on the account. Throws on a request that never answers.
 */
export const useLoginMethodAddition = () => {
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "loginMethodCode">>()
  const { updateCurrentProfile } = useSaveSessionProfile()
  const { remove: removeEmail } = useEmailRemoval()

  const [emailRegistrationInitiate] = useUserEmailRegistrationInitiateMutation()
  const [phoneRegistrationValidate] = useUserPhoneRegistrationValidateMutation()

  const addEmail = useCallback(
    async (email: string, totpCode: string): Promise<LoginMethodAdditionOutcome> => {
      const res = await emailRegistrationInitiate({
        variables: { input: { email, totpCode } },
      })
      const payload = res.data?.userEmailRegistrationInitiate
      const refusal = payload?.errors[0]
      if (refusal) return refusedWith(refusal)
      const emailRegistrationId = payload?.emailRegistrationId
      if (!emailRegistrationId) {
        return refusedWith({
          message: LL.EmailRegistrationInitiateScreen.missingEmailRegistrationId(),
        })
      }
      navigation.replace("emailRegistrationValidate", { emailRegistrationId, email })
      return DONE
    },
    [emailRegistrationInitiate, navigation, LL],
  )

  /** The address is removed and registered again with the code. Once removed, the
   *  screen asks only to add it, should the registration fail: a removal sent again
   *  would be refused, as there is no address left. */
  const confirmEmailAgain = useCallback(
    async (email: string, totpCode: string): Promise<LoginMethodAdditionOutcome> => {
      const refusal = await removeEmail()
      if (refusal) return refusedWith(refusal)
      navigation.setParams({ addition: LoginMethodAddition.Email, email })
      return addEmail(email, totpCode)
    },
    [removeEmail, navigation, addEmail],
  )

  const addPhone = useCallback(
    async (
      phone: string,
      smsCode: string,
      totpCode: string,
    ): Promise<LoginMethodAdditionOutcome> => {
      logAddPhoneAttempt()
      const res = await phoneRegistrationValidate({
        variables: { input: { phone, code: smsCode, totpCode } },
      })
      const refusal = res.data?.userPhoneRegistrationValidate.errors[0]
      if (refusal) return refusedWith(refusal)
      await updateCurrentProfile()
      Alert.alert(LL.PhoneRegistrationValidateScreen.successTitle(), undefined, [
        { text: LL.common.ok(), onPress: () => navigation.popTo("settings") },
      ])
      return DONE
    },
    [phoneRegistrationValidate, updateCurrentProfile, navigation, LL],
  )

  const run = useCallback(
    (
      params: LoginMethodAdditionParams,
      totpCode: string,
    ): Promise<LoginMethodAdditionOutcome> => {
      switch (params.addition) {
        case LoginMethodAddition.Email:
          return addEmail(params.email, totpCode)
        case LoginMethodAddition.EmailReverify:
          return confirmEmailAgain(params.email, totpCode)
        case LoginMethodAddition.Phone:
          return addPhone(params.phone, params.smsCode, totpCode)
      }
    },
    [addEmail, confirmEmailAgain, addPhone],
  )

  return { run }
}
