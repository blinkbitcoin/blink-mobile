// ISO-3166 alpha-2 codes where custodial Blink accounts are blocked.
// Sources: OFAC comprehensive sanctions and Google Play policy 16329703
// (https://support.google.com/googleplay/android-developer/answer/16329703).
// TODO: replace with backend-driven list.
export const CUSTODIAL_BLOCKED_COUNTRIES: readonly string[] = [
  // OFAC sanctions
  "CU",
  "IR",
  "KP",

  // Google Play 16329703 (non-EU)
  "AE",
  "BH",
  "CA",
  "CH",
  "GB",
  "ID",
  "IL",
  "JP",
  "KR",
  "PH",
  "US",
  "ZA",

  // Google Play 16329703 — EU-27 (MiCA)
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
] as const
