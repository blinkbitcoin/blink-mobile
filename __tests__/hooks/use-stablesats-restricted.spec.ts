import { act, renderHook } from "@testing-library/react-native"

import { getStablesatsRestricted } from "@app/store/persistent-state/stablesats-restriction"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType, DefaultAccountId } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUpdateState = jest.fn()
const mockUseIpCountryCode = jest.fn()

let mockPersistentState: PersistentState

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockUseDeviceLocation(),
  useIpCountryCode: (enabled: boolean) => mockUseIpCountryCode(enabled),
  LocationSource: { Phone: "phone", Ip: "ip" },
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

import {
  useStablesatsForcedConversion,
  useStablesatsRestricted,
  useStablesatsRestrictionSync,
} from "@app/hooks/use-stablesats-restricted"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const flaggedState: PersistentState = {
  ...baseState,
  stablesatsRestrictedByAccountId: { [DefaultAccountId.Custodial]: true },
}

describe("useStablesatsRestricted (query)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: ["HK"] })
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      accountType: AccountType.Custodial,
    })
    mockPersistentState = baseState
  })

  it("returns false when country detection has not completed and nothing is flagged", () => {
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

  it("returns false when the remote config list is empty and nothing is flagged", () => {
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: [] })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })
    const { result } = renderHook(() => useStablesatsRestricted())
    expect(result.current).toBe(false)
  })

  describe("self-custodial gating", () => {
    it("returns false for self-custodial users even in a blocked country", () => {
      mockUseActiveWallet.mockReturnValue({
        isSelfCustodial: true,
        accountType: AccountType.SelfCustodial,
      })
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(false)
    })

    it("returns false for self-custodial users even when the account was flagged", () => {
      mockUseActiveWallet.mockReturnValue({
        isSelfCustodial: true,
        accountType: AccountType.SelfCustodial,
      })
      mockPersistentState = flaggedState

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(false)
    })
  })

  describe("sticky read", () => {
    it("stays restricted when the location signal is later lost (phone removed)", () => {
      mockPersistentState = flaggedState
      mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", loading: false })

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(true)
    })

    it("stays restricted with no detected country once flagged", () => {
      mockPersistentState = flaggedState
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: false })

      const { result } = renderHook(() => useStablesatsRestricted())
      expect(result.current).toBe(true)
    })
  })
})

describe("useStablesatsRestrictionSync (command)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDeviceLocation.mockReturnValue({
      countryCode: "HK",
      loading: false,
      source: "phone",
    })
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: ["HK"] })
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      accountType: AccountType.Custodial,
    })
    mockUseIpCountryCode.mockReturnValue(undefined)
    mockPersistentState = baseState
  })

  it("persists the restriction when the phone country is blocked", () => {
    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    const updater = mockUpdateState.mock.calls[0][0]
    expect(getStablesatsRestricted(updater(baseState))).toBe(true)
  })

  it("does not consult IP when the phone country already restricts", () => {
    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
  })

  it("falls back to IP when the phone country does not restrict and persists when IP is blocked", () => {
    mockUseDeviceLocation.mockReturnValue({
      countryCode: "SV",
      loading: false,
      source: "phone",
    })
    mockUseIpCountryCode.mockReturnValue("HK")

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
    expect(mockUpdateState).toHaveBeenCalledTimes(1)
  })

  it("does not persist when neither phone nor IP country is blocked", () => {
    mockUseDeviceLocation.mockReturnValue({
      countryCode: "SV",
      loading: false,
      source: "phone",
    })
    mockUseIpCountryCode.mockReturnValue("AR")

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not consult IP when there is no phone", () => {
    mockUseDeviceLocation.mockReturnValue({
      countryCode: "AR",
      loading: false,
      source: "ip",
    })

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist when already flagged", () => {
    mockPersistentState = flaggedState

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist for self-custodial accounts", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: true,
      accountType: AccountType.SelfCustodial,
    })

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist for a self-custodial account whose SDK is still connecting", () => {
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      accountType: AccountType.SelfCustodial,
    })

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUpdateState).not.toHaveBeenCalled()
  })
})

describe("useStablesatsForcedConversion", () => {
  it("opens the convert modal when restricted and the balance is positive", () => {
    const { result } = renderHook(() =>
      useStablesatsForcedConversion({ isRestricted: true, usdWalletBalance: 5000 }),
    )

    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("does not open when the account is not restricted", () => {
    const { result } = renderHook(() =>
      useStablesatsForcedConversion({ isRestricted: false, usdWalletBalance: 5000 }),
    )

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("does not open when the restricted account has no balance", () => {
    const { result } = renderHook(() =>
      useStablesatsForcedConversion({ isRestricted: true, usdWalletBalance: 0 }),
    )

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("stays closed after the user dismisses it while still restricted", () => {
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useStablesatsForcedConversion({ isRestricted: true, usdWalletBalance: balance }),
      { initialProps: { balance: 5000 } },
    )
    expect(result.current.isConvertModalVisible).toBe(true)

    act(() => result.current.closeConvertModal())
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ balance: 5000 })
    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("re-opens when a positive balance arrives after being zero", () => {
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useStablesatsForcedConversion({ isRestricted: true, usdWalletBalance: balance }),
      { initialProps: { balance: 0 } },
    )
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ balance: 5000 })
    expect(result.current.isConvertModalVisible).toBe(true)
  })
})
