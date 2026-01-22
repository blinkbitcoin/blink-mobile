import React from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import {
  useUserEmailDeleteMutation,
  useUserEmailRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { useTheme } from "@rn-vui/themed"

import { SettingsRow } from "../../row"
import { useLoginMethods } from "../login-methods-hook"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

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

const title = (
  email: string | undefined,
  emailVerified: boolean,
  LL: TranslationFunctions,
): string => {
  if (email) {
    if (emailVerified) return email?.toString()
    return LL.AccountScreen.unverifiedEmail()
  }
  return LL.AccountScreen.tapToAddEmail()
}

export const EmailSetting: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { loading, email, emailVerified, bothEmailAndPhoneVerified } = useLoginMethods()
  const { updateCurrentProfile } = useSaveSessionProfile()

  const [emailDeleteMutation, { loading: emDelLoading }] = useUserEmailDeleteMutation()
  const [setEmailMutation, { loading: emRegLoading }] =
    useUserEmailRegistrationInitiateMutation()

  const deleteEmail = async () => {
    try {
      await emailDeleteMutation()
      await updateCurrentProfile()
      toastShow({
        type: "success",
        message: LL.AccountScreen.emailDeletedSuccessfully(),
        LL,
      })
    } catch (err) {
      Alert.alert(LL.common.error(), err instanceof Error ? err.message : "")
    }
  }

  const deleteEmailPrompt = async () => {
    Alert.alert(
      LL.AccountScreen.deleteEmailPromptTitle(),
      LL.AccountScreen.deleteEmailPromptContent(),
      [
        { text: LL.common.cancel(), onPress: () => {} },
        {
          text: LL.common.yes(),
          onPress: async () => {
            deleteEmail()
          },
        },
      ],
    )
  }

  const tryConfirmEmailAgain = async (email: string) => {
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

      const emailRegistrationId = data?.userEmailRegistrationInitiate.emailRegistrationId

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
  }

  const reVerifyEmailPrompt = () => {
    if (!email) return
    Alert.alert(
      LL.AccountScreen.emailUnverified(),
      LL.AccountScreen.emailUnverifiedContent(),
      [
        { text: LL.common.cancel(), onPress: () => {} },
        {
          text: LL.common.ok(),
          onPress: () => tryConfirmEmailAgain(email),
        },
      ],
    )
  }

  const rightIconAction = email
    ? () => {
        if (emailVerified) {
          if (bothEmailAndPhoneVerified) {
            deleteEmailPrompt()
          }
          return
        }
        reVerifyEmailPrompt()
      }
    : undefined

  const RightIcon = email ? (
    emailVerified ? (
      bothEmailAndPhoneVerified ? (
        <GaloyIcon name="close" size={24} color={colors.red} />
      ) : null
    ) : (
      <GaloyIcon name="refresh" size={24} color={colors.primary} />
    )
  ) : undefined

  return (
    <SettingsRow
      loading={loading}
      spinner={emDelLoading || emRegLoading}
      title={title(email, emailVerified, LL)}
      leftIcon="mail-outline"
      action={email ? null : () => navigate("emailRegistrationInitiate")}
      rightIcon={RightIcon}
      rightIconAction={rightIconAction}
    />
  )
}
