import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import {
  PhoneCodeChannelType,
  useUserLoginMutation,
  useUserLoginUpgradeMutation,
} from "@app/graphql/generated"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import {
  logUpgradeLoginAttempt,
  logUpgradeLoginSuccess,
  logValidateAuthCodeFailure,
} from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"
import analytics from "@react-native-firebase/analytics"
import crashlytics from "@react-native-firebase/crashlytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme, Input } from "@rneui/themed"

import { Screen } from "../../components/screen"
import { useAppConfig } from "../../hooks"
import type { PhoneValidationStackParamList } from "../../navigation/stack-param-lists"
import { parseTimer } from "../../utils/timer"
import { PhoneCodeChannelToFriendlyName } from "./request-phone-code-login"

gql`
  mutation userLogin($input: UserLoginInput!) {
    userLogin(input: $input) {
      errors {
        message
        code
      }
      authToken
      totpRequired
    }
  }

  mutation userLoginUpgrade($input: UserLoginUpgradeInput!) {
    userLoginUpgrade(input: $input) {
      errors {
        message
        code
      }
      success
      authToken
    }
  }
`

type PhoneLoginValidationScreenProps = {
  route: RouteProp<PhoneValidationStackParamList, "phoneLoginValidate">
}

const ValidatePhoneCodeStatus = {
  WaitingForCode: "WaitingForCode",
  LoadingAuthResult: "LoadingAuthResult",
  ReadyToRegenerate: "ReadyToRegenerate",
}

type ValidatePhoneCodeStatusType =
  (typeof ValidatePhoneCodeStatus)[keyof typeof ValidatePhoneCodeStatus]

const ValidatePhoneCodeErrors = {
  InvalidCode: "InvalidCode",
  TooManyAttempts: "TooManyAttempts",
  CannotUpgradeToExistingAccount: "CannotUpgradeToExistingAccount",
  IpNotAllowed: "IpNotAllowed",
  PhoneNotAllowed: "PhoneNotAllowed",
  UnknownError: "UnknownError",
} as const

const mapGqlErrorsToValidatePhoneCodeErrors = (
  errors: readonly {
    code?: string | null | undefined
    message: string
  }[],
):
  | {
      type: ValidatePhoneCodeErrorsType
      msg?: string
    }
  | undefined => {
  if (errors.some((error) => error.code === "PHONE_CODE_ERROR")) {
    return {
      type: ValidatePhoneCodeErrors.InvalidCode,
    }
  }

  if (errors.some((error) => error.code === "TOO_MANY_REQUEST")) {
    return {
      type: ValidatePhoneCodeErrors.TooManyAttempts,
    }
  }

  if (errors.some((error) => error.code === "PHONE_NOT_ALLOWED_TO_ONBOARD_ERROR")) {
    return {
      type: ValidatePhoneCodeErrors.PhoneNotAllowed,
    }
  }

  if (errors.some((error) => error.code === "IP_NOT_ALLOWED_TO_ONBOARD_ERROR")) {
    return {
      type: ValidatePhoneCodeErrors.IpNotAllowed,
    }
  }

  if (
    errors.some(
      (error) =>
        error.code === "PHONE_ACCOUNT_ALREADY_EXISTS_ERROR" ||
        error.code === "PHONE_ACCOUNT_ALREADY_EXISTS_NEED_TO_SWEEP_FUNDS_ERROR",
    )
  ) {
    return {
      type: ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount,
    }
  }

  if (errors.length > 0) {
    return {
      type: ValidatePhoneCodeErrors.UnknownError,
      msg: errors[0].message,
    }
  }

  return undefined
}

const mapValidatePhoneCodeErrorsToMessage = (
  error: {
    type: ValidatePhoneCodeErrorsType
    msg?: string
  },
  LL: TranslationFunctions,
): string => {
  switch (error.type) {
    case ValidatePhoneCodeErrors.InvalidCode:
      return LL.PhoneLoginValidationScreen.errorLoggingIn()
    case ValidatePhoneCodeErrors.TooManyAttempts:
      return LL.PhoneLoginValidationScreen.errorTooManyAttempts()
    case ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount:
      return LL.PhoneLoginValidationScreen.errorCannotUpgradeToExistingAccount()
    case ValidatePhoneCodeErrors.IpNotAllowed:
      return LL.PhoneLoginValidationScreen.errorIpNotAllowed()
    case ValidatePhoneCodeErrors.PhoneNotAllowed:
      return LL.PhoneLoginValidationScreen.errorPhoneNotAllowed()
    case ValidatePhoneCodeErrors.UnknownError:
    default:
      return LL.errors.generic() + (error.msg ? ` Error Message: ${error.msg}` : "")
  }
}

