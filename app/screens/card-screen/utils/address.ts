import { postcodeValidator, postcodeValidatorExistsForCountry } from "postcode-validator"

import { ShippingAddress as GqlShippingAddress } from "@app/graphql/generated"

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
