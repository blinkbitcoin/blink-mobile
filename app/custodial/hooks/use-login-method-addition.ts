import { useCallback } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useUserEmailRegistrationInitiateMutation } from "@app/graphql/generated"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  LoginMethodAddition,
  LoginMethodAdditionParams,
  LoginMethodAdditionResult,
  LoginMethodRefusal,
} from "@app/types/two-factor-enforcement"
import { reportError } from "@app/utils/error-logging"

import { useEmailRemoval } from "./use-email-removal"
import { PhoneAdditionRequest, usePhoneAddition } from "./use-phone-addition"

export type LoginMethodAdditionOutcome =
  | {
      result: typeof LoginMethodAdditionResult.EmailRegistered
      email: string
      emailRegistrationId: string
    }
  | { result: typeof LoginMethodAdditionResult.PhoneAdded }
  | { result: typeof LoginMethodAdditionResult.Refused; refusal: LoginMethodRefusal }
  | { result: typeof LoginMethodAdditionResult.Abandoned }

const PHONE_ADDED: LoginMethodAdditionOutcome = {
  result: LoginMethodAdditionResult.PhoneAdded,
}
const ABANDONED: LoginMethodAdditionOutcome = {
  result: LoginMethodAdditionResult.Abandoned,
}

const refusedWith = (refusal: LoginMethodRefusal): LoginMethodAdditionOutcome => ({
  result: LoginMethodAdditionResult.Refused,
  refusal,
})

type LoginMethodAdditionRun = {
  params: LoginMethodAdditionParams
  totpCode: string
  /** Whether the screen and the session the addition began under are still there. */
  isOwnSession: () => boolean
}

/**
 * Runs each addition of a login method with the authenticator's code the server asks
 * for, and says how it ended; the screen shows it. Confirming an email again removes it
 * first, with no code, as the server refuses to register an address while one is on
 * the account. Each request goes through the client of the moment, so nothing more is
 * sent once the session it began under is gone. Throws on a request that never answers.
 */
export const useLoginMethodAddition = () => {
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "loginMethodCode">>()
  const { updateCurrentProfile } = useSaveSessionProfile()
  const { remove: removeEmail } = useEmailRemoval()
  const { add: addPhoneWithCodes } = usePhoneAddition()

  const [emailRegistrationInitiate] = useUserEmailRegistrationInitiateMutation()

  /** Once the server has made a change, a profile that fails to save afterwards is
   *  reported, not shown as a failure the user would try again. */
  const saveProfile = useCallback(async () => {
    try {
      await updateCurrentProfile()
    } catch (err) {
      reportError("login-method-addition", err)
    }
  }, [updateCurrentProfile])

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
      return {
        result: LoginMethodAdditionResult.EmailRegistered,
        email,
        emailRegistrationId,
      }
    },
    [emailRegistrationInitiate, LL],
  )

  /** The address is removed and registered again with the code. Once removed, the
   *  screen asks only to add it, should the registration fail: a removal sent again
   *  would be refused, as there is no address left. A session switched after the
   *  removal leaves the account without its address rather than register it on the
   *  other one. */
  const confirmEmailAgain = useCallback(
    async (
      email: string,
      totpCode: string,
      isOwnSession: () => boolean,
    ): Promise<LoginMethodAdditionOutcome> => {
      const refusal = await removeEmail()
      if (refusal) return refusedWith(refusal)
      if (!isOwnSession()) return ABANDONED
      await saveProfile()
      if (!isOwnSession()) return ABANDONED
      navigation.setParams({ addition: LoginMethodAddition.Email, email })
      return addEmail(email, totpCode)
    },
    [removeEmail, saveProfile, navigation, addEmail],
  )

  /** Once the server has the number, the addition is done, whatever happens to the
   *  profile saved after it. */
  const addPhone = useCallback(
    async (
      request: PhoneAdditionRequest,
      isOwnSession: () => boolean,
    ): Promise<LoginMethodAdditionOutcome> => {
      const refusal = await addPhoneWithCodes(request)
      if (refusal) return refusedWith(refusal)
      if (isOwnSession()) await saveProfile()
      return PHONE_ADDED
    },
    [addPhoneWithCodes, saveProfile],
  )

  const run = useCallback(
    ({
      params,
      totpCode,
      isOwnSession,
    }: LoginMethodAdditionRun): Promise<LoginMethodAdditionOutcome> => {
      switch (params.addition) {
        case LoginMethodAddition.Email:
          return addEmail(params.email, totpCode)
        case LoginMethodAddition.EmailReverify:
          return confirmEmailAgain(params.email, totpCode, isOwnSession)
        case LoginMethodAddition.Phone:
          return addPhone(
            { phone: params.phone, smsCode: params.smsCode, totpCode },
            isOwnSession,
          )
      }
    },
    [addEmail, confirmEmailAgain, addPhone],
  )

  return { run }
}
