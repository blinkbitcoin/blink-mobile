import { CUSTODIAL_ALLOWED_COUNTRIES } from "./custodial-countries"

export const isCustodialAllowedForCountry = (
  countryCode: string | undefined,
): boolean => {
  if (!countryCode) return false
  return CUSTODIAL_ALLOWED_COUNTRIES.includes(countryCode.toUpperCase())
}
