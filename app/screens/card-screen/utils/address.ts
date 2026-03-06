import { postcodeValidator } from "postcode-validator"

import { ShippingAddress as GqlShippingAddress } from "@app/graphql/generated"

import { getIsoAlpha2 } from "../country-region-data"

// TODO: replace with a more robust solution (e.g. pobox-regex library) that also
// covers other languages if needed when adding support for more countries
const PO_BOX_REGEX = /\bP\.?\s*O\.?\s*B(ox)?\.?\b|Post\s*Office\s*Box/i

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
  const isoAlpha2 = getIsoAlpha2(countryCode)
  if (!isoAlpha2 || value.length === 0) return undefined
  if (!postcodeValidator(value, isoAlpha2)) return errorMessage
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
    `${address.city}, ${address.region} ${address.postalCode}`,
    address.country ?? address.countryCode,
  ].filter((line): line is string => line !== null)
