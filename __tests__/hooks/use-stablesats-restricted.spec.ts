import { renderHook } from "@testing-library/react-native"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockUseDeviceLocation(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

import { useStablesatsRestricted } from "@app/hooks/use-stablesats-restricted"

describe("useStablesatsRestricted", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: ["HK"] })
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })
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

  describe("self-custodial gating", () => {
    it("returns false for self-custodial users even in a blocked country", () => {
      mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(false)
    })

    it("still returns false for self-custodial users with an empty blocked list", () => {
      mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })
      mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: [] })
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(false)
    })

    it("returns true for custodial users in a blocked country", () => {
      mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(true)
    })
  })
})
