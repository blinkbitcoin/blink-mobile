import { SelectionOption } from "./card-mock-data"

type CountryWithRegions = SelectionOption & {
  isoAlpha2: string
  regions: SelectionOption[]
}

export const SUPPORTED_COUNTRIES: CountryWithRegions[] = [
  {
    value: "USA",
    label: "United States",
    isoAlpha2: "US",
    regions: [
      { value: "AL", label: "Alabama" },
      { value: "AK", label: "Alaska" },
      { value: "AZ", label: "Arizona" },
      { value: "AR", label: "Arkansas" },
      { value: "CA", label: "California" },
      { value: "CO", label: "Colorado" },
      { value: "CT", label: "Connecticut" },
      { value: "DE", label: "Delaware" },
      { value: "FL", label: "Florida" },
      { value: "GA", label: "Georgia" },
      { value: "HI", label: "Hawaii" },
      { value: "ID", label: "Idaho" },
      { value: "IL", label: "Illinois" },
      { value: "IN", label: "Indiana" },
      { value: "IA", label: "Iowa" },
      { value: "KS", label: "Kansas" },
      { value: "KY", label: "Kentucky" },
      { value: "LA", label: "Louisiana" },
      { value: "ME", label: "Maine" },
      { value: "MD", label: "Maryland" },
      { value: "MA", label: "Massachusetts" },
      { value: "MI", label: "Michigan" },
      { value: "MN", label: "Minnesota" },
      { value: "MS", label: "Mississippi" },
      { value: "MO", label: "Missouri" },
      { value: "MT", label: "Montana" },
      { value: "NE", label: "Nebraska" },
      { value: "NV", label: "Nevada" },
      { value: "NH", label: "New Hampshire" },
      { value: "NJ", label: "New Jersey" },
      { value: "NM", label: "New Mexico" },
      { value: "NY", label: "New York" },
      { value: "NC", label: "North Carolina" },
      { value: "ND", label: "North Dakota" },
      { value: "OH", label: "Ohio" },
      { value: "OK", label: "Oklahoma" },
      { value: "OR", label: "Oregon" },
      { value: "PA", label: "Pennsylvania" },
      { value: "RI", label: "Rhode Island" },
      { value: "SC", label: "South Carolina" },
      { value: "SD", label: "South Dakota" },
      { value: "TN", label: "Tennessee" },
      { value: "TX", label: "Texas" },
      { value: "UT", label: "Utah" },
      { value: "VT", label: "Vermont" },
      { value: "VA", label: "Virginia" },
      { value: "WA", label: "Washington" },
      { value: "WV", label: "West Virginia" },
      { value: "WI", label: "Wisconsin" },
      { value: "WY", label: "Wyoming" },
      { value: "DC", label: "District of Columbia" },
      { value: "PR", label: "Puerto Rico" },
      { value: "GU", label: "Guam" },
      { value: "VI", label: "U.S. Virgin Islands" },
      { value: "AS", label: "American Samoa" },
      { value: "MP", label: "Northern Mariana Islands" },
    ],
  },
  {
    value: "CAN",
    label: "Canada",
    isoAlpha2: "CA",
    regions: [
      { value: "AB", label: "Alberta" },
      { value: "BC", label: "British Columbia" },
      { value: "MB", label: "Manitoba" },
      { value: "NB", label: "New Brunswick" },
      { value: "NL", label: "Newfoundland and Labrador" },
      { value: "NS", label: "Nova Scotia" },
      { value: "NT", label: "Northwest Territories" },
      { value: "NU", label: "Nunavut" },
      { value: "ON", label: "Ontario" },
      { value: "PE", label: "Prince Edward Island" },
      { value: "QC", label: "Québec" },
      { value: "SK", label: "Saskatchewan" },
      { value: "YT", label: "Yukon" },
    ],
  },
]

export const COUNTRIES: SelectionOption[] = SUPPORTED_COUNTRIES.map(
  ({ value, label }) => ({
    value,
    label,
  }),
)

export const getRegionsByCountry = (countryCode: string): SelectionOption[] =>
  SUPPORTED_COUNTRIES.find((c) => c.value === countryCode)?.regions ?? []

export const getIsoAlpha2 = (countryCode: string): string | undefined =>
  SUPPORTED_COUNTRIES.find((c) => c.value === countryCode)?.isoAlpha2
