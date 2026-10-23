import { useCallback } from "react"
import { Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { gql } from "@apollo/client"

import {
  SettingsScreenDocument,
  useSettingsScreenLazyQuery,
  useSettingsScreenQuery,
  useUserEmailDeleteMutation,
  useUserEmailRegistrationInitiateMutation,
  useUserPhoneDeleteMutation,
  useUserPhoneRegistrationValidateMutation,
} from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  ContactChangeStep,
  ContactChangeStepParams,
  ContactField,
} from "@app/types/two-factor-enforcement"

gql`
  mutation userPhoneDelete($input: UserPhoneDeleteInput) {
    userPhoneDelete(input: $input) {
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

/** Why the server refused a step, as its payload says it. */
export type ContactChangeRefusal = {
  code?: string | null
  message?: string
}

/** A step either ran and moved the flow on, or the server refused it. */
export type ContactChangeOutcome =
  | { isDone: true }
  | { isDone: false; refusal: ContactChangeRefusal }

const DONE: ContactChangeOutcome = { isDone: true }

const refusedWith = (refusal: ContactChangeRefusal): ContactChangeOutcome => ({
  isDone: false,
  refusal,
})

/**
 * Runs each step of a login method change with the authenticator's code the server
 * asks for, and moves the flow on to what follows it: a removal opens the flow that
 * adds the new one, an addition its own confirmation. The server has no change of its
 * own, so a change is the removal of the method followed by the addition of the new one,
 * each checked with a code of its own. Throws on a request that never answers.
 */
export const useContactChangeSteps = () => {
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "contactChangeCode">>()
  const { updateCurrentProfile } = useSaveSessionProfile()

  const [emailDelete] = useUserEmailDeleteMutation()
  const [emailRegistrationInitiate] = useUserEmailRegistrationInitiateMutation()
  const [phoneDelete] = useUserPhoneDeleteMutation()
  const [phoneRegistrationValidate] = useUserPhoneRegistrationValidateMutation()
  const [readAccount] = useSettingsScreenLazyQuery({ fetchPolicy: "network-only" })
  /** The account the change is for, as the settings read it. */
  const { data: accountData } = useSettingsScreenQuery({ fetchPolicy: "cache-only" })
  const accountId = accountData?.me?.id

  /** Whether the method is gone on the server, read from the network, on the account
   *  the removal was sent for: a session switched meanwhile reads another one. A read
   *  that fails is no proof it is. */
  const isRemovedOnServer = useCallback(
    async (field: ContactField, sentFor: string | undefined): Promise<boolean> => {
      try {
        const { data, error } = await readAccount()
        if (error) return false
        const me = data?.me
        if (!me) return false
        const isAccountSentFor = me.id === sentFor
        if (!isAccountSentFor) return false
        if (field === ContactField.Email) return !me.email?.address
        return !me.phone
      } catch {
        return false
      }
    },
    [readAccount],
  )

  /** Sends a removal and hands back its refusal, if any. A removal whose answer was
   *  lost may have landed, and sent again it would be refused, as there is nothing left
   *  to remove: the account is read instead, and a method gone counts as removed. */
  const removeOrConfirmRemoved = useCallback(
    async (
      field: ContactField,
      remove: () => Promise<ContactChangeRefusal | undefined>,
    ): Promise<ContactChangeRefusal | undefined> => {
      const sentFor = accountId
      try {
        return await remove()
      } catch (err) {
        const isAnswerLost = isNetworkFailure(err)
        const isRemoved = isAnswerLost && (await isRemovedOnServer(field, sentFor))
        if (!isRemoved) throw err
        return undefined
      }
    },
    [accountId, isRemovedOnServer],
  )

  const removeEmail = useCallback(
    async (totpCode: string): Promise<ContactChangeOutcome> => {
      const refusal = await removeOrConfirmRemoved(ContactField.Email, async () => {
        const res = await emailDelete({
          variables: { input: { totpCode } },
          refetchQueries: [SettingsScreenDocument],
        })
        return res.data?.userEmailDelete.errors[0]
      })
      if (refusal) return refusedWith(refusal)
      await updateCurrentProfile()
      navigation.replace("emailRegistrationInitiate")
      return DONE
    },
    [removeOrConfirmRemoved, emailDelete, updateCurrentProfile, navigation],
  )

  const addEmail = useCallback(
    async (email: string, totpCode: string): Promise<ContactChangeOutcome> => {
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

  /** The address is removed and registered again under the same code. Once removed,
   *  the screen asks only to add it, should the second request fail: a removal sent
   *  again would be refused, as there is no address left. */
  const confirmEmailAgain = useCallback(
    async (email: string, totpCode: string): Promise<ContactChangeOutcome> => {
      const refusal = await removeOrConfirmRemoved(ContactField.Email, async () => {
        const res = await emailDelete({
          variables: { input: { totpCode } },
          refetchQueries: [SettingsScreenDocument],
        })
        return res.data?.userEmailDelete.errors[0]
      })
      if (refusal) return refusedWith(refusal)
      navigation.setParams({ step: ContactChangeStep.EmailAdd, email })
      return addEmail(email, totpCode)
    },
    [removeOrConfirmRemoved, emailDelete, navigation, addEmail],
  )

  const removePhone = useCallback(
    async (totpCode: string): Promise<ContactChangeOutcome> => {
      const refusal = await removeOrConfirmRemoved(ContactField.Phone, async () => {
        const res = await phoneDelete({
          variables: { input: { totpCode } },
          refetchQueries: [SettingsScreenDocument],
        })
        return res.data?.userPhoneDelete.errors[0]
      })
      if (refusal) return refusedWith(refusal)
      await updateCurrentProfile()
      navigation.replace("phoneRegistrationInitiate")
      return DONE
    },
    [removeOrConfirmRemoved, phoneDelete, updateCurrentProfile, navigation],
  )

  const addPhone = useCallback(
    async (
      phone: string,
      smsCode: string,
      totpCode: string,
    ): Promise<ContactChangeOutcome> => {
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
      params: ContactChangeStepParams,
      totpCode: string,
    ): Promise<ContactChangeOutcome> => {
      switch (params.step) {
        case ContactChangeStep.EmailRemove:
          return removeEmail(totpCode)
        case ContactChangeStep.EmailAdd:
          return addEmail(params.email, totpCode)
        case ContactChangeStep.EmailReverify:
          return confirmEmailAgain(params.email, totpCode)
        case ContactChangeStep.PhoneRemove:
          return removePhone(totpCode)
        case ContactChangeStep.PhoneAdd:
          return addPhone(params.phone, params.smsCode, totpCode)
      }
    },
    [removeEmail, addEmail, confirmEmailAgain, removePhone, addPhone],
  )

  return { run }
}
