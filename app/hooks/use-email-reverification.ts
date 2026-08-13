import { useCallback } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import {
  useUserEmailDeleteMutation,
  useUserEmailRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

gql`
  mutation userEmailDelete {
    userEmailDelete {
      errors {
        message
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

  mutation userEmailRegistrationInitiate($input: UserEmailRegistrationInitiateInput!) {
    userEmailRegistrationInitiate(input: $input) {
      errors {
        message
      }
      emailRegistrationId
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

/**
 * Re-verification for an address the account already holds. The registration
 * flow can't be re-run as-is — the backend refuses to initiate while any email
 * sits on the identity — so the stale one is deleted and set again in one go.
 * Shared by the account settings row and the security score card, which both
 * land on this state and must behave the same way.
 */
export const useEmailReverification = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [emailDeleteMutation, { loading: deleting }] = useUserEmailDeleteMutation()
  const [setEmailMutation, { loading: registering }] =
    useUserEmailRegistrationInitiateMutation()

  const confirmEmailAgain = useCallback(
    async (email: string) => {
      try {
        await emailDeleteMutation({
          // to avoid flacky behavior
          // this could lead to inconsistent state if delete works but set fails
          fetchPolicy: "no-cache",
        })

        const { data } = await setEmailMutation({
          variables: { input: { email } },
        })

        const errors = data?.userEmailRegistrationInitiate.errors
        if (errors && errors.length > 0) {
          Alert.alert(errors[0].message)
        }

        const emailRegistrationId =
          data?.userEmailRegistrationInitiate.emailRegistrationId

        if (emailRegistrationId) {
          navigate("emailRegistrationValidate", {
            emailRegistrationId,
            email,
          })
        } else {
          console.warn("no flow returned")
        }
      } catch (err) {
        console.error(err, "error in setEmailMutation")
      }
    },
    [emailDeleteMutation, setEmailMutation, navigate],
  )

  const promptReverification = useCallback(
    (email: string) => {
      Alert.alert(
        LL.AccountScreen.emailUnverified(),
        LL.AccountScreen.emailUnverifiedContent(),
        [
          { text: LL.common.cancel(), onPress: () => {} },
          {
            text: LL.common.ok(),
            onPress: () => confirmEmailAgain(email),
          },
        ],
      )
    },
    [LL, confirmEmailAgain],
  )

  return { promptReverification, spinner: deleting || registering }
}
