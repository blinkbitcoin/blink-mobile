import React from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useUserPhoneDeleteMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { SettingsRow } from "../../row"
import { useLoginMethods } from "../login-methods-hook"
import { useTheme } from "@rn-vui/themed"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

gql`
  mutation userPhoneDelete {
    userPhoneDelete {
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
`

export const PhoneSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { loading, phone, emailVerified, phoneVerified } = useLoginMethods()
  const { updateCurrentProfile } = useSaveSessionProfile()

  const [phoneDeleteMutation, { loading: phoneDeleteLoading }] =
    useUserPhoneDeleteMutation()

  const deletePhone = async () => {
    try {
      await phoneDeleteMutation()
      await updateCurrentProfile()
      toastShow({
        message: LL.AccountScreen.phoneDeletedSuccessfully(),
        LL,
        type: "success",
      })
    } catch (err) {
      Alert.alert(LL.common.error(), err instanceof Error ? err.message : "")
    }
  }
  const deletePhonePrompt = async () => {
    Alert.alert(
      LL.AccountScreen.deletePhonePromptTitle(),
      LL.AccountScreen.deletePhonePromptContent(),
      [
        { text: LL.common.cancel(), onPress: () => {} },
        {
          text: LL.common.yes(),
          onPress: async () => {
            deletePhone()
          },
        },
      ],
    )
  }

  return (
    <SettingsRow
      loading={loading}
      title={phoneVerified ? phone || "" : LL.AccountScreen.tapToAddPhoneNumber()}
      leftIcon="call-outline"
      action={phoneVerified ? null : () => navigate("phoneRegistrationInitiate")}
      spinner={phoneDeleteLoading}
      rightIcon={
        phoneVerified ? (
          emailVerified ? (
            <GaloyIcon name="close" size={24} color={colors.red} />
          ) : null
        ) : (
          "chevron-forward"
        )
      }
      rightIconAction={phoneVerified && emailVerified ? deletePhonePrompt : undefined}
    />
  )
}
