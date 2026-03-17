import {
  getCountryMetadata,
  getPostalCodeRegex,
  getPostalNameType,
  getRegionsByCountry,
  getStateNameType,
} from "@app/utils/address-metadata"
import { ShippingAddress } from "@app/screens/card-screen/types"

export type FieldRule = {
  required: boolean
  minLength?: number
  pattern?: RegExp
  noPOBox?: boolean
  enum?: string[]
}

export type AddressSchema = {
  fields: Record<keyof ShippingAddress, FieldRule>
  stateNameType: string
  postalNameType: string
  hasRegions: boolean
}

export const buildAddressSchema = (countryCode: string): AddressSchema => {
  const meta = getCountryMetadata(countryCode)
  const required = meta.require ?? ""
  const regions = getRegionsByCountry(countryCode)
  const postalRegex = getPostalCodeRegex(countryCode)

  return {
    fields: {
      firstName: { required: true, minLength: 2 },
      lastName: { required: true, minLength: 2 },
      line1: { required: required.includes("A"), minLength: 1, noPOBox: true },
      line2: { required: false, noPOBox: true },
      city: { required: required.includes("C"), minLength: 1 },
      region: {
        required: required.includes("S"),
        ...(regions.length > 0 ? { enum: regions.map((r) => r.value) } : {}),
      },
      postalCode: {
        required: required.includes("Z"),
        ...(postalRegex ? { pattern: postalRegex } : {}),
      },
      countryCode: { required: true },
    },
    stateNameType: getStateNameType(countryCode),
    postalNameType: getPostalNameType(countryCode),
    hasRegions: regions.length > 0,
  }
}
