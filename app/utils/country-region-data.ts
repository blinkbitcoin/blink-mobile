import allCountries from "country-region-data/data.json"

type SelectionOption = { value: string; label: string }

type CountryRegionEntry = {
  countryName: string
  countryShortCode: string
  regions: { name: string; shortCode: string }[]
}

const data = allCountries as CountryRegionEntry[]

const regionMap = new Map<string, SelectionOption[]>()
const labelMap = new Map<string, string>()

for (const c of data) {
  labelMap.set(c.countryShortCode, c.countryName)
  regionMap.set(
    c.countryShortCode,
    c.regions.map((r) => ({ value: r.shortCode, label: r.name })),
  )
}

const countries: SelectionOption[] = data
  .map((c) => ({ value: c.countryShortCode, label: c.countryName }))
  .sort((a, b) => a.label.localeCompare(b.label))

export const getAllCountries = (): SelectionOption[] => [...countries]

export const getRegionsByCountry = (countryCode: string): SelectionOption[] =>
  regionMap.get(countryCode) ?? []

export const getCountryLabel = (countryCode: string): string =>
  labelMap.get(countryCode) ?? countryCode
