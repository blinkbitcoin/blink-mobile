import { renderHook, act } from "@testing-library/react-hooks"
import axios from "axios"

import useDeviceLocation from "@app/hooks/use-device-location"

jest.mock("axios")

const mockUpdateCountryCode = jest.fn()
jest.mock("@app/graphql/client-only-query", () => ({
  updateCountryCode: (...args: unknown[]) => mockUpdateCountryCode(...args),
}))

const mockUseApolloClient = jest.fn(() => ({ mockClient: true }))
jest.mock("@apollo/client", () => ({
  useApolloClient: () => mockUseApolloClient(),
}))

const mockUseCountryCodeQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCountryCodeQuery: () => mockUseCountryCodeQuery(),
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

describe("useDeviceLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should not expose any country code while loading", () => {
    mockUseCountryCodeQuery.mockReturnValue({ data: undefined, error: undefined })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(true)
    expect(result.current.countryCode).toBeUndefined()
  })

  it("should resolve to the ipapi country code and never flash SV as intermediate value", async () => {
    // Apollo cache returns default "SV"
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })

    // ipapi will return "PL" (Poland)
    mockedAxios.get.mockResolvedValue({ data: { country_code: "PL" } })

    // Track every value emitted by the hook across all renders
    const emittedValues: Array<{ countryCode: string | undefined; loading: boolean }> = []

    const { result } = renderHook(() => {
      const hook = useDeviceLocation()
      emittedValues.push({ countryCode: hook.countryCode, loading: hook.loading })
      return hook
    })

    // Let the ipapi promise resolve
    await act(async () => {})

    // Final state should be the detected country
    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")

    // Critical assertion: no render ever showed "SV" while not loading.
    // This is the flag flicker bug — "SV" must never appear as a visible (non-loading) country.
    const visibleValues = emittedValues.filter((v) => !v.loading)
    for (const value of visibleValues) {
      expect(value.countryCode).not.toBe("SV")
    }

    // Also verify "SV" was never emitted at all (not even during loading),
    // since consumers like useRequestPhoneCodeLogin react to countryCode changes
    // via useEffect regardless of loading state.
    const allCountryCodes = emittedValues.map((v) => v.countryCode)
    expect(allCountryCodes).not.toContain("SV")
  })

  it("should fall back to cached country code when ipapi fails", async () => {
    // Apollo cache has "PL" from a previous session
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "PL" },
      error: undefined,
    })

    mockedAxios.get.mockRejectedValue(new Error("429 Too Many Requests"))

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
  })

  it("should fall back to SV when ipapi fails and no cached value exists", async () => {
    // Apollo cache returns empty/null countryCode
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: null },
      error: undefined,
    })

    mockedAxios.get.mockRejectedValue(new Error("Network Error"))

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
  })

  it("should fall back to SV on Apollo query error", () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: undefined,
      error: new Error("Apollo cache error"),
    })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
  })

  it("should update Apollo cache when ipapi succeeds", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })

    mockedAxios.get.mockResolvedValue({ data: { country_code: "DE" } })

    renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(
      expect.anything(), // apollo client
      "DE",
    )
  })

  it("should fall back to SV when ipapi returns no country_code", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: null },
      error: undefined,
    })

    mockedAxios.get.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
  })
})
