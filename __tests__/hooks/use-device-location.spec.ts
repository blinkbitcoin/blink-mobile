import { renderHook, act } from "@testing-library/react-hooks"
import axios from "axios"

import useDeviceLocation, { useIpCountryCode } from "@app/hooks/use-device-location"

const mockLogError = jest.fn()
const mockUpdateCountryCode = jest.fn()

jest.mock("axios")

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

const mockedAxios = axios as jest.Mocked<typeof axios>

describe("useDeviceLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })
  })

  it("should not expose any country code while loading", () => {
    mockUseCountryCodeQuery.mockReturnValue({ data: undefined, error: undefined })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(true)
    expect(result.current.countryCode).toBeUndefined()
    expect(result.current.detectionFailed).toBe(false)
  })

  it("should resolve country from logged-in user phone without calling ipapi", async () => {
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
    expect(mockedAxios.get).not.toHaveBeenCalled()
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

  it("should fall back to ipapi when user has no phone", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: null } },
    })
    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "PL" } })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
    expect(result.current.detectionFailed).toBe(false)
    expect(result.current.source).toBe("ip")
    expect(mockedAxios.get).toHaveBeenCalled()
  })

  it("should resolve to the ipapi country code and never flash SV as intermediate value", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })

    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "PL" } })

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

  it("uses the cached country and does NOT mark detection failed when ipapi fails but cache exists", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "PL" },
      error: undefined,
    })

    mockedAxios.get.mockRejectedValue(new Error("429 Too Many Requests"))

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
    expect(result.current.detectionFailed).toBe(false)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "ipapi", hasCached: true }),
      }),
    )
  })

  it("marks detection failed when ipapi fails and no cached value exists (falls back to SV)", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: null },
      error: undefined,
    })

    mockedAxios.get.mockRejectedValue(new Error("Network Error"))

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "ipapi", hasCached: false }),
      }),
    )
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

  it("should update Apollo cache when ipapi succeeds", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })

    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "DE" } })

    renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "DE")
  })

  it("marks detection failed when ipapi returns no country_code and no cache exists", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: null },
      error: undefined,
    })

    mockedAxios.get.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockLogError).toHaveBeenCalled()
  })
})

describe("useIpCountryCode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does not call ipapi while disabled", () => {
    const { result } = renderHook(() => useIpCountryCode(false))

    expect(mockedAxios.get).not.toHaveBeenCalled()
    expect(result.current).toBeUndefined()
  })

  it("resolves the country from ipapi when enabled", async () => {
    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "HK" } })

    const { result } = renderHook(() => useIpCountryCode(true))

    await act(async () => {})

    expect(mockedAxios.get).toHaveBeenCalled()
    expect(result.current).toBe("HK")
  })

  it("stays undefined when ipapi fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("403 Forbidden"))

    const { result } = renderHook(() => useIpCountryCode(true))

    await act(async () => {})

    expect(result.current).toBeUndefined()
    expect(mockLogError).toHaveBeenCalled()
  })
})
