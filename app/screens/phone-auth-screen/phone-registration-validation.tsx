import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import {
  PhoneCodeChannelType,
  useUserPhoneRegistrationValidateMutation,
} from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { logAddPhoneAttempt, logValidateAuthCodeFailure } from "@app/utils/analytics"
import crashlytics from "@react-native-firebase/crashlytics"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Input, Text, makeStyles, useTheme } from "@rneui/themed"

import { Screen } from "../../components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { parseTimer } from "../../utils/timer"
import { PhoneCodeChannelToFriendlyName } from "./request-phone-code-login"

gql`
  mutation userPhoneRegistrationValidate($input: UserPhoneRegistrationValidateInput!) {
    userPhoneRegistrationValidate(input: $input) {
      errors {
        message
        code
      }
      me {
        id
        phone
        email {
          address
          verified
        }
      }
    }
  }
`

type PhoneRegistrationValidateScreenProps = {
  route: RouteProp<RootStackParamList, "phoneRegistrationValidate">
}

const ValidatePhoneCodeStatus = {
  WaitingForCode: "WaitingForCode",
  LoadingAuthResult: "LoadingAuthResult",
  ReadyToRegenerate: "ReadyToRegenerate",
  Success: "Success",
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
      return LL.errors.generic() + (error.msg ? `: ${error.msg}` : "")
  }
}

export type ValidatePhoneCodeErrorsType =
  (typeof ValidatePhoneCodeErrors)[keyof typeof ValidatePhoneCodeErrors]

export const PhoneRegistrationValidateScreen: React.FC<
  PhoneRegistrationValidateScreenProps
> = ({ route }) => {
  const styles = useStyles()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "phoneRegistrationValidate">>()

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

  const { LL } = useI18nContext()

  const [phoneValidate] = useUserPhoneRegistrationValidateMutation()

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
        setStatus(ValidatePhoneCodeStatus.LoadingAuthResult)
        logAddPhoneAttempt()
        const { data } = await phoneValidate({
          variables: { input: { phone, code } },
        })

        const errors = data?.userPhoneRegistrationValidate?.errors || []

        const error = mapGqlErrorsToValidatePhoneCodeErrors(errors)

        if (error) {
          console.error(error, "error validating phone code")
          logValidateAuthCodeFailure({
            error: error.type,
          })

          setError(error)
          _setCode("")
          setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate)
        } else {
          setStatus(ValidatePhoneCodeStatus.Success)
          Alert.alert(LL.PhoneRegistrationValidateScreen.successTitle(), undefined, [
            {
              text: LL.common.ok(),
              onPress: () => navigation.pop(2),
            },
          ])
        }
      } catch (err) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          console.debug({ err })
        }
        setError({ type: ValidatePhoneCodeErrors.UnknownError })
        _setCode("")
        setStatus(ValidatePhoneCodeStatus.ReadyToRegenerate)
      }
    },
    [status, phoneValidate, phone, _setCode, navigation, LL],
  )

  const setCode = (code: string) => {
    if (code.length > 6) {
      return
    }

    setError(undefined)
    _setCode(code)
    if (code.length === 6) {
      send(code)
    }
  }

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
