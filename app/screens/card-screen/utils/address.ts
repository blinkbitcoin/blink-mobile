import { ShippingAddress as GqlShippingAddress } from "@app/graphql/generated"
import { getCountryLabel } from "@app/utils/address-metadata"
import { ShippingAddress } from "@app/screens/card-screen/types"

import { buildAddressSchema, FieldRule } from "./address-schema"

// Multilingual PO Box patterns:
// English: P.O. Box, PO Box, POB, Post Office Box
// French: Boîte postale, Case postale, BP
// Spanish: Apartado, Apartado postal, Apdo
// German: Postfach
// Portuguese: Caixa postal, CP
const PO_BOX_REGEX =
  /\bP\.?\s*O\.?\s*B(ox)?\.?\b|Post\s*Office\s*Box|Bo[îi]te\s*postale|Case\s*postale|\bBP\s*\d|Apartado(\s*postal)?|\bApdo\.?\b|Postfach|Caixa\s*postal|\bCP\s*\d/i

const isPOBox = (value: string): boolean => PO_BOX_REGEX.test(value)

type FieldCheck = {
  trimmed: string
  raw: string
  rule: FieldRule
}

const validateField = (
  { trimmed, raw, rule }: FieldCheck,
  messages: ValidationMessages,
): string | undefined => {
  if (rule.required && trimmed.length === 0) return messages.required
  if (trimmed.length === 0) return undefined

  if (rule.minLength && trimmed.length < rule.minLength)
    return messages.minChars({ min: rule.minLength })

  if (rule.noPOBox && isPOBox(raw)) return messages.noPOBoxes

  if (rule.pattern && !rule.pattern.test(trimmed)) return messages.invalidPostalCode

  if (rule.enum && !rule.enum.includes(trimmed)) return messages.invalidRegion

  return undefined
}

export type ValidationMessages = {
  required: string
  minChars: (params: { min: number }) => string
  noPOBoxes: string
  invalidPostalCode: string
  invalidRegion: string
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
  const schema = buildAddressSchema(address.countryCode)
  const errors: AddressErrors = {}

  const fieldsToCheck: (keyof ShippingAddress)[] = checkFullName
    ? [
        "firstName",
        "lastName",
        "line1",
        "line2",
        "city",
        "region",
        "postalCode",
        "countryCode",
      ]
    : ["line1", "line2", "city", "region", "postalCode", "countryCode"]

  for (const field of fieldsToCheck) {
    const rule = schema.fields[field]
    const raw = address[field]
    const trimmed = raw.trim()
    const error = validateField({ trimmed, raw, rule }, messages)
    if (error !== undefined) errors[field] = error
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    isPostalCodeRequired: schema.fields.postalCode.required,
  }
}

const EMPTY_MESSAGES: ValidationMessages = {
  required: "",
  minChars: () => "",
  noPOBoxes: "",
  invalidPostalCode: "",
  invalidRegion: "",
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
