/** Shared manual mock: the real module warns at load time when no API key is
 *  configured, so specs replace it wholesale with `jest.mock("@app/utils/ip-country-lookup")`. */
export const DEFAULT_ADAPTERS = []

export const resolveIpCountryCode = jest.fn(async () => undefined)

export const resolveIpCountryCodeCached = jest.fn(async () => undefined)

/** The lookup hooks subscribe to the session-start reset through these, so both must be
 *  callable: `useSyncExternalStore` invokes the snapshot during render. A spec that
 *  exercises a reset drives it through its own mock rather than this one. */
export const subscribeToIpCountryLookup = jest.fn(() => () => undefined)

export const getIpCountryLookupGeneration = jest.fn(() => 0)

export const resetIpCountryLookup = jest.fn()
