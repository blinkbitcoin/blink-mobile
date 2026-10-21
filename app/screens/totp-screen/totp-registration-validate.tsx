import React, { useCallback, useState } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import { CodeInput } from "@app/components/code-input"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import {
  SettingsScreenDocument,
  useUserTotpRegistrationValidateMutation,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logTwoFactorSetupCompleted } from "@app/utils/analytics"
import { RouteProp } from "@react-navigation/native"

import { useTotpRegistrationFlow } from "./hooks/use-totp-registration-flow"

gql`
  mutation userTotpRegistrationValidate($input: UserTotpRegistrationValidateInput!) {
    userTotpRegistrationValidate(input: $input) {
      errors {
        message
      }
      me {
        id
        totpEnabled
        phone
        email {
          address
          verified
        }
      }
    }
  }
`

type Props = {
  route: RouteProp<RootStackParamList, "totpRegistrationValidate">
}

/** The code screen. A valid code adds the authenticator and moves on to the backup of
 *  its setup key, which takes the place of the screens behind it. */
export const TotpRegistrationValidateScreen: React.FC<Props> = ({ route }) => {
  const { showBackup, registrationPrompt } = useTotpRegistrationFlow()

  const [totpRegistrationValidate] = useUserTotpRegistrationValidateMutation()

  const [errorMessage, setErrorMessage] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const { totpRegistrationId, secret } = route.params

  const { appConfig } = useAppConfig()
  const authToken = appConfig.token

  const { LL } = useI18nContext()
  /** Read before the registration lands: once it does, the account owes nothing, and
   *  what the event measures is the tier the setup answered. */
  const { tier, isEnforced } = useTwoFactorEnforcement()

  const send = useCallback(
    async (code: string) => {
      try {
        setLoading(true)

        const res = await totpRegistrationValidate({
          variables: { input: { totpCode: code, totpRegistrationId, authToken } },
          refetchQueries: [SettingsScreenDocument],
        })

        if (res.data?.userTotpRegistrationValidate.errors) {
          const error = res.data.userTotpRegistrationValidate.errors[0]?.message
          // TODO: manage translation for errors
          setErrorMessage(error)
        }

        const me = res.data?.userTotpRegistrationValidate.me
        if (me?.totpEnabled) {
          logTwoFactorSetupCompleted({ tier, isEnforced, prompt: registrationPrompt() })
          showBackup({ secret, userId: me.id })
        }
      } catch (err) {
        console.error(err)
        Alert.alert(LL.common.error())
      } finally {
        setLoading(false)
      }
    },
    [
      LL,
      tier,
      isEnforced,
      registrationPrompt,
      totpRegistrationId,
      secret,
      authToken,
      totpRegistrationValidate,
      showBackup,
    ],
  )

  const header = LL.TotpRegistrationValidateScreen.enter6digitCode()

  return (
    <CodeInput
      send={send}
      header={header}
      loading={loading}
      errorMessage={errorMessage}
      setErrorMessage={setErrorMessage}
    />
  )
}
