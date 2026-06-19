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
  useStableTokenTransferBlocked,
  useStableTokenTransferBlockedSync,
} from "@app/hooks/use-stable-token-transfer-blocked"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const flaggedState: PersistentState = {
  ...baseState,
  stableTokenTransferBlocked: true,
}

const setup = (): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue({ stableTokenTransferBlockedCountries: ["FR"] })
  mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
  mockUseIpCountryCode.mockReturnValue(undefined)
  mockPersistentState = baseState
}

describe("useStableTokenTransferBlocked", () => {
  beforeEach(setup)

  it("returns false when the device country is not in the blocked list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR" })
    expect(renderHook(() => useStableTokenTransferBlocked()).result.current).toBe(false)
  })

  it("returns true when the device country is in the blocked list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
    expect(renderHook(() => useStableTokenTransferBlocked()).result.current).toBe(true)
  })

  it("is case-insensitive on the device country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "fr" })
    expect(renderHook(() => useStableTokenTransferBlocked()).result.current).toBe(true)
  })

  it("returns false for custodial accounts even in a blocked country", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
    expect(renderHook(() => useStableTokenTransferBlocked()).result.current).toBe(false)
  })

  it("stays blocked from the persisted flag after the country is no longer detected", () => {
    mockPersistentState = flaggedState
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
    expect(renderHook(() => useStableTokenTransferBlocked()).result.current).toBe(true)
  })
})

describe("useStableTokenTransferBlockedSync", () => {
  beforeEach(setup)

  it("persists by flagging the state when the phone country is in the blocked list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(baseState), fn(undefined))
      },
    )

    renderHook(() => useStableTokenTransferBlockedSync())

    expect(mockUpdateState).toHaveBeenCalled()
    expect(updates[0]?.stableTokenTransferBlocked).toBe(true)
    expect(updates[1]).toBeUndefined()
  })

  it("persists via the IP country fallback when the phone country is not blocked", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", source: "phone" })
    mockUseIpCountryCode.mockReturnValue("FR")
    renderHook(() => useStableTokenTransferBlockedSync())
    expect(mockUpdateState).toHaveBeenCalled()
  })

  it("does not persist for custodial accounts", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })
    renderHook(() => useStableTokenTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist again when it is already blocked", () => {
    mockPersistentState = flaggedState
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", source: "phone" })
    renderHook(() => useStableTokenTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
})
