import type { AddressMetadataFile, CountryMetadata } from "./types"
import data from "./data.json"

type SelectionOption = { value: string; label: string }

const metadata = data as AddressMetadataFile

function titleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, (match) => match.toUpperCase())
}

let countryListCache: SelectionOption[] | null = null
const getCountryList = (): SelectionOption[] => {
  if (countryListCache) return countryListCache
  countryListCache = Object.values(metadata.countries)
    .map((c) => ({ value: c.key, label: titleCase(c.name) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return countryListCache
}

export const getCountryMetadata = (countryCode: string): CountryMetadata =>
  metadata.countries[countryCode] ?? metadata.fallback

export const getAllCountries = (): SelectionOption[] => getCountryList()

export const getRegionsByCountry = (countryCode: string): SelectionOption[] => {
  const meta = metadata.countries[countryCode]
  if (!meta?.subKeys?.length) return []
  return meta.subKeys.map((key, i) => ({
    value: key,
    label: meta.subNames?.[i] ?? key,
  }))
}

export const getCountryLabel = (countryCode: string): string => {
  const meta = metadata.countries[countryCode]
  if (!meta) return countryCode
  return titleCase(meta.name)
}

const postalRegexCache = new Map<string, RegExp | null>()
export const getPostalCodeRegex = (countryCode: string): RegExp | null => {
  const cached = postalRegexCache.get(countryCode)
  if (cached !== undefined) return cached
  const zip = getCountryMetadata(countryCode).zip
  const regex = zip ? new RegExp(`^${zip}$`) : null
  postalRegexCache.set(countryCode, regex)
  return regex
}

export const getStateNameType = (countryCode: string): string =>
  getCountryMetadata(countryCode).stateNameType ?? "state"

export const getPostalNameType = (countryCode: string): string =>
  getCountryMetadata(countryCode).zipNameType ?? "postal"
