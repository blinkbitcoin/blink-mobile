import * as React from "react"
import { useCallback, useState, useEffect } from "react"
import { View, Keyboard, Modal } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"

import { gql } from "@apollo/client"
import { CodeInput } from "@app/components/code-input"
import { useUserEmailRegistrationValidateMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SuccessIconAnimation } from "@app/components/success-animation"
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

const SUCCESS_DELAY = 2000

export const EmailRegistrationValidateScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const styles = useStyles()

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

  useEffect(() => {
    if (!showSuccess) return

    const t = setTimeout(() => {
      if (onboarding) {
        onboardingNavigate()
        return
      }
      navigation.navigate("settings")
    }, SUCCESS_DELAY)

    return () => clearTimeout(t)
  }, [
    showSuccess,
    onboarding,
    onboardingNavigate,
    LL.common,
    LL.EmailRegistrationValidateScreen,
    email,
    navigation,
  ])

  const header = LL.EmailRegistrationValidateScreen.header({ email })

  return (
    <>
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccess(false)}
      >
        <View style={styles.successAnimationContainer}>
          <SuccessIconAnimation>
            <GaloyIcon name="email-add" size={110} />
            <Text type="h2" style={styles.successText}>
              {LL.common.success()}
            </Text>
          </SuccessIconAnimation>
        </View>
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

const useStyles = makeStyles(({ colors }) => ({
  successText: {
    marginTop: 20,
    textAlign: "center",
    alignSelf: "center",
  },
  successAnimationContainer: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
  },
}))
