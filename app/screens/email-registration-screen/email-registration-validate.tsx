import * as React from "react"
import { useCallback, useState } from "react"
import { Keyboard, Modal } from "react-native"

import { gql } from "@apollo/client"
import { CodeInput } from "@app/components/code-input"
import { useUserEmailRegistrationValidateMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { SuccessScreen } from "@app/components/success-screen"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [errorMessage, setErrorMessage] = React.useState<string>("")

  const { LL } = useI18nContext()
  const { updateCurrentProfile } = useSaveSessionProfile()

  const [emailVerify] = useUserEmailRegistrationValidateMutation()

  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const { emailRegistrationId, email, onboarding, hasUsername = false } = route.params

  const onboardingNavigate = useCallback(() => {
    if (hasUsername) {
      navigation.replace("onboarding", {
        screen: "supportScreen",
        params: { canGoBack: false },
      })
      return
    }

    navigation.replace("onboarding", {
      screen: "lightningBenefits",
      params: { onboarding, canGoBack: false },
    })
  }, [navigation, onboarding, hasUsername])

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
          await updateCurrentProfile()
          Keyboard.dismiss()
          setShowSuccess(true)
        } else {
          throw new Error(LL.common.errorAuthToken())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [emailVerify, emailRegistrationId, LL.common, updateCurrentProfile],
  )

  const leaveAfterSuccess = useCallback(() => {
    if (onboarding) {
      onboardingNavigate()
      return
    }
    navigation.popTo("settings")
  }, [onboarding, onboardingNavigate, navigation])

  const header = LL.EmailRegistrationValidateScreen.header({ email })

  return (
    <>
      <Modal
        visible={showSuccess}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowSuccess(false)}
      >
        <SuccessScreen
          title={LL.EmailRegistrationValidateScreen.emailVerified()}
          subtitle={email}
          onHoldEnd={leaveAfterSuccess}
        />
      </Modal>

      <CodeInput
        send={send}
        header={header}
        loading={loading}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
      />
    </>
  )
}
