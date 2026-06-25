import { renderHook } from "@testing-library/react-native"

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
  useTransferBlocked,
  useTransferBlockedSync,
} from "@app/hooks/use-transfer-blocked"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const setup = (): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue({
    custodialTransferBlockedCountries: ["DE"],
    selfCustodialTransferBlockedCountries: ["FR"],
    dollarRestrictionCacheEnabled: true,
  })
  mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
  mockUseIpCountryCode.mockReturnValue(undefined)
  mockPersistentState = baseState
}

describe("useTransferBlocked", () => {
  beforeEach(setup)

  it("blocks a self-custodial transfer when the country is in the self-custodial list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("blocks a custodial transfer when the country is in the custodial list", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "DE" })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("reads each account type from its own list, so the lists can diverge", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(false)
  })

  it("returns false when the country is in neither list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR" })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(false)
  })

  it("is case-insensitive on the device country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "fr" })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("stays blocked from the self-custodial persisted flag without a detected country", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("stays blocked from the custodial persisted flag without a detected country", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockPersistentState = { ...baseState, stablesatsTransferBlocked: true }
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  describe("with the restriction cache disabled remotely", () => {
    beforeEach(() => {
      mockUseRemoteConfig.mockReturnValue({
        custodialTransferBlockedCountries: ["DE"],
        selfCustodialTransferBlockedCountries: ["FR"],
        dollarRestrictionCacheEnabled: false,
      })
    })

    it("ignores the persisted flag so a stale block can be lifted", () => {
      mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
      expect(renderHook(() => useTransferBlocked()).result.current).toBe(false)
    })

    it("still blocks from the live device country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
    })
  })
})

describe("useTransferBlockedSync", () => {
  beforeEach(setup)

  it("persists the self-custodial flag when the phone country is in the self-custodial list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(baseState), fn(undefined))
      },
    )

    renderHook(() => useTransferBlockedSync())

    expect(updates[0]?.stableTokenTransferBlocked).toBe(true)
    expect(updates[1]).toBeUndefined()
  })

  it("persists the custodial flag when the phone country is in the custodial list", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "DE", source: "phone" })
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(baseState))
      },
    )

    renderHook(() => useTransferBlockedSync())

    expect(updates[0]?.stablesatsTransferBlocked).toBe(true)
  })

  it("persists the self-custodial flag via the IP country fallback when the phone country is not blocked", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", source: "phone" })
    mockUseIpCountryCode.mockReturnValue("FR")
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(baseState))
      },
    )

    renderHook(() => useTransferBlockedSync())

    expect(updates[0]?.stableTokenTransferBlocked).toBe(true)
  })

  it("re-fires on a custodial-to-self-custodial switch in a blocked country, writing the self-custodial flag too", () => {
    mockUseRemoteConfig.mockReturnValue({
      custodialTransferBlockedCountries: ["FR"],
      selfCustodialTransferBlockedCountries: ["FR"],
      dollarRestrictionCacheEnabled: true,
    })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })
    const writes: PersistentState[] = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        const next = fn(baseState)
        if (next) writes.push(next)
      },
    )

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    const { rerender } = renderHook(() => useTransferBlockedSync())

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    rerender({})

    expect(writes[0]?.stablesatsTransferBlocked).toBe(true)
    expect(writes[1]?.stableTokenTransferBlocked).toBe(true)
  })

  it("does not persist again when it is already blocked", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })

    renderHook(() => useTransferBlockedSync())

    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  describe("with the restriction cache disabled remotely", () => {
    beforeEach(() => {
      mockUseRemoteConfig.mockReturnValue({
        custodialTransferBlockedCountries: ["DE"],
        selfCustodialTransferBlockedCountries: ["FR"],
        dollarRestrictionCacheEnabled: false,
      })
    })

    it("does not persist even in a blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })
      renderHook(() => useTransferBlockedSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not consult IP", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", source: "phone" })
      renderHook(() => useTransferBlockedSync())
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
    })
  })
})
