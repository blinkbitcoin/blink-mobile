type CustodialEligibilityInputs = {
  /** Undefined when the location never resolved, which is itself a refusal. */
  country: string | undefined
  accountCount: number
  custodialFirstSignupBlockedCountries: string[]
}

/**
 * Pure compliance decision. Fails closed on an unresolved country, since an untrusted
 * location must not open signup, and otherwise refuses only a user's very first Blink
 * account: someone who already holds one may open another from the same country.
 */
export const decideCustodialEligibility = ({
  country,
  accountCount,
  custodialFirstSignupBlockedCountries,
}: CustodialEligibilityInputs): boolean => {
  if (country === undefined) return false

  const isFirstSignup = accountCount === 0
  const isFirstSignupBlocked = custodialFirstSignupBlockedCountries.includes(country)

  return !(isFirstSignup && isFirstSignupBlocked)
}
