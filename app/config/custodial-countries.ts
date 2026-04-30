// Allow-list of ISO-3166 alpha-2 country codes where a custodial Blink account
// can be created.
// TODO: replace this hardcoded list with the country list returned by the backend.
export const CUSTODIAL_ALLOWED_COUNTRIES: readonly string[] = ["SV", "HN"] as const
