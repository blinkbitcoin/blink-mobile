import React from "react"
import { Alert, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
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
import { makeStyles, useTheme } from "@rn-vui/themed"

import { SettingsRow } from "../../row"
import { useLoginMethods } from "../login-methods-hook"

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
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { loading, email, emailVerified, bothEmailAndPhoneVerified } = useLoginMethods()

  const [emailDeleteMutation, { loading: emDelLoading }] = useUserEmailDeleteMutation()
  const [setEmailMutation, { loading: emRegLoading }] =
    useUserEmailRegistrationInitiateMutation()

  const deleteEmail = async () => {
    try {
      await emailDeleteMutation()
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

  const RightIcon = email ? (
    <View style={styles.sidetoside}>
      {!emailVerified && (
        <GaloyIconButton name="refresh" size="medium" onPress={reVerifyEmailPrompt} />
      )}
      {(bothEmailAndPhoneVerified || (email && !emailVerified)) && (
        <GaloyIconButton
          name="close"
          size="medium"
          iconOnly
          onPress={deleteEmailPrompt}
          color={colors.red}
        />
      )}
    </View>
  ) : undefined

  return (
    <SettingsRow
      loading={loading}
      spinner={emDelLoading || emRegLoading}
      title={title(email, emailVerified, LL)}
      leftIcon="mail-outline"
      action={email ? null : () => navigate("emailRegistrationInitiate")}
      rightIcon={RightIcon}
    />
  )
}

const useStyles = makeStyles(() => ({
  sidetoside: {
    display: "flex",
    flexDirection: "row",
    columnGap: 10,
    marginRight: -5,
  },
}))
