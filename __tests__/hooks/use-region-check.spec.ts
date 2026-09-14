import { renderHook } from "@testing-library/react-native"

import { useRegionCheck, useRegionCheckLazy } from "@app/hooks/use-region-check"

const mockUseRegionCheckQuery = jest.fn()
const mockClientQuery = jest.fn()
const mockUpdateCountryCode = jest.fn()
const mockUseSelfCustodialAccountMode = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useRegionCheckQuery: (options: unknown) => mockUseRegionCheckQuery(options),
}))

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({ query: (options: unknown) => mockClientQuery(options) }),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateCountryCode: (...args: unknown[]) => mockUpdateCountryCode(...args),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => mockUseSelfCustodialAccountMode(),
}))

type ServerVerdict = {
  countryCode?: string | null
  custodialCreationAllowed: boolean
  restricted: boolean
}

const ALLOWED: ServerVerdict = {
  countryCode: "SV",
  custodialCreationAllowed: true,
  restricted: false,
}

/** null stands for "the query answered nothing", which `undefined` cannot: it would take
 *  the parameter default instead. */
const setUp = ({
  enabled = true,
  isAnonMode = false,
  regionCheck = ALLOWED,
  loading = false,
}: {
  enabled?: boolean
  isAnonMode?: boolean
  regionCheck?: ServerVerdict | null
  loading?: boolean
}) => {
  mockUseSelfCustodialAccountMode.mockReturnValue({ isAnonMode })
  mockUseRegionCheckQuery.mockReturnValue({
    data: regionCheck ? { regionCheck } : undefined,
    loading,
  })
  return renderHook(() => useRegionCheck(enabled)).result.current
}

/** What the query hook was told, so the skip decision can be read directly. */
const lastQueryOptions = () => mockUseRegionCheckQuery.mock.calls.at(-1)?.[0]

describe("useRegionCheck", () => {
  beforeEach(() => jest.clearAllMocks())

  describe("the verdict", () => {
    it("reports the refusal the server gave, rather than deriving one", () => {
      const verdict = setUp({
        regionCheck: {
          countryCode: "CU",
          custodialCreationAllowed: false,
          restricted: true,
        },
      })

      expect(verdict.custodialCreationAllowed).toBe(false)
      expect(verdict.restricted).toBe(true)
    })

    it("carries the two fields separately, since the server separates them", () => {
      // A country closed to new accounts is not necessarily a sanctioned session.
      const verdict = setUp({
        regionCheck: {
          countryCode: "PK",
          custodialCreationAllowed: false,
          restricted: false,
        },
      })

      expect(verdict.custodialCreationAllowed).toBe(false)
      expect(verdict.restricted).toBe(false)
    })

    it("allows both where the server restricts nothing", () => {
      const verdict = setUp({ regionCheck: ALLOWED })

      expect(verdict.custodialCreationAllowed).toBe(true)
      expect(verdict.restricted).toBe(false)
    })

    it("holds nothing against the user when the query answered nothing", () => {
      const verdict = setUp({ regionCheck: null })

      expect(verdict.countryCode).toBeUndefined()
      expect(verdict.custodialCreationAllowed).toBe(true)
      expect(verdict.restricted).toBe(false)
    })

    it("reports the country the server resolved", () => {
      expect(setUp({ regionCheck: ALLOWED }).countryCode).toBe("SV")
    })

    it("uppercases the country, so every caller reads one casing", () => {
      expect(setUp({ regionCheck: { ...ALLOWED, countryCode: "sv" } }).countryCode).toBe(
        "SV",
      )
    })

    it("reports a verdict the server could not attach a country to", () => {
      const verdict = setUp({
        regionCheck: {
          countryCode: null,
          custodialCreationAllowed: true,
          restricted: false,
        },
      })

      expect(verdict.countryCode).toBeUndefined()
      expect(verdict.restricted).toBe(false)
    })
  })

  describe("locating the user", () => {
    it("asks nothing for a caller that did not ask", () => {
      // Reading the region is the act of locating someone.
      setUp({ enabled: false })

      expect(lastQueryOptions()).toMatchObject({ skip: true })
    })

    it("asks nothing in Anon, which spoke for an account that declined to be located", () => {
      setUp({ enabled: true, isAnonMode: true })

      expect(lastQueryOptions()).toMatchObject({ skip: true })
    })

    it("asks once the caller has a reason to", () => {
      setUp({ enabled: true })

      expect(lastQueryOptions()).toMatchObject({ skip: false })
    })

    it("never reads a cached verdict, which could speak for a network already left", () => {
      setUp({ enabled: true })

      expect(lastQueryOptions()).toMatchObject({ fetchPolicy: "no-cache" })
    })

    it("withholds a verdict left over from before Anon was entered", () => {
      // The skip keeps Apollo's last data around; returning it would leak a country the
      // account asked not to have read.
      const verdict = setUp({ isAnonMode: true, regionCheck: ALLOWED })

      expect(verdict.countryCode).toBeUndefined()
      expect(verdict.restricted).toBe(false)
    })
  })

  describe("isSettled", () => {
    it("is settled at once for a caller that asks nothing", () => {
      // There is no answer coming, so waiting on one would never end.
      expect(setUp({ enabled: false, loading: true }).isSettled).toBe(true)
    })

    it("is settled at once in Anon", () => {
      expect(setUp({ isAnonMode: true, loading: true }).isSettled).toBe(true)
    })

    it("is false while the query is in flight", () => {
      expect(setUp({ loading: true }).isSettled).toBe(false)
    })

    it("settles on an answer, and on the absence of one", () => {
      // An unreachable server is not a verdict, and holding the UI on it would strand a
      // user the app has no service left to protect anyway.
      expect(setUp({ regionCheck: ALLOWED }).isSettled).toBe(true)
      expect(setUp({ regionCheck: null }).isSettled).toBe(true)
    })
  })
})

