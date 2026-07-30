import { renderHook, act } from "@testing-library/react-hooks"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryCode,
  useIpCountryLookup,
  usePhoneCountryCode,
} from "@app/hooks/use-device-location"

const mockLogError = jest.fn()
const mockUpdateCountryCode = jest.fn()

const mockParsePhoneNumber = jest.fn()
jest.mock("libphonenumber-js/mobile", () => ({
  ...jest.requireActual("libphonenumber-js/mobile"),
  parsePhoneNumber: (...args: unknown[]) => mockParsePhoneNumber(...args),
}))

const mockResolveIpCountryCode = jest.fn()
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: (...args: unknown[]) => mockResolveIpCountryCode(...args),
}))

jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateCountryCode: (...args: unknown[]) => mockUpdateCountryCode(...args),
}))

const mockUseApolloClient = jest.fn(() => ({ mockClient: true }))
jest.mock("@apollo/client", () => ({
  useApolloClient: () => mockUseApolloClient(),
}))

const mockUseCountryCodeQuery = jest.fn()
const mockUseSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCountryCodeQuery: () => mockUseCountryCodeQuery(),
  useSettingsScreenQuery: (...args: unknown[]) => mockUseSettingsScreenQuery(...args),
}))

let mockIsAnonMode = false
jest.mock("@app/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

describe("useDeviceLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockResolveIpCountryCode.mockResolvedValue(undefined)
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })
    mockParsePhoneNumber.mockImplementation(
      jest.requireActual("libphonenumber-js/mobile").parsePhoneNumber,
    )
  })

  it("should not expose any country code while loading", () => {
    mockUseCountryCodeQuery.mockReturnValue({ data: undefined, error: undefined })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(true)
    expect(result.current.countryCode).toBeUndefined()
    expect(result.current.detectionFailed).toBe(false)
  })

  it("should resolve country from logged-in user phone without calling IP lookup", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("DE")
    expect(result.current.detectionFailed).toBe(false)
    expect(result.current.source).toBe("phone")
    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
  })

  it("should update Apollo cache when resolving from user phone", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "DE")
  })

  it("marks detection as failed when user phone cannot be parsed", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "invalid-phone" } },
    })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "phone" }),
      }),
    )
  })

  it("should fall back to SV when phone parses but returns no country", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+15555555555" } },
    })
    mockParsePhoneNumber.mockReturnValue({ country: undefined })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockUpdateCountryCode).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "phone" }),
      }),
    )
  })

  it("should fall back to IP lookup when user has no phone", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: null } },
    })
    mockResolveIpCountryCode.mockResolvedValue("PL")

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
    expect(result.current.detectionFailed).toBe(false)
    expect(result.current.source).toBe("ip")
    expect(mockResolveIpCountryCode).toHaveBeenCalled()
  })

  it("should fall back to IP lookup when user is not logged in", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue("JP")

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("JP")
  })

  it("should resolve to the IP lookup country code and never flash SV as intermediate value", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue("PL")

    const emittedValues: Array<{ countryCode: string | undefined; loading: boolean }> = []

    const { result } = renderHook(() => {
      const hook = useDeviceLocation()
      emittedValues.push({ countryCode: hook.countryCode, loading: hook.loading })
      return hook
    })

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")

    const visibleValues = emittedValues.filter((v) => !v.loading)
    for (const value of visibleValues) {
      expect(value.countryCode).not.toBe("SV")
    }

    const allCountryCodes = emittedValues.map((v) => v.countryCode)
    expect(allCountryCodes).not.toContain("SV")
  })

  it("uses the cached country and does not mark detection failed when all adapters return nothing", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "PL" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
    expect(result.current.detectionFailed).toBe(false)
  })

  it("marks detection failed when all adapters return nothing and no cached value exists", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: null },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
  })

  describe("anon mode", () => {
    it("resolves nothing and issues no lookup, even with a phone available", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })
      mockUseSettingsScreenQuery.mockReturnValue({
        data: { me: { phone: "+4915112345678" } },
      })

      const { result } = renderHook(() => useDeviceLocation())

      await act(async () => {})

      expect(result.current).toEqual({
        countryCode: undefined,
        loading: false,
        detectionFailed: false,
        source: undefined,
      })
      expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
      expect(mockParsePhoneNumber).not.toHaveBeenCalled()
    })

    it("does not run the IP fallback for a phone-less account", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })

      renderHook(() => useDeviceLocation())

      await act(async () => {})

      expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    })

    it("stays inert on a query error", () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: undefined,
        error: new Error("Apollo cache error"),
      })

      const { result } = renderHook(() => useDeviceLocation())

      expect(result.current.loading).toBe(false)
      expect(result.current.countryCode).toBeUndefined()
      expect(result.current.detectionFailed).toBe(false)
    })

    it("detects normally for a custodial flow even while Anon is active", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })
      mockResolveIpCountryCode.mockResolvedValue("DE")

      const { result } = renderHook(() => useDeviceLocation({ isCustodialFlow: true }))

      await act(async () => {})

      expect(result.current.countryCode).toBe("DE")
      expect(result.current.loading).toBe(false)
      expect(mockResolveIpCountryCode).toHaveBeenCalled()
    })
  })

  it("marks detection failed on Apollo query error (falls back to SV)", () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: undefined,
      error: new Error("Apollo cache error"),
    })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "country-code-query" }),
      }),
    )
  })

  it("should update Apollo cache when IP lookup succeeds", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue("DE")

    renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "DE")
  })
})

