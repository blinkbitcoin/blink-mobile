/** Shared manual mock: the real module warns at load time when no API key is
 *  configured, so specs replace it wholesale with `jest.mock("@app/utils/ip-country-lookup")`. */
export const DEFAULT_ADAPTERS = []

export const resolveIpCountryCode = jest.fn(async () => undefined)

export const resolveIpCountryCodeCached = jest.fn(async () => undefined)
