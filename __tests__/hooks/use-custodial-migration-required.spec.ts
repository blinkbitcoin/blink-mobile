import { renderHook } from "@testing-library/react-native"

import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseAccountRegistry = jest.fn()
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
  ...jest.requireActual("@app/config/feature-flags-context"),
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

import {
  useCustodialMigrationRequired,
  useCustodialMigrationRequiredSync,
} from "@app/hooks/use-custodial-migration-required"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const flaggedState: PersistentState = {
  ...baseState,
  custodialMigrationRequired: true,
}

const setup = (): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue({ custodialMigrationRequiredCountries: ["US"] })
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { type: AccountType.Custodial },
  })
  mockUseIpCountryCode.mockReturnValue(undefined)
  mockPersistentState = baseState
}

describe("useCustodialMigrationRequired", () => {
  beforeEach(setup)

  it("returns false when the device country is not in the required list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR" })
    expect(renderHook(() => useCustodialMigrationRequired()).result.current).toBe(false)
  })

  it("returns true when the device country is in the required list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US" })
    expect(renderHook(() => useCustodialMigrationRequired()).result.current).toBe(true)
  })

  it("is case-insensitive on the device country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "us" })
    expect(renderHook(() => useCustodialMigrationRequired()).result.current).toBe(true)
  })

  it("returns false for self-custodial accounts even in a required country", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.SelfCustodial },
    })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US" })
    expect(renderHook(() => useCustodialMigrationRequired()).result.current).toBe(false)
  })

  it("returns false when no account is active, even with the flag persisted in a required country", () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })
    mockPersistentState = flaggedState
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US" })
    expect(renderHook(() => useCustodialMigrationRequired()).result.current).toBe(false)
  })

  it("stays required from the persisted flag after the country is no longer detected", () => {
    mockPersistentState = flaggedState
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
    expect(renderHook(() => useCustodialMigrationRequired()).result.current).toBe(true)
  })
})

describe("useCustodialMigrationRequiredSync", () => {
  beforeEach(setup)

  it("persists when the phone country is in the required list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US", source: "phone" })
    renderHook(() => useCustodialMigrationRequiredSync())
    expect(mockUpdateState).toHaveBeenCalled()
  })

  it("persists via the IP country fallback when the phone country is not blocked", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", source: "phone" })
    mockUseIpCountryCode.mockReturnValue("US")
    renderHook(() => useCustodialMigrationRequiredSync())
    expect(mockUpdateState).toHaveBeenCalled()
  })

  it("does not persist for self-custodial accounts", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.SelfCustodial },
    })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US", source: "phone" })
    renderHook(() => useCustodialMigrationRequiredSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist when no account is active", () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US", source: "phone" })
    renderHook(() => useCustodialMigrationRequiredSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
  })

  it("does not persist again when it is already flagged", () => {
    mockPersistentState = flaggedState
    mockUseDeviceLocation.mockReturnValue({ countryCode: "US", source: "phone" })
    renderHook(() => useCustodialMigrationRequiredSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })
})
