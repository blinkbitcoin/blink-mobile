import { getPostalNameType, getStateNameType } from "@app/utils/address-metadata"

// Keys match Google metadata's `stateNameType` values (snake_case from API)
const STATE_LABEL_MAP: Record<string, string> = {
  state: "state",
  province: "province",
  prefecture: "prefecture",
  oblast: "oblast",
  department: "department",
  county: "county",
  district: "district",
  do_si: "doSi", // eslint-disable-line camelcase -- Google metadata uses snake_case for this value
  island: "island",
  emirate: "emirate",
  parish: "parish",
}

const POSTAL_LABEL_MAP: Record<string, string> = {
  zip: "zip",
  postal: "postalCode",
  eircode: "eircode",
  pin: "pin",
}

export const getStateLabelKey = (countryCode: string): string =>
  STATE_LABEL_MAP[getStateNameType(countryCode)] ?? "state"

export const getPostalLabelKey = (countryCode: string): string =>
  POSTAL_LABEL_MAP[getPostalNameType(countryCode)] ?? "postalCode"
