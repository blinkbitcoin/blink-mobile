type CustodialEligibilityInputs = {
  country: string | undefined
  accountCount: number
  custodialSignupBlockedCountries: string[]
  custodialFirstSignupBlockedCountries: string[]
}

/** Pure compliance decision combining the always-block list with the first-signup carve-out. */
export const decideCustodialEligibility = ({
  country,
  accountCount,
  custodialSignupBlockedCountries,
  custodialFirstSignupBlockedCountries,
}: CustodialEligibilityInputs): boolean => {
  if (country === undefined) return false

  if (custodialSignupBlockedCountries.includes(country)) return false

  const isFirstSignup = accountCount === 0
  const firstSignupBlocked = custodialFirstSignupBlockedCountries.includes(country)
  if (isFirstSignup && firstSignupBlocked) return false

  return true
}