describe("useRegionCheckLazy", () => {
  const setUpLazy = (result: { data?: { regionCheck: ServerVerdict } } | Error) => {
    if (result instanceof Error) mockClientQuery.mockRejectedValue(result)
    else mockClientQuery.mockResolvedValue(result)
    return renderHook(() => useRegionCheckLazy()).result.current
  }

  beforeEach(() => jest.clearAllMocks())

  it("locates nobody until it is called", () => {
    setUpLazy({ data: { regionCheck: ALLOWED } })

    // The creation screens hold this hook while the user is still only browsing.
    expect(mockClientQuery).not.toHaveBeenCalled()
  })

  it("reports the refusal the server gave", async () => {
    const verdict = await setUpLazy({
      data: {
        regionCheck: {
          countryCode: "CU",
          custodialCreationAllowed: false,
          restricted: true,
        },
      },
    })()

    expect(verdict.custodialCreationAllowed).toBe(false)
    expect(verdict.restricted).toBe(true)
    expect(verdict.countryCode).toBe("CU")
  })

  it("allows both where the server restricts nothing", async () => {
    const verdict = await setUpLazy({ data: { regionCheck: ALLOWED } })()

    expect(verdict.custodialCreationAllowed).toBe(true)
    expect(verdict.restricted).toBe(false)
  })

  it("uppercases what the server returned", async () => {
    const verdict = await setUpLazy({
      data: { regionCheck: { ...ALLOWED, countryCode: "sv" } },
    })()

    expect(verdict.countryCode).toBe("SV")
  })

  it("never reads a cached verdict", async () => {
    await setUpLazy({ data: { regionCheck: ALLOWED } })()

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fetchPolicy: "no-cache" }),
    )
  })

  it("answers an unreachable server as an unread region", async () => {
    // Account creation refuses on this rather than guessing; it is the one caller that
    // must not proceed without a region.
    const verdict = await setUpLazy(new Error("network down"))()

    expect(verdict.countryCode).toBeUndefined()
    expect(verdict.custodialCreationAllowed).toBe(true)
    expect(verdict.restricted).toBe(false)
    expect(mockUpdateCountryCode).not.toHaveBeenCalled()
  })

  it("answers a verdict with no country as an unread region", async () => {
    const verdict = await setUpLazy({
      data: {
        regionCheck: {
          countryCode: null,
          custodialCreationAllowed: true,
          restricted: false,
        },
      },
    })()

    expect(verdict.countryCode).toBeUndefined()
    expect(mockUpdateCountryCode).not.toHaveBeenCalled()
  })

  it("records the answer, so the rest of the app shares the country it read", async () => {
    await setUpLazy({ data: { regionCheck: ALLOWED } })()

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "SV")
  })
})
