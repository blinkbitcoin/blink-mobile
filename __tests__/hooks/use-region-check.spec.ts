import { renderHook } from "@testing-library/react-native"

import { useRegionCheck, useRegionCheckLazy } from "@app/hooks/use-region-check"

const mockUseRemoteConfig = jest.fn()
const mockUseFeatureFlags = jest.fn()
const mockUseIpCountryLookup = jest.fn()
const mockResolveIpCountryCodeCached = jest.fn()
const mockUpdateCountryCode = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({}),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateCountryCode: (...args: unknown[]) => mockUpdateCountryCode(...args),
}))

/** Reached through use-device-location, and it warns about API keys on import. */
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: () => mockResolveIpCountryCodeCached(),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  useIpCountryLookup: (enabled: boolean) => mockUseIpCountryLookup(enabled),
}))

const setUp = ({
  enabled = true,
  countryCode,
  isLookupSettled = true,
  remoteConfigReady = true,
  custodialCreationBlockedCountries = ["CU", "IR"],
}: {
  enabled?: boolean
  countryCode?: string
  isLookupSettled?: boolean
  remoteConfigReady?: boolean
  custodialCreationBlockedCountries?: string[]
}) => {
  mockUseIpCountryLookup.mockReturnValue({ countryCode, isSettled: isLookupSettled })
  mockUseFeatureFlags.mockReturnValue({ remoteConfigReady })
  mockUseRemoteConfig.mockReturnValue({ custodialCreationBlockedCountries })
  return renderHook(() => useRegionCheck(enabled)).result.current
}

describe("useRegionCheck", () => {
  beforeEach(() => jest.clearAllMocks())

  describe("the verdict", () => {
    it("refuses creation and reports the session restricted in a listed country", () => {
      const verdict = setUp({ countryCode: "CU" })

      expect(verdict.custodialCreationAllowed).toBe(false)
      expect(verdict.restricted).toBe(true)
    })

    it("allows both where the list does not carry the country", () => {
      const verdict = setUp({ countryCode: "SV" })

      expect(verdict.custodialCreationAllowed).toBe(true)
      expect(verdict.restricted).toBe(false)
    })

    it("allows both while the country is unresolved", () => {
      // Nothing was read, so nothing may be held against the user.
      const verdict = setUp({ countryCode: undefined })

      expect(verdict.custodialCreationAllowed).toBe(true)
      expect(verdict.restricted).toBe(false)
    })

    it("matches case-insensitively, since the list is stored uppercase", () => {
      expect(setUp({ countryCode: "cu" }).restricted).toBe(true)
    })

    it("reports the country it resolved", () => {
      expect(setUp({ countryCode: "SV" }).countryCode).toBe("SV")
    })
  })

  describe("locating the user", () => {
    it("resolves nothing for a caller that did not ask", () => {
      // Reading the region is the act of locating someone. Anon is the standing case.
      setUp({ enabled: false })

      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(false)
    })

    it("passes the caller's intent through to the lookup", () => {
      setUp({ enabled: true })

      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(true)
    })
  })

  describe("isSettled", () => {
    it("is settled at once for a caller that asks nothing", () => {
      // There is no answer coming, so waiting on one would never end.
      expect(setUp({ enabled: false, isLookupSettled: false }).isSettled).toBe(true)
    })

    it("is false while the lookup is still running", () => {
      expect(setUp({ isLookupSettled: false }).isSettled).toBe(false)
    })

    it("is false until remote config has answered", () => {
      // An empty list mid-fetch would read as a country nothing restricts.
      expect(setUp({ countryCode: "CU", remoteConfigReady: false }).isSettled).toBe(false)
    })

    it("is true once both have settled, resolved country or not", () => {
      expect(setUp({ countryCode: "SV" }).isSettled).toBe(true)
      expect(setUp({ countryCode: undefined }).isSettled).toBe(true)
    })
  })
})

describe("useRegionCheckLazy", () => {
  const setUpLazy = ({
    ipCountryCode,
    custodialCreationBlockedCountries = ["CU", "IR"],
  }: {
    ipCountryCode?: string
    custodialCreationBlockedCountries?: string[]
  }) => {
    mockResolveIpCountryCodeCached.mockResolvedValue(ipCountryCode)
    mockUseRemoteConfig.mockReturnValue({ custodialCreationBlockedCountries })
    return renderHook(() => useRegionCheckLazy()).result.current
  }

  beforeEach(() => jest.clearAllMocks())

  it("locates nobody until it is called", () => {
    setUpLazy({ ipCountryCode: "CU" })

    // The creation screens hold this hook while the user is still only browsing.
    expect(mockResolveIpCountryCodeCached).not.toHaveBeenCalled()
  })

  it("refuses creation and reports restricted in a listed country", async () => {
    const verdict = await setUpLazy({ ipCountryCode: "CU" })()

    expect(verdict.custodialCreationAllowed).toBe(false)
    expect(verdict.restricted).toBe(true)
    expect(verdict.countryCode).toBe("CU")
  })

  it("allows both where the list does not carry the country", async () => {
    const verdict = await setUpLazy({ ipCountryCode: "SV" })()

    expect(verdict.custodialCreationAllowed).toBe(true)
    expect(verdict.restricted).toBe(false)
  })

  it("uppercases what the provider returned before matching the list", async () => {
    const verdict = await setUpLazy({ ipCountryCode: "cu" })()

    expect(verdict.countryCode).toBe("CU")
    expect(verdict.restricted).toBe(true)
  })

  it("answers an unresolved country as such, with nothing held against the user", async () => {
    const verdict = await setUpLazy({ ipCountryCode: undefined })()

    // No local fallback: the country-code cache answers "SV" for an unset value, and
    // reading it would turn "could not resolve" into a country nobody read.
    expect(verdict.countryCode).toBeUndefined()
    expect(verdict.custodialCreationAllowed).toBe(true)
    expect(verdict.restricted).toBe(false)
    expect(mockUpdateCountryCode).not.toHaveBeenCalled()
  })

  it("records the answer, so the rest of the app shares the country it read", async () => {
    await setUpLazy({ ipCountryCode: "SV" })()

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "SV")
  })
})
