type CustodialEligibilityInputs = {
  country: string | undefined
  detectionFailed: boolean
  accountCount: number
  custodialSignupBlockedCountries: string[]
  custodialFirstSignupBlockedCountries: string[]
}

/** Pure compliance decision. Fails closed when the country is unresolved or came from a detection-failure fallback, since an untrusted location must not open signup. */
export const decideCustodialEligibility = ({
  country,
  detectionFailed,
  accountCount,
  custodialSignupBlockedCountries,
  custodialFirstSignupBlockedCountries,
}: CustodialEligibilityInputs): boolean => {
  if (country === undefined || detectionFailed) return false

  if (custodialSignupBlockedCountries.includes(country)) return false

  const isFirstSignup = accountCount === 0
  const firstSignupBlocked = custodialFirstSignupBlockedCountries.includes(country)
  if (isFirstSignup && firstSignupBlocked) return false

  return true
}
