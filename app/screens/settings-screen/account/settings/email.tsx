import React from "react"
import { Alert } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useUserEmailDeleteMutation } from "@app/graphql/generated"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme } from "@rn-vui/themed"

import { SettingsRow } from "../../row"
import { useLoginMethods } from "../login-methods-hook"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

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
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { loading, email, emailVerified, bothEmailAndPhoneVerified } = useLoginMethods()
  const { updateCurrentProfile } = useSaveSessionProfile()

  const [emailDeleteMutation, { loading: emDelLoading }] = useUserEmailDeleteMutation()
  const { promptReverification, spinner: reverifying } = useEmailReverification()

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

  const rightIconAction = email
    ? () => {
        if (emailVerified) {
          if (bothEmailAndPhoneVerified) {
            deleteEmailPrompt()
          }
          return
        }
        promptReverification(email)
      }
    : undefined

  const RightIcon = email ? (
    emailVerified ? (
      bothEmailAndPhoneVerified ? (
        <GaloyIcon name="close" size={20} color={colors.red} />
      ) : null
    ) : (
      <GaloyIcon name="refresh" size={20} color={colors.primary} />
    )
  ) : undefined

  return (
    <SettingsRow
      loading={loading}
      spinner={emDelLoading || reverifying}
      title={title(email, emailVerified, LL)}
      leftGaloyIcon="email-add"
      action={email ? null : () => navigate("emailRegistrationInitiate")}
      rightIcon={RightIcon}
      rightIconAction={rightIconAction}
    />
  )
}
