export type CountryMetadata = {
  key: string
  name: string
  fmt?: string
  require?: string
  zip?: string
  zipex?: string
  zipNameType?: string
  stateNameType?: string
  upper?: string
  subKeys?: string[]
  subNames?: string[]
}

export type AddressMetadataFile = {
  generated: string
  fallback: CountryMetadata
  countries: Record<string, CountryMetadata>
}
