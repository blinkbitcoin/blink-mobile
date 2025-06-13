import * as React from "react"
import { useCallback, useState } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import { CodeInput } from "@app/components/code-input"
import { useUserEmailRegistrationValidateMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

gql`
  mutation userEmailRegistrationValidate($input: UserEmailRegistrationValidateInput!) {
    userEmailRegistrationValidate(input: $input) {
      errors {
        message
      }
      me {
        id
        email {
          address
          verified
        }
      }
    }
  }
`

type Props = {
  route: RouteProp<RootStackParamList, "emailRegistrationValidate">
}

export const EmailRegistrationValidateScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [errorMessage, setErrorMessage] = React.useState<string>("")

  const { LL } = useI18nContext()

  const [emailVerify] = useUserEmailRegistrationValidateMutation()

  const [loading, setLoading] = useState(false)
  const { emailRegistrationId, email, onboarding } = route.params

  const send = useCallback(
    async (code: string) => {
      try {
        setLoading(true)

        const res = await emailVerify({
          variables: { input: { code, emailRegistrationId } },
        })

        if (res.data?.userEmailRegistrationValidate.errors) {
          const error = res.data.userEmailRegistrationValidate.errors[0]?.message
          // TODO: manage translation for errors
          setErrorMessage(error)
        }

        if (res.data?.userEmailRegistrationValidate.me?.email?.verified) {
          Alert.alert(
            LL.common.success(),
            LL.EmailRegistrationValidateScreen.success({ email }),
            [
              {
                text: LL.common.ok(),
                onPress: () => {
                  if (onboarding) {
                    navigation.replace("onboarding", {
                      screen: "lightningBenefits",
                      params: { onboarding },
                    })
                    return
                  }

                  navigation.navigate("settings")
                },
              },
            ],
          )
        } else {
          throw new Error(LL.common.errorAuthToken())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [emailVerify, emailRegistrationId, navigation, LL, email, onboarding],
  )

  const header = LL.EmailRegistrationValidateScreen.header({ email })

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
