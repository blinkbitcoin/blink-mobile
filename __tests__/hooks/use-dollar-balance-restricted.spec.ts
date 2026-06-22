import { renderHook } from "@testing-library/react-native"

import { getStableTokenRestricted } from "@app/store/persistent-state/stable-token-restriction"
import { getStablesatsRestricted } from "@app/store/persistent-state/stablesats-restriction"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUpdateState = jest.fn()
const mockUseIpCountryCode = jest.fn()

let mockPersistentState: PersistentState

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
  useIpCountryCode: (enabled: boolean) => mockUseIpCountryCode(enabled),
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
  useDollarBalanceRestricted,
  useDollarBalanceRestrictionSync,
} from "@app/hooks/use-dollar-balance-restricted"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const remoteConfig = {
  stablesatsBlockedCountries: ["HK"],
  stableTokenBlockedCountries: ["FR"],
}

const setup = (accountType: AccountType): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue(remoteConfig)
  mockUseActiveWallet.mockReturnValue({ accountType })
  mockUseIpCountryCode.mockReturnValue(undefined)
  mockPersistentState = baseState
}

const read = () => renderHook(() => useDollarBalanceRestricted()).result.current

describe("useDollarBalanceRestricted", () => {
  describe("custodial", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("is restricted in a Stablesats-blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK" })
      expect(read()).toBe(true)
    })

    it("is case-insensitive on the device country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "hk" })
      expect(read()).toBe(true)
    })

    it("is not restricted in a country that only the stable-token list blocks", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(read()).toBe(false)
    })

    it("stays restricted from the persisted custodial flag without a country", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
      expect(read()).toBe(true)
    })

    it("ignores the self-custodial persisted flag", () => {
      mockPersistentState = { ...baseState, stableTokenRestricted: true }
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(read()).toBe(false)
    })
  })

  describe("self-custodial", () => {
    beforeEach(() => setup(AccountType.SelfCustodial))

    it("is restricted in a stable-token-blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(read()).toBe(true)
    })

    it("is not restricted in a country that only blocks custodial Stablesats", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK" })
      expect(read()).toBe(false)
    })

    it("stays restricted from the persisted stable-token flag", () => {
      mockPersistentState = { ...baseState, stableTokenRestricted: true }
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
      expect(read()).toBe(true)
    })

    it("ignores the custodial persisted flag", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK" })
      expect(read()).toBe(false)
    })
  })
})

describe("useDollarBalanceRestrictionSync", () => {
  describe("custodial", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("persists the custodial flag when the phone country is blocked", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", source: "phone" })

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStablesatsRestricted(updater(baseState))).toBe(true)
      expect(updater(undefined)).toBeUndefined()
    })

    it("does not consult IP when the phone country already blocks", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", source: "phone" })
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
    })

    it("falls back to IP and persists when the phone country does not block", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", source: "phone" })
      mockUseIpCountryCode.mockReturnValue("HK")
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
      expect(mockUpdateState).toHaveBeenCalledTimes(1)
    })

    it("does not persist when neither phone nor IP blocks", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", source: "phone" })
      mockUseIpCountryCode.mockReturnValue("AR")
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not persist again once already flagged", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", source: "phone" })
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
      expect(mockUpdateState).not.toHaveBeenCalled()
    })
  })

  describe("self-custodial", () => {
    beforeEach(() => setup(AccountType.SelfCustodial))

    it("persists the stable-token flag when the phone country is blocked", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStableTokenRestricted(updater(baseState))).toBe(true)
      expect(updater(undefined)).toBeUndefined()
    })

    it("falls back to IP and persists the stable-token flag", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "SV", source: "phone" })
      mockUseIpCountryCode.mockReturnValue("FR")
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
      expect(mockUpdateState).toHaveBeenCalledTimes(1)
    })
  })

  it("does not consult IP when the source is not the phone", () => {
    setup(AccountType.Custodial)
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", source: "ip" })
    renderHook(() => useDollarBalanceRestrictionSync())
    expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("writes the self-custodial flag too when a blocked-country user switches from custodial to self-custodial", () => {
    setup(AccountType.Custodial)
    mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", source: "phone" })
    mockUseRemoteConfig.mockReturnValue({
      stablesatsBlockedCountries: ["HK"],
      stableTokenBlockedCountries: ["HK"],
    })

    const { rerender } = renderHook(() => useDollarBalanceRestrictionSync())

    const custodialUpdater = mockUpdateState.mock.calls[0][0]
    expect(getStablesatsRestricted(custodialUpdater(baseState))).toBe(true)

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    rerender({})

    expect(mockUpdateState).toHaveBeenCalledTimes(2)
    const selfCustodialUpdater = mockUpdateState.mock.calls[1][0]
    expect(getStableTokenRestricted(selfCustodialUpdater(baseState))).toBe(true)
  })
})
