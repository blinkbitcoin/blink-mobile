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
import { canReturnToRoute, RootStackParamList } from "@app/navigation/stack-param-lists"
import { logTwoFactorSetupCompleted } from "@app/utils/analytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

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

export const TotpRegistrationValidateScreen: React.FC<Props> = ({ route }) => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "totpRegistrationValidate">
    >()

  const [totpRegistrationValidate] = useUserTotpRegistrationValidateMutation()

  const [errorMessage, setErrorMessage] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const { totpRegistrationId, returnTo } = route.params

  const { appConfig } = useAppConfig()
  const authToken = appConfig.token

  const { LL } = useI18nContext()
  const { tier } = useTwoFactorEnforcement()

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

        if (res.data?.userTotpRegistrationValidate.me?.totpEnabled) {
          logTwoFactorSetupCompleted({ tier })
          Alert.alert(LL.common.success(), LL.TotpRegistrationValidateScreen.success(), [
            {
              text: LL.common.ok(),
              onPress: () => {
                /** A flow opened from the two-factor setup returns into it; the setup
                 *  then steps aside to wherever it was opened from. */
                if (canReturnToRoute(navigation.getState(), returnTo)) {
                  navigation.popTo(returnTo)
                  return
                }
                navigation.reset({
                  routes: [
                    {
                      name: "Primary",
                    },
                    { name: "accountScreen" },
                  ],
                })
              },
            },
          ])
        }
      } catch (err) {
        console.error(err)
        Alert.alert(LL.common.error())
      } finally {
        setLoading(false)
      }
    },
    [
      navigation,
      LL,
      tier,
      totpRegistrationId,
      returnTo,
      authToken,
      totpRegistrationValidate,
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
