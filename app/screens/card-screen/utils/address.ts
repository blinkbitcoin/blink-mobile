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

export const validatePOBox = ({
  value,
  errorMessage,
}: {
  value: string
  errorMessage: string
}): string | undefined => {
  if (PO_BOX_REGEX.test(value)) return errorMessage
  return undefined
}

export const validatePostalCode = ({
  value,
  countryCode,
  errorMessage,
}: {
  value: string
  countryCode: string
  errorMessage: string
}): string | undefined => {
  if (value.length === 0) return undefined
  if (!postcodeValidatorExistsForCountry(countryCode)) return undefined
  if (!postcodeValidator(value, countryCode)) return errorMessage
  return undefined
}

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

export const isAddressValid = (
  address: ShippingAddress,
  { checkFullName = true }: { checkFullName?: boolean } = {},
): boolean => {
  const hasPOBox =
    validatePOBox({ value: address.line1, errorMessage: "" }) !== undefined ||
    (address.line2 !== "" &&
      validatePOBox({ value: address.line2, errorMessage: "" }) !== undefined)

  const hasValidPostalCode =
    validatePostalCode({
      value: address.postalCode,
      countryCode: address.countryCode,
      errorMessage: "",
    }) === undefined

  const isPostalCodeRequired = postcodeValidatorExistsForCountry(address.countryCode)
  const isPostalCodeValid = isPostalCodeRequired
    ? address.postalCode.trim().length > 0 && hasValidPostalCode
    : address.postalCode.trim().length === 0 || hasValidPostalCode

  const hasRequiredFields =
    address.line1.trim().length >= 2 &&
    !hasPOBox &&
    address.city.trim().length >= 2 &&
    isPostalCodeValid &&
    address.countryCode.trim().length > 0

  if (!checkFullName) return hasRequiredFields

  return (
    hasRequiredFields &&
    address.firstName.trim().length >= 2 &&
    address.lastName.trim().length >= 2
  )
}

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