describe("useIpCountryCode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockResolveIpCountryCode.mockResolvedValue(undefined)
  })

  it("does not call IP lookup while disabled", () => {
    const { result } = renderHook(() => useIpCountryCode(false))

    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    expect(result.current).toBeUndefined()
  })

  it("resolves the country from the adapter chain when enabled", async () => {
    mockResolveIpCountryCode.mockResolvedValue("HK")

    const { result } = renderHook(() => useIpCountryCode(true))

    await act(async () => {})

    expect(mockResolveIpCountryCode).toHaveBeenCalled()
    expect(result.current).toBe("HK")
  })

  it("stays undefined when all adapters return nothing", async () => {
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useIpCountryCode(true))

    await act(async () => {})

    expect(result.current).toBeUndefined()
  })
})

describe("useIpCountryLookup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveIpCountryCode.mockResolvedValue(undefined)
  })

  it("reports settled while disabled, since the lookup will never run", () => {
    const { result } = renderHook(() => useIpCountryLookup(false))

    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })

  it("is unsettled while the lookup is in flight", () => {
    mockResolveIpCountryCode.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useIpCountryLookup(true))

    expect(result.current.isSettled).toBe(false)
  })

  it("settles with the country once the lookup resolves", async () => {
    mockResolveIpCountryCode.mockResolvedValue("HK")

    const { result } = renderHook(() => useIpCountryLookup(true))

    await act(async () => {})

    expect(result.current).toEqual({ countryCode: "HK", isSettled: true })
  })

  it("settles without a country when every adapter returns nothing", async () => {
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useIpCountryLookup(true))

    await act(async () => {})

    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })

  it("drops a resolved country the moment the lookup is disabled", async () => {
    mockResolveIpCountryCode.mockResolvedValue("HK")

    const { result, rerender } = renderHook(
      ({ enabled }) => useIpCountryLookup(enabled),
      { initialProps: { enabled: true } },
    )

    await act(async () => {})
    expect(result.current.countryCode).toBe("HK")

    rerender({ enabled: false })

    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })
})

describe("usePhoneCountryCode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })
    mockParsePhoneNumber.mockImplementation(
      jest.requireActual("libphonenumber-js/mobile").parsePhoneNumber,
    )
  })

  it("resolves the country from the user phone", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBe("DE")
  })

  it("returns undefined when the user has no phone", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: null } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBeUndefined()
  })

  it("returns undefined when the phone cannot be parsed", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "invalid-phone" } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBeUndefined()
  })

  it("resolves nothing in Anon Mode even with a cached phone", () => {
    mockIsAnonMode = true
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBeUndefined()
    expect(mockParsePhoneNumber).not.toHaveBeenCalled()
  })
})

describe("isBlockedCountry", () => {
  it("returns true when country is in the blocked list", () => {
    expect(isBlockedCountry("US", ["US", "CN"])).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(isBlockedCountry("us", ["US"])).toBe(true)
  })

  it("returns false when country is not in the blocked list", () => {
    expect(isBlockedCountry("DE", ["US", "CN"])).toBe(false)
  })

  it("returns false when countryCode is undefined", () => {
    expect(isBlockedCountry(undefined, ["US"])).toBe(false)
  })
})
