import parsePhoneNumber, {
  AsYouType,
  CountryCode,
  getCountryCallingCode,
} from "libphonenumber-js/mobile"
import { useEffect, useMemo, useState } from "react"

import { gql } from "@apollo/client"
import {
  PhoneCodeChannelType,
  useSupportedCountriesQuery,
  useUserPhoneRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import useDeviceLocation from "@app/hooks/use-device-location"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

export const RequestPhoneCodeStatus = {
  LoadingCountryCode: "LoadingCountryCode",
  InputtingPhoneNumber: "InputtingPhoneNumber",
  RequestingCode: "RequestingCode",
  SuccessRequestingCode: "SuccessRequestingCode",
  Error: "Error",
} as const

export const ErrorType = {
  InvalidPhoneNumberError: "InvalidPhoneNumberError",
  TooManyAttemptsError: "TooManyAttemptsError",
  RequestCodeError: "RequestCodeError",
  UnsupportedCountryError: "UnsupportedCountryError",
} as const

type ErrorType = (typeof ErrorType)[keyof typeof ErrorType]

export type RequestPhoneCodeStatus =
  (typeof RequestPhoneCodeStatus)[keyof typeof RequestPhoneCodeStatus]

type PhoneInputInfo = {
  countryCode: CountryCode
  countryCallingCode: string
  formattedPhoneNumber: string
  rawPhoneNumber: string
}

export type UseRequestPhoneCodeReturn = {
  userSubmitPhoneNumber: (phoneCodeChannel: PhoneCodeChannelType) => void
  setStatus: (status: RequestPhoneCodeStatus) => void
  status: RequestPhoneCodeStatus
  phoneInputInfo?: PhoneInputInfo
  validatedPhoneNumber?: string
  isWhatsAppSupported: boolean
  isSmsSupported: boolean
  phoneCodeChannel: PhoneCodeChannelType
  error?: ErrorType
  setCountryCode: (countryCode: CountryCode) => void
  setPhoneNumber: (number: string) => void
  supportedCountries: CountryCode[]
}

export const PhoneCodeChannelToFriendlyName = {
  [PhoneCodeChannelType.Sms]: "SMS",
  [PhoneCodeChannelType.Whatsapp]: "WhatsApp",
}

gql`
  mutation userPhoneRegistrationInitiate($input: UserPhoneRegistrationInitiateInput!) {
    userPhoneRegistrationInitiate(input: $input) {
      errors {
        message
      }
      success
    }
  }
`

export const useRequestPhoneCodeRegistration = (): UseRequestPhoneCodeReturn => {
  const [status, setStatus] = useState<RequestPhoneCodeStatus>(
    RequestPhoneCodeStatus.LoadingCountryCode,
  )

  const [countryCode, setCountryCode] = useState<CountryCode | undefined>()
  const [rawPhoneNumber, setRawPhoneNumber] = useState<string>("")
  const [validatedPhoneNumber, setValidatedPhoneNumber] = useState<string | undefined>()
  const [phoneCodeChannel, setPhoneCodeChannel] = useState<PhoneCodeChannelType>(
    PhoneCodeChannelType.Sms,
  )
  const { appConfig } = useAppConfig()
  const skipRequestPhoneCode = appConfig.galoyInstance.name === "Local"

  const [registerPhone] = useUserPhoneRegistrationInitiateMutation()

  const [error, setError] = useState<ErrorType | undefined>()

  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "phoneRegistrationInitiate">
    >()

  const { data } = useSupportedCountriesQuery()
  const { countryCode: detectedCountryCode } = useDeviceLocation()

  const { isWhatsAppSupported, isSmsSupported, allSupportedCountries } = useMemo(() => {
    const currentCountry = data?.globals?.supportedCountries.find(
      (country) => country.id === countryCode,
    )

    const allSupportedCountries = (data?.globals?.supportedCountries.map(
      (country) => country.id,
    ) || []) as CountryCode[]

    const isWhatsAppSupported =
      currentCountry?.supportedAuthChannels.includes(PhoneCodeChannelType.Whatsapp) ||
      false
    const isSmsSupported =
      currentCountry?.supportedAuthChannels.includes(PhoneCodeChannelType.Sms) || false

    return {
      isWhatsAppSupported,
      isSmsSupported,
      allSupportedCountries,
    }
  }, [data?.globals, countryCode])

  // setting default country code from IP
  useEffect(() => {
    if (detectedCountryCode) {
      setCountryCode(detectedCountryCode)
      setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber)
    }
  }, [detectedCountryCode])

  const setPhoneNumber = (number: string) => {
    if (status === RequestPhoneCodeStatus.RequestingCode) {
      return
    }
    // handle paste
    if (number.length - rawPhoneNumber.length > 1) {
      const parsedPhoneNumber = parsePhoneNumber(number, countryCode)

      if (parsedPhoneNumber?.isValid()) {
        parsedPhoneNumber.country && setCountryCode(parsedPhoneNumber.country)
      }
    }

    setRawPhoneNumber(number)
    setError(undefined)
    setStatus(RequestPhoneCodeStatus.InputtingPhoneNumber)
  }

  const userSubmitPhoneNumber = async (phoneCodeChannel: PhoneCodeChannelType) => {
    if (
      status === RequestPhoneCodeStatus.LoadingCountryCode ||
      status === RequestPhoneCodeStatus.RequestingCode
    ) {
      return
    }

    const parsedPhoneNumber = parsePhoneNumber(rawPhoneNumber, countryCode)
    phoneCodeChannel && setPhoneCodeChannel(phoneCodeChannel)
    if (parsedPhoneNumber?.isValid()) {
      if (
        !parsedPhoneNumber.country ||
        (phoneCodeChannel === PhoneCodeChannelType.Sms && !isSmsSupported) ||
        (phoneCodeChannel === PhoneCodeChannelType.Whatsapp && !isWhatsAppSupported)
      ) {
        setStatus(RequestPhoneCodeStatus.Error)
        setError(ErrorType.UnsupportedCountryError)
        return
      }

      setValidatedPhoneNumber(parsedPhoneNumber.number)

      if (skipRequestPhoneCode) {
        navigation.navigate("phoneRegistrationValidate", {
          phone: parsedPhoneNumber.number,
          channel: phoneCodeChannel,
        })
        return
      }

      setStatus(RequestPhoneCodeStatus.RequestingCode)

      try {
        const res = await registerPhone({
          variables: {
            input: { phone: parsedPhoneNumber.number, channel: phoneCodeChannel },
          },
        })

        if (res.data?.userPhoneRegistrationInitiate?.errors?.length) {
          setStatus(RequestPhoneCodeStatus.Error)
          // TODO: show error message
          setError(ErrorType.RequestCodeError)
        } else {
          setStatus(RequestPhoneCodeStatus.SuccessRequestingCode)
          navigation.navigate("phoneRegistrationValidate", {
            phone: parsedPhoneNumber.number,
            channel: phoneCodeChannel,
          })
        }
      } catch (error) {
        console.error(error)
        setStatus(RequestPhoneCodeStatus.Error)
        setError(ErrorType.RequestCodeError)
      }
    } else {
      setStatus(RequestPhoneCodeStatus.Error)
      setError(ErrorType.InvalidPhoneNumberError)
    }
  }

  let phoneInputInfo: PhoneInputInfo | undefined = undefined
  if (countryCode) {
    phoneInputInfo = {
      countryCode,
      formattedPhoneNumber: new AsYouType(countryCode).input(rawPhoneNumber),
      countryCallingCode: getCountryCallingCode(countryCode),
      rawPhoneNumber,
    }
  }

  return {
    status,
    setStatus,
    phoneInputInfo,
    validatedPhoneNumber,
    error,
    userSubmitPhoneNumber,
    phoneCodeChannel,
    isWhatsAppSupported,
    isSmsSupported,
    setCountryCode,
    setPhoneNumber,
    supportedCountries: allSupportedCountries,
  }
}
