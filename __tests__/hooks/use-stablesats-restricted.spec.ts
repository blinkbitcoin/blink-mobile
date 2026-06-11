import { renderHook } from "@testing-library/react-native"

import { getStablesatsRestricted } from "@app/store/persistent-state/stablesats-restriction"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType, DefaultAccountId } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUpdateState = jest.fn()

let mockPersistentState: PersistentState

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

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

import {
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
    mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })
    mockUseRemoteConfig.mockReturnValue({ stablesatsBlockedCountries: ["HK"] })
    mockUseActiveWallet.mockReturnValue({
      isSelfCustodial: false,
      accountType: AccountType.Custodial,
    })
    mockPersistentState = baseState
  })

  it("persists the restriction when a custodial account is in a blocked country", () => {
    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    const updater = mockUpdateState.mock.calls[0][0]
    expect(getStablesatsRestricted(updater(baseState))).toBe(true)
  })

  it("does not persist when the country is not blocked", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", loading: false })

    renderHook(() => useStablesatsRestrictionSync())

    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist when already flagged", () => {
    mockPersistentState = flaggedState

    renderHook(() => useStablesatsRestrictionSync())

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
