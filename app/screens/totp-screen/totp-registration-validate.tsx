import React, { useCallback, useEffect, useState } from "react"
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
import { isBackwardAction, RootStackParamList } from "@app/navigation/stack-param-lists"
import { logTwoFactorSetupCompleted } from "@app/utils/analytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

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

/** How long a code check may hold the user's ways back: a request that never settles
 *  must not keep them on the screen for good. */
const CODE_CHECK_HOLD_MS = 20_000

/** The code screen. A valid code adds the authenticator and moves on to the backup of
 *  its setup key, which takes the place of the screens behind it. */
export const TotpRegistrationValidateScreen: React.FC<Props> = ({ route }) => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "totpRegistrationValidate">
    >()
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
      /** Read while the registration is still on the stack: an answer can land once it
       *  is gone. */
      const prompt = registrationPrompt()
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
          logTwoFactorSetupCompleted({ tier, isEnforced, prompt })
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

  /**
   * A code accepted after the user left would enable the authenticator with the setup
   * key's backup gone with the screen. While the code is checked, the user's own ways
   * back are refused: the header arrow and the hardware back through the navigator, and
   * the swipe, which the native stack cannot refuse, switched off. A reset the app
   * dispatches itself, a logout or an account switch, still goes through, and so does
   * the user once a check has taken too long to answer.
   */
  useEffect(() => {
    if (!loading) return
    navigation.setOptions({ gestureEnabled: false })
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isBackwardAction(event.data.action)) return
      event.preventDefault()
    })
    let isHeld = true
    const release = () => {
      if (!isHeld) return
      isHeld = false
      unsubscribe()
      navigation.setOptions({ gestureEnabled: true })
    }
    const timeout = setTimeout(release, CODE_CHECK_HOLD_MS)
    return () => {
      clearTimeout(timeout)
      release()
    }
  }, [loading, navigation])

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
