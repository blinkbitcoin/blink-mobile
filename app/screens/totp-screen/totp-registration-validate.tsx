import React, { useCallback, useEffect, useState } from "react"
import { Alert } from "react-native"

import { gql } from "@apollo/client"
import { CodeInput } from "@app/components/code-input"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import {
  SettingsScreenDocument,
  useTotpRegistrationStateLazyQuery,
  useUserTotpRegistrationValidateMutation,
} from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
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

  query totpRegistrationState {
    me {
      id
      totpEnabled
    }
  }
`

type Props = {
  route: RouteProp<RootStackParamList, "totpRegistrationValidate">
}

/** How long a code check may hold the user's ways back: a request that never settles
 *  must not keep them on the screen for good. */
const CODE_CHECK_HOLD_MS = 20_000

/** The registrations a code was sent for whose answer never came back: the server may
 *  have taken it. Kept by registration rather than by screen, since the setup key's Next
 *  opens a new code screen for the same one. */
const registrationsInDoubt = new Set<string>()

/** The code screen. A valid code adds the authenticator and moves on to the backup of
 *  its setup key, which takes the place of the screens behind it. */
export const TotpRegistrationValidateScreen: React.FC<Props> = ({ route }) => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "totpRegistrationValidate">
    >()
  const { showBackup, registrationPrompt } = useTotpRegistrationFlow()

  const [totpRegistrationValidate] = useUserTotpRegistrationValidateMutation()
  const [readRegistrationState] = useTotpRegistrationStateLazyQuery({
    fetchPolicy: "network-only",
  })

  const [errorMessage, setErrorMessage] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const { totpRegistrationId, secret } = route.params

  const { appConfig } = useAppConfig()
  const authToken = appConfig.token

  const { LL } = useI18nContext()
  /** Read before the registration lands: once it does, the account owes nothing, and
   *  what the event measures is the tier the setup answered. */
  const { tier, isEnforced } = useTwoFactorEnforcement()

  /** The account's id once its authenticator is on, as the server has it: an answer
   *  lost on the way back, or a second try refused because the first one landed, says
   *  nothing of a code the server accepted. Undefined when it is off or cannot be read.
   *  Asked only once this registration lost an answer: an authenticator turned on by
   *  another registration, on another device or an earlier try, holds another key than
   *  the one this screen would back up. */
  const enabledAccountId = useCallback(async (): Promise<string | undefined> => {
    try {
      const { data } = await readRegistrationState()
      const me = data?.me
      return me?.totpEnabled ? me.id : undefined
    } catch {
      return undefined
    }
  }, [readRegistrationState])

  const send = useCallback(
    async (code: string) => {
      /** Read while the registration is still on the stack: an answer can land once it
       *  is gone. */
      const prompt = registrationPrompt()
      const complete = (userId: string) => {
        registrationsInDoubt.delete(totpRegistrationId)
        logTwoFactorSetupCompleted({ tier, isEnforced, prompt })
        showBackup({ secret, userId })
      }
      try {
        setLoading(true)

        const res = await totpRegistrationValidate({
          variables: { input: { totpCode: code, totpRegistrationId, authToken } },
          refetchQueries: [SettingsScreenDocument],
        })

        const payload = res.data?.userTotpRegistrationValidate
        const acceptedAccountId = payload?.me?.totpEnabled ? payload.me.id : undefined
        const isEarlierTryInDoubt =
          registrationsInDoubt.has(totpRegistrationId) && !acceptedAccountId
        const recoveredAccountId = isEarlierTryInDoubt
          ? await enabledAccountId()
          : undefined
        const userId = acceptedAccountId ?? recoveredAccountId
        if (userId) {
          complete(userId)
          return
        }

        if (payload?.errors) {
          const error = payload.errors[0]?.message
          // TODO: manage translation for errors
          setErrorMessage(error)
        }
      } catch (err) {
        /** Only a request that may have reached the server without its answer coming
         *  back; one the server answered with an error took no code. */
        const isAnswerLost = isNetworkFailure(err)
        if (isAnswerLost) registrationsInDoubt.add(totpRegistrationId)
        const userId = isAnswerLost ? await enabledAccountId() : undefined
        if (userId) {
          complete(userId)
          return
        }
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
      enabledAccountId,
      showBackup,
    ],
  )

  /**
   * A code accepted after the user left would enable the authenticator with the setup
   * key's backup gone with the screen. While the code is checked, the user's own ways
   * back are refused: the header arrow and the hardware back through the navigator, and
   * the swipe, which the native stack cannot refuse, switched off. A reset the app
   * dispatches itself, a logout or an account switch, still goes through, and so does
   * the user once a check has taken too long to answer. The route says so for as long,
   * which is what holds links meanwhile.
   */
  useEffect(() => {
    if (!loading) return
    navigation.setOptions({ gestureEnabled: false })
    navigation.setParams({ isChecking: true })
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
      /** Not on a screen the answer already took off the stack: no navigator is left to
       *  take the params. */
      const isScreenOpen = navigation
        .getState()
        .routes.some((stackRoute) => stackRoute.key === route.key)
      if (isScreenOpen) navigation.setParams({ isChecking: false })
    }
    const timeout = setTimeout(release, CODE_CHECK_HOLD_MS)
    return () => {
      clearTimeout(timeout)
      release()
    }
  }, [loading, navigation, route.key])

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
