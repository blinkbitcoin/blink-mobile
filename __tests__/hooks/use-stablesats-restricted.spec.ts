import { renderHook } from "@testing-library/react-native"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockUseDeviceLocation(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

import { useStablesatsRestricted } from "@app/hooks/use-stablesats-restricted"

describe("useStablesatsRestricted", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: ["HK"] })
  })

  it("returns false when country detection has not completed", () => {
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(false)
  })

  it("returns true when the device country is in the blocked list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(true)
  })

  it("returns false when the device country is not in the blocked list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", loading: false })
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(false)
  })

  it("is case-insensitive on the device country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "hk", loading: false })
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(true)
  })

  it("respects an expanded remote config list", () => {
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: ["HK", "CN"] })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "CN", loading: false })
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(true)
  })

  it("returns false when the remote config list is empty", () => {
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: [] })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(false)
  })
})
