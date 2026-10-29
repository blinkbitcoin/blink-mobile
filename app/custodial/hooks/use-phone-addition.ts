import { useCallback } from "react"

import { useUserPhoneRegistrationValidateMutation } from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { LoginMethodRefusal } from "@app/types/two-factor-enforcement"
import { logAddPhoneAttempt } from "@app/utils/analytics"

import { useAccountReadBack } from "./use-account-read-back"

export type PhoneAdditionRequest = {
  phone: string
  smsCode: string
  totpCode: string
}

/**
 * Adds the phone number with its SMS code and the authenticator's, which the request
 * spends both of, so it is never sent twice. Hands back the server's refusal, if any,
 * and throws on a request that never answers and did not land.
 */
export const usePhoneAddition = () => {
  const [phoneValidate] = useUserPhoneRegistrationValidateMutation()
  const { accountId, readBack } = useAccountReadBack()

  /** Whether the number is on the account it was sent for, as the server has it. */
  const isAddedOnServer = useCallback(
    async (sentFor: string | undefined, phone: string): Promise<boolean> => {
      const account = await readBack(sentFor)
      if (!account) return false
      return account.phone === phone
    },
    [readBack],
  )

  /** An addition whose answer was lost may have landed, and sent again it would spend
   *  another try of each code on a number already added: the account is read instead,
   *  and the number on it counts as added. */
  const add = useCallback(
    async ({
      phone,
      smsCode,
      totpCode,
    }: PhoneAdditionRequest): Promise<LoginMethodRefusal | undefined> => {
      const sentFor = accountId
      logAddPhoneAttempt()
      try {
        const res = await phoneValidate({
          variables: { input: { phone, code: smsCode, totpCode } },
        })
        return res.data?.userPhoneRegistrationValidate.errors[0]
      } catch (err) {
        const isAnswerLost = isNetworkFailure(err)
        const isAdded = isAnswerLost && (await isAddedOnServer(sentFor, phone))
        if (!isAdded) throw err
        return undefined
      }
    },
    [accountId, isAddedOnServer, phoneValidate],
  )

  return { add }
}
