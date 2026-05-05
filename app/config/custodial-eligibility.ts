import { CUSTODIAL_BLOCKED_COUNTRIES } from "./custodial-countries"

export const isCustodialAllowedForCountry = (
  countryCode: string | undefined,
): boolean => {
  if (!countryCode) return false
  return !CUSTODIAL_BLOCKED_COUNTRIES.includes(countryCode.toUpperCase())
}
