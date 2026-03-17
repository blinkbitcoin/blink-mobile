export const mockAddressMetadata = {
  getAllCountries: () => [
    { value: "US", label: "United States" },
    { value: "CA", label: "Canada" },
    { value: "SV", label: "El Salvador" },
    { value: "JP", label: "Japan" },
    { value: "GB", label: "United Kingdom" },
  ],
  getRegionsByCountry: (code: string) => {
    const regions: Record<string, { value: string; label: string }[]> = {
      US: [
        { value: "NY", label: "New York" },
        { value: "CA", label: "California" },
      ],
      CA: [
        { value: "ON", label: "Ontario" },
        { value: "BC", label: "British Columbia" },
      ],
    }
    return regions[code] ?? []
  },
  getCountryLabel: (code: string) => {
    const labels: Record<string, string> = {
      US: "United States",
      CA: "Canada",
      SV: "El Salvador",
      JP: "Japan",
      GB: "United Kingdom",
    }
    return labels[code] ?? code
  },
  getCountryMetadata: (code: string) => {
    const meta: Record<string, Record<string, string>> = {
      US: {
        key: "US",
        require: "ACSZ",
        zip: "(\\d{5})(?:[ \\-](\\d{4}))?",
        stateNameType: "state",
        zipNameType: "zip",
      },
      CA: {
        key: "CA",
        require: "ACSZ",
        zip: "[A-Z]\\d[A-Z] ?\\d[A-Z]\\d",
        stateNameType: "province",
        zipNameType: "postal",
      },
      SV: { key: "SV", require: "ACS", stateNameType: "department" },
      JP: {
        key: "JP",
        require: "ASZ",
        zip: "\\d{3}-?\\d{4}",
        stateNameType: "prefecture",
      },
      GB: {
        key: "GB",
        require: "ACZ",
        zip: "GIR ?0AA|(?:(?:[A-Z]\\d|[A-Z]{2}\\d)[A-Z]?) ?\\d[A-Z]{2}",
      },
    }
    return (
      meta[code] ?? {
        key: "ZZ",
        require: "AC",
        stateNameType: "province",
        zipNameType: "postal",
      }
    )
  },
  getPostalCodeRegex: (code: string) => {
    const patterns: Record<string, string> = {
      US: "^(\\d{5})(?:[ \\-](\\d{4}))?$",
      CA: "^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$",
      JP: "^\\d{3}-?\\d{4}$",
    }
    const p = patterns[code]
    return p ? new RegExp(p) : null
  },
  getStateNameType: (code: string) => {
    const types: Record<string, string> = {
      US: "state",
      CA: "province",
      JP: "prefecture",
      SV: "department",
    }
    return types[code] ?? "state"
  },
  getPostalNameType: (code: string) => {
    const types: Record<string, string> = { US: "zip", CA: "postal", JP: "postal" }
    return types[code] ?? "postal"
  },
}
