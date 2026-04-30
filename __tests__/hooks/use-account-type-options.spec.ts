import { renderHook } from "@testing-library/react-native"

import { AccountOption, useAccountTypeOptions } from "@app/hooks/use-account-type-options"

const mockUseFeatureFlags = jest.fn()
const mockUseDeviceLocation = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockUseDeviceLocation(),
}))

describe("useAccountTypeOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns both options when self-custodial is enabled and the country allows custodial", () => {
    mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled: true })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", loading: false })

    const { result } = renderHook(() => useAccountTypeOptions())

    expect(result.current.options).toEqual([
      AccountOption.SelfCustodial,
      AccountOption.Custodial,
    ])
    expect(result.current.defaultSelected).toBeNull()
    expect(result.current.selfCustodialTemporarilyDisabled).toBe(false)
  })

  it("hides custodial when the country is not on the allow-list", () => {
    mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled: true })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })

    const { result } = renderHook(() => useAccountTypeOptions())

    expect(result.current.options).toEqual([AccountOption.SelfCustodial])
    expect(result.current.defaultSelected).toBe(AccountOption.SelfCustodial)
  })

  it("hides self-custodial and exposes a disabled flag when the remote flag is off", () => {
    mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled: false })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", loading: false })

    const { result } = renderHook(() => useAccountTypeOptions())

    expect(result.current.options).toEqual([AccountOption.Custodial])
    expect(result.current.defaultSelected).toBe(AccountOption.Custodial)
    expect(result.current.selfCustodialTemporarilyDisabled).toBe(true)
  })

  it("returns no options when both gates are closed", () => {
    mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled: false })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })

    const { result } = renderHook(() => useAccountTypeOptions())

    expect(result.current.options).toEqual([])
    expect(result.current.defaultSelected).toBeNull()
    expect(result.current.selfCustodialTemporarilyDisabled).toBe(true)
  })

  it("propagates the loading flag from device location", () => {
    mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled: true })
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })

    const { result } = renderHook(() => useAccountTypeOptions())

    expect(result.current.loading).toBe(true)
  })
})
