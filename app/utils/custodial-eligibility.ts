type CustodialEligibilityInputs = {
  country: string | undefined
  detectionFailed: boolean
  accountCount: number
  custodialFirstSignupBlockedCountries: string[]
}

/** Pure compliance decision. Fails closed when the country is unresolved or came from a detection-failure fallback, since an untrusted location must not open signup. */
export const decideCustodialEligibility = ({
  country,
  detectionFailed,
  accountCount,
  custodialFirstSignupBlockedCountries,
}: CustodialEligibilityInputs): boolean => {
  if (country === undefined || detectionFailed) return false

  const isFirstSignup = accountCount === 0
  const firstSignupBlocked = custodialFirstSignupBlockedCountries.includes(country)
  if (isFirstSignup && firstSignupBlocked) return false

  return true
}