export type ValidatePhoneCodeErrorsType =
  (typeof ValidatePhoneCodeErrors)[keyof typeof ValidatePhoneCodeErrors]

export const PhoneLoginValidationScreen: React.FC<PhoneLoginValidationScreenProps> = ({
  route,
}) => {
  const styles = useStyles()
  const navigation =
    useNavigation<
      StackNavigationProp<PhoneValidationStackParamList, "phoneLoginValidate">
    >()

  const [status, setStatus] = useState<ValidatePhoneCodeStatusType>(
    ValidatePhoneCodeStatus.WaitingForCode,
  )
  const [error, setError] = useState<
    | {
        type: ValidatePhoneCodeErrorsType
        msg?: string
      }
    | undefined
  >()

  const { saveToken, appConfig } = useAppConfig()

  const { LL } = useI18nContext()

  const [userLoginMutation] = useUserLoginMutation({
    fetchPolicy: "no-cache",
  })

  const [userLoginUpgradeMutation] = useUserLoginUpgradeMutation({
    fetchPolicy: "no-cache",
  })

  const { currentLevel } = useLevel()

  const isUpgradeFlow = currentLevel === AccountLevel.Zero

  const [code, _setCode] = useState("")
  // Wait 2.5 minutes before allowing another code request
  const [secondsRemaining, setSecondsRemaining] = useState<number>(150)
  const { phone, channel } = route.params
  const {
    theme: { colors },
  } = useTheme()

  const send = useCallback(
    async (code: string) => {
      if (status === ValidatePhoneCodeStatus.LoadingAuthResult) {
        return
      }

      try {
        let errors:
          | readonly { code?: string | null | undefined; message: string }[]
          | undefined

        setStatus(ValidatePhoneCodeStatus.LoadingAuthResult)
        if (isUpgradeFlow) {
          logUpgradeLoginAttempt()
          const { data } = await userLoginUpgradeMutation({
            variables: { input: { phone, code } },
          })

          const success = data?.userLoginUpgrade?.success
          const authToken = data?.userLoginUpgrade?.authToken
          if (success) {
            logUpgradeLoginSuccess()

            if (authToken) {
              saveToken(authToken)
            }

            navigation.replace("Primary")
            return
          }

          errors = data?.userLoginUpgrade?.errors
        } else {
          const { data } = await userLoginMutation({
            variables: { input: { phone, code } },
          })

          const authToken = data?.userLogin?.authToken
          const totpRequired = data?.userLogin?.totpRequired

          if (authToken) {
            if (totpRequired) {
              navigation.navigate("totpLoginValidate", {
                authToken,
              })
              return
            }
            analytics().logLogin({ method: "phone" })
            saveToken(authToken)
            navigation.replace("Primary")
            return
          }

          errors = data?.userLogin?.errors
        }

        const error = mapGqlErrorsToValidatePhoneCodeErrors(errors || []) || {
          type: ValidatePhoneCodeErrors.UnknownError,
        }

        logValidateAuthCodeFailure({
          error: error.type,
        })

        setError(error)
        _setCode("")
        setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate)
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          console.debug({ err })
        }
        setError({
          type: ValidatePhoneCodeErrors.UnknownError,
        })
        _setCode("")
        setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate)
      }
    },
    [
      status,
      userLoginMutation,
      userLoginUpgradeMutation,
      phone,
      saveToken,
      _setCode,
      navigation,
      isUpgradeFlow,
    ],
  )

  const setCode = useCallback(
    (code: string) => {
      if (code.length > 6) {
        return
      }

      setError(undefined)
      _setCode(code)
      if (code.length === 6) {
        send(code)
      }
    },
    [send],
  )

  useEffect(() => {
    const timerId = setTimeout(() => {
      if (secondsRemaining > 0) {
        setSecondsRemaining(secondsRemaining - 1)
      } else if (status === ValidatePhoneCodeStatus.WaitingForCode) {
        setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate)
      }
    }, 1000)
    return () => clearTimeout(timerId)
  }, [secondsRemaining, status])

  useEffect(() => {
    if (!appConfig) {
      return
    }

    appConfig.galoyInstance.id === "Local" && setCode("000000")
  }, [appConfig, setCode])

  const errorMessage = error && mapValidatePhoneCodeErrorsToMessage(error, LL)
  let extraInfoContent = undefined
  switch (status) {
    case ValidatePhoneCodeStatus.ReadyToRegenerate:
      extraInfoContent = (
        <>
          {errorMessage && (
            <View style={styles.marginBottom}>
              <GaloyErrorBox errorMessage={errorMessage} />
            </View>
          )}
          {error?.type ===
          ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount ? null : (
            <View style={styles.marginBottom}>
              <GaloyInfo>
                {LL.PhoneLoginValidationScreen.sendViaOtherChannel({
                  channel: PhoneCodeChannelToFriendlyName[channel],
                  other:
                    PhoneCodeChannelToFriendlyName[
                      channel === PhoneCodeChannelType.Sms
                        ? PhoneCodeChannelType.Whatsapp
                        : PhoneCodeChannelType.Sms
                    ],
                })}
              </GaloyInfo>
            </View>
          )}
          <GaloySecondaryButton
            title={LL.PhoneLoginValidationScreen.sendAgain()}
            onPress={() => navigation.goBack()}
          />
        </>
      )
      break
    case ValidatePhoneCodeStatus.LoadingAuthResult:
      extraInfoContent = (
        <ActivityIndicator
          style={styles.activityIndicator}
          size="large"
          color={colors.primary}
        />
      )
      break
    case ValidatePhoneCodeStatus.WaitingForCode:
      extraInfoContent = (
        <View style={styles.timerRow}>
          <Text type="p3" color={colors.grey3}>
            {LL.PhoneLoginValidationScreen.sendAgain()} {parseTimer(secondsRemaining)}
          </Text>
        </View>
      )
      break
  }

  return (
    <Screen
      preset="scroll"
      style={styles.screenStyle}
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type="h2">
            {LL.PhoneLoginValidationScreen.header({
              channel: PhoneCodeChannelToFriendlyName[channel],
              phoneNumber: phone,
            })}
          </Text>
        </View>

        <Input
          placeholder="000000"
          containerStyle={styles.inputComponentContainerStyle}
          inputContainerStyle={styles.inputContainerStyle}
          inputStyle={styles.inputStyle}
          value={code}
          onChangeText={setCode}
          renderErrorMessage={false}
          autoFocus={true}
          textContentType={"oneTimeCode"}
          keyboardType="numeric"
          {...testProps("oneTimeCode")}
        />

        <View style={styles.extraInfoContainer}>{extraInfoContent}</View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    padding: 20,
    flexGrow: 1,
  },
  flex: { flex: 1 },
  flexAndMinHeight: { flex: 1, minHeight: 16 },
  viewWrapper: { flex: 1 },

  activityIndicator: { marginTop: 12 },
  extraInfoContainer: {
    marginBottom: 20,
    flex: 1,
  },
  sendAgainButtonRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 25,
    textAlign: "center",
  },
  textContainer: {
    marginBottom: 20,
  },
  timerRow: {
    flexDirection: "row",
    justifyContent: "center",
    textAlign: "center",
  },
  marginBottom: {
    marginBottom: 10,
  },
  inputComponentContainerStyle: {
    flexDirection: "row",
    marginBottom: 20,
    paddingLeft: 0,
    paddingRight: 0,
    justifyContent: "center",
  },
  inputContainerStyle: {
    minWidth: 160,
    minHeight: 60,
    borderWidth: 2,
    borderBottomWidth: 2,
    paddingHorizontal: 10,
    borderColor: colors.primary5,
    borderRadius: 8,
    marginRight: 0,
  },
  inputStyle: {
    fontSize: 24,
    textAlign: "center",
  },
}))
