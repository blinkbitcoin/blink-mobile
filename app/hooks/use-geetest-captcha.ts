import { useCallback, useEffect, useRef, useState } from "react"
import { EventSubscription, NativeEventEmitter, NativeModules } from "react-native"

import { gql } from "@apollo/client"
import { useCaptchaCreateChallengeMutation } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { logStartCaptcha } from "@app/utils/analytics"
import GeetestModule from "@galoymoney/react-native-geetest-module"

type GeetestValidationData = {
  geetestChallenge: string
  geetestSecCode: string
  geetestValidate: string
}

type GeetestCaptchaReturn = {
  geetestError: string | null
  geetestValidationData: GeetestValidationData | null
  loadingRegisterCaptcha: boolean
  registerCaptcha: () => void
  resetError: () => void
  resetValidationData: () => void
}

gql`
  mutation captchaCreateChallenge {
    captchaCreateChallenge {
      errors {
        message
      }
      result {
        id
        challengeCode
        newCaptcha
        failbackMode
      }
    }
  }
`

export const useGeetestCaptcha = (): GeetestCaptchaReturn => {
  const [geetestValidationData, setGeetesValidationData] =
    useState<GeetestValidationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { LL } = useI18nContext()
  const onGeeTestDialogResultListener = useRef<EventSubscription | undefined>(undefined)
  const onGeeTestFailedListener = useRef<EventSubscription | undefined>(undefined)

  const [captchaCreateChallenge, { loading: loadingRegisterCaptcha }] =
    useCaptchaCreateChallengeMutation({
      fetchPolicy: "no-cache",
    })

  const resetValidationData = useCallback(
    () => setGeetesValidationData(null),
    [setGeetesValidationData],
  )

  const resetError = useCallback(() => setError(null), [setError])

  const registerCaptcha = useCallback(async () => {
    logStartCaptcha()

    const { data } = await captchaCreateChallenge()
    const result = data?.captchaCreateChallenge?.result
    const errors = data?.captchaCreateChallenge?.errors ?? []
    if (errors.length > 0) {
      setError(errors[0].message)
    } else if (result) {
      const params = {
        success: result.failbackMode ? 0 : 1,
        challenge: result.challengeCode,
        gt: result.id,
        // eslint-disable-next-line camelcase
        new_captcha: result.newCaptcha,
      }

      // Test only
      // TODO: mock whole hook instead?
      if (
        // those values are part of the Mocked queriies from apollo MockedProvider
        // used in storybook
        result.id === "d5cdc22925d10bc4720d012ba48dd214" &&
        result.challengeCode === "af073125d936ff9e5aa4c1ed44a38d5d"
      ) {
        setGeetesValidationData({
          geetestChallenge: "af073125d936ff9e5aa4c1ed44a38d5d4s",
          geetestSecCode: "290cc148dfb39afb5af63320469facd6",
          geetestValidate: "290cc148dfb39afb5af63320469facd6|jordan",
        })
        return
      }

      GeetestModule.handleRegisteredGeeTestCaptcha(JSON.stringify(params))
    } else {
      setError(LL.errors.generic())
    }
  }, [captchaCreateChallenge, LL])

  useEffect(() => {
    GeetestModule.setUp()

    const eventEmitter = new NativeEventEmitter(NativeModules.GeetestModule)

    onGeeTestDialogResultListener.current = eventEmitter.addListener(
      "GT3-->onDialogResult-->",
      (event) => {
        // on failed test the result is {"result": "{\"geetest_challenge\":\"\"}"}
        const {
          geetest_challenge: geetestChallenge,
          geetest_seccode: geetestSecCode,
          geetest_validate: geetestValidate,
        } = JSON.parse(event.result)
        if (geetestChallenge && geetestSecCode && geetestValidate) {
          setGeetesValidationData({
            geetestChallenge,
            geetestSecCode,
            geetestValidate,
          })
        }
      },
    )

    onGeeTestFailedListener.current = eventEmitter.addListener(
      "GT3-->onFailed-->",
      (event) => {
        setError(event.error)
      },
    )

    return () => {
      GeetestModule.tearDown()

      if (onGeeTestDialogResultListener.current) {
        onGeeTestDialogResultListener.current.remove()
      }

      if (onGeeTestFailedListener.current) {
        onGeeTestFailedListener.current.remove()
      }
    }
  }, [])

  return {
    geetestError: error,
    geetestValidationData,
    loadingRegisterCaptcha,
    registerCaptcha,
    resetError,
    resetValidationData,
  }
}
