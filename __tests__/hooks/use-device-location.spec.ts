import { renderHook, act } from "@testing-library/react-hooks"

import useDeviceLocation, { useIpCountryCode } from "@app/hooks/use-device-location"

const mockLogError = jest.fn()
const mockUpdateCountryCode = jest.fn()

const mockParsePhoneNumber = jest.fn()
jest.mock("libphonenumber-js/mobile", () => ({
  ...jest.requireActual("libphonenumber-js/mobile"),
  parsePhoneNumber: (...args: unknown[]) => mockParsePhoneNumber(...args),
}))

const mockParsePhoneNumber = jest.fn()
jest.mock("libphonenumber-js/mobile", () => ({
  ...jest.requireActual("libphonenumber-js/mobile"),
  parsePhoneNumber: (...args: unknown[]) => mockParsePhoneNumber(...args),
}))

const mockResolveIpCountryCode = jest.fn()
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCode: (...args: unknown[]) => mockResolveIpCountryCode(...args),
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

describe("useDeviceLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
    expect(mockUpdateCountryCode).not.toHaveBeenCalled()
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
