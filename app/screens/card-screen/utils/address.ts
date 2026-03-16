import { postcodeValidator, postcodeValidatorExistsForCountry } from "postcode-validator"

import { ShippingAddress as GqlShippingAddress } from "@app/graphql/generated"
import { ShippingAddress } from "@app/screens/card-screen/types"

import { getCountryLabel } from "@app/utils/country-region-data"

// Multilingual PO Box patterns:
// English: P.O. Box, PO Box, POB, Post Office Box
// French: Boîte postale, Case postale, BP
// Spanish: Apartado, Apartado postal, Apdo
// German: Postfach
// Portuguese: Caixa postal, CP
const PO_BOX_REGEX =
  /\bP\.?\s*O\.?\s*B(ox)?\.?\b|Post\s*Office\s*Box|Bo[îi]te\s*postale|Case\s*postale|\bBP\s*\d|Apartado(\s*postal)?|\bApdo\.?\b|Postfach|Caixa\s*postal|\bCP\s*\d/i

const isPOBox = (value: string): boolean => PO_BOX_REGEX.test(value)

const isPostalCodeInvalid = (value: string, countryCode: string): boolean => {
  if (value.length === 0) return false
  if (!postcodeValidatorExistsForCountry(countryCode)) return false
  return !postcodeValidator(value, countryCode)
}

export type ValidationMessages = {
  required: string
  minChars: (params: { min: number }) => string
  noPOBoxes: string
  invalidPostalCode: string
}

export type AddressErrors = Partial<Record<keyof ShippingAddress, string>>

export type AddressValidation = {
  errors: AddressErrors
  isValid: boolean
  isPostalCodeRequired: boolean
}

export const validateAddress = (
  address: ShippingAddress,
  messages: ValidationMessages,
  { checkFullName = true }: { checkFullName?: boolean } = {},
): AddressValidation => {
  const errors: AddressErrors = {}

  if (checkFullName) {
    if (address.firstName.trim().length < 2)
      errors.firstName = messages.minChars({ min: 2 })
    if (address.lastName.trim().length < 2)
      errors.lastName = messages.minChars({ min: 2 })
  }

  const line1Error =
    address.line1.trim().length < 2
      ? messages.minChars({ min: 2 })
      : isPOBox(address.line1)
        ? messages.noPOBoxes
        : undefined
  if (line1Error !== undefined) errors.line1 = line1Error

  if (address.line2 !== "" && isPOBox(address.line2)) {
    errors.line2 = messages.noPOBoxes
  }

  if (address.city.trim().length < 2) errors.city = messages.minChars({ min: 2 })

  const isPostalCodeRequired = postcodeValidatorExistsForCountry(address.countryCode)
  const postalTrimmed = address.postalCode.trim()

  const postalError =
    isPostalCodeRequired && postalTrimmed.length === 0
      ? messages.required
      : isPostalCodeInvalid(address.postalCode, address.countryCode)
        ? messages.invalidPostalCode
        : undefined
  if (postalError !== undefined) errors.postalCode = postalError

  if (address.countryCode.trim().length === 0) errors.countryCode = messages.required

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    isPostalCodeRequired,
  }
}

const EMPTY_MESSAGES: ValidationMessages = {
  required: "",
  minChars: () => "",
  noPOBoxes: "",
  invalidPostalCode: "",
}

export const isAddressValid = (
  address: ShippingAddress,
  { checkFullName = true }: { checkFullName?: boolean } = {},
): boolean => validateAddress(address, EMPTY_MESSAGES, { checkFullName }).isValid

export type AddressFields = Pick<
  GqlShippingAddress,
  | "firstName"
  | "lastName"
  | "line1"
  | "line2"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "countryCode"
>

export const addressToLines = (
  address: AddressFields,
  includeFullName = true,
): string[] =>
  [
    includeFullName
      ? [address.firstName, address.lastName].filter(Boolean).join(" ") || null
      : null,
    address.line1,
    address.line2 || null,
    [address.city, address.region, address.postalCode].filter(Boolean).join(", "),
    address.country ?? getCountryLabel(address.countryCode),
  ].filter((line): line is string => line !== null)
