import { renderHook } from "@testing-library/react-native"

import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType } from "@app/types/wallet"

const mockUseRegistrationCountry = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseFeatureFlags = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUpdateState = jest.fn()

let mockPersistentState: PersistentState

jest.mock("@app/hooks/use-registration-country", () => ({
  useRegistrationCountry: () => mockUseRegistrationCountry(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => mockUseFeatureFlags(),
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

const mockLogRegionRestrictionCleared = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logRegionRestrictionCleared: (...args: unknown[]) =>
    mockLogRegionRestrictionCleared(...args),
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

const country = (countryCode: string | undefined) => ({
  countryCode,
  loading: false,
  trusted: Boolean(countryCode),
})

const setup = (): void => {
  jest.clearAllMocks()
  mockUseRegistrationCountry.mockReturnValue({
    countryCode: undefined,
    loading: true,
    trusted: false,
  })
  mockUseRemoteConfig.mockReturnValue({
    custodialTransferBlockedCountries: ["DE"],
    selfCustodialTransferBlockedCountries: ["FR"],
    dollarRestrictionCacheEnabled: true,
    restrictionSelfHealEnabled: true,
  })
  mockUseFeatureFlags.mockReturnValue({ remoteConfigLoaded: true })
  mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
  mockPersistentState = baseState
}

describe("useTransferBlocked", () => {
  beforeEach(setup)

  it("blocks a self-custodial transfer when the country is in the self-custodial list", () => {
    mockUseRegistrationCountry.mockReturnValue(country("FR"))
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("blocks a custodial transfer when the country is in the custodial list", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseRegistrationCountry.mockReturnValue(country("DE"))
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("reads each account type from its own list, so the lists can diverge", () => {
    mockUseRegistrationCountry.mockReturnValue(country("FR"))

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(false)
  })

  it("returns false when the country is in neither list", () => {
    mockUseRegistrationCountry.mockReturnValue(country("AR"))
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(false)
  })

  it("is case-insensitive on the registration country", () => {
    mockUseRegistrationCountry.mockReturnValue(country("fr"))
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("stays blocked from the self-custodial persisted flag without a detected country", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue(country(undefined))
    expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
  })

  it("stays blocked from the custodial persisted flag without a detected country", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockPersistentState = { ...baseState, stablesatsTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue(country(undefined))
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
      mockUseRegistrationCountry.mockReturnValue(country(undefined))
      expect(renderHook(() => useTransferBlocked()).result.current).toBe(false)
    })

    it("still blocks from the live registration country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("FR"))
      expect(renderHook(() => useTransferBlocked()).result.current).toBe(true)
    })
  })
})

describe("useTransferBlockedSync", () => {
  beforeEach(setup)

  it("persists the self-custodial flag when the registration country is in the self-custodial list", () => {
    mockUseRegistrationCountry.mockReturnValue(country("FR"))
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

  it("persists the custodial flag when the registration country is in the custodial list", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseRegistrationCountry.mockReturnValue(country("DE"))
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(baseState))
      },
    )

    renderHook(() => useTransferBlockedSync())

    expect(updates[0]?.stablesatsTransferBlocked).toBe(true)
  })

  it("does not persist when the registration country is not blocked", () => {
    mockUseRegistrationCountry.mockReturnValue(country("AR"))
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not persist while the country is still resolving", () => {
    mockUseRegistrationCountry.mockReturnValue({
      countryCode: undefined,
      loading: true,
      trusted: false,
    })
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("re-fires on a custodial-to-self-custodial switch in a blocked country, writing the self-custodial flag too", () => {
    mockUseRemoteConfig.mockReturnValue({
      custodialTransferBlockedCountries: ["FR"],
      selfCustodialTransferBlockedCountries: ["FR"],
      dollarRestrictionCacheEnabled: true,
    })
    mockUseRegistrationCountry.mockReturnValue(country("FR"))
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
    mockUseRegistrationCountry.mockReturnValue(country("FR"))

    renderHook(() => useTransferBlockedSync())

    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("clears the self-custodial flag when the trusted country is allowed", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue(country("AR"))
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(mockPersistentState), fn(undefined))
      },
    )

    renderHook(() => useTransferBlockedSync())

    expect(updates[0]?.stableTokenTransferBlocked).toBe(false)
    expect(updates[1]).toBeUndefined()
    expect(mockLogRegionRestrictionCleared).toHaveBeenCalledWith({
      restriction: "transfer",
      accountType: AccountType.SelfCustodial,
      countryCode: "AR",
    })
  })

  it("logs 'unknown' defensively if trusted is ever reported without a country", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue({
      countryCode: undefined,
      loading: false,
      trusted: true,
    })

    renderHook(() => useTransferBlockedSync())

    expect(mockLogRegionRestrictionCleared).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: "unknown" }),
    )
  })

  it("does not clear when self-healing is remotely disabled", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseRemoteConfig.mockReturnValue({
      custodialTransferBlockedCountries: ["DE"],
      selfCustodialTransferBlockedCountries: ["FR"],
      dollarRestrictionCacheEnabled: true,
      restrictionSelfHealEnabled: false,
    })
    mockUseRegistrationCountry.mockReturnValue(country("AR"))
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockLogRegionRestrictionCleared).not.toHaveBeenCalled()
  })

  it("clears the custodial flag when the trusted country is allowed", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockPersistentState = { ...baseState, stablesatsTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue(country("AR"))
    const updates: Array<PersistentState | undefined> = []
    mockUpdateState.mockImplementation(
      (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
        updates.push(fn(mockPersistentState))
      },
    )

    renderHook(() => useTransferBlockedSync())

    expect(updates[0]?.stablesatsTransferBlocked).toBe(false)
  })

  it("does not clear while the country is still resolving", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue({
      countryCode: undefined,
      loading: true,
      trusted: false,
    })
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("does not clear while remote config has not loaded (default lists in use)", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseFeatureFlags.mockReturnValue({ remoteConfigLoaded: false })
    mockUseRegistrationCountry.mockReturnValue(country("AR"))
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("still persists while remote config has not loaded", () => {
    mockUseFeatureFlags.mockReturnValue({ remoteConfigLoaded: false })
    mockUseRegistrationCountry.mockReturnValue(country("FR"))
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).toHaveBeenCalledTimes(1)
  })

  it("does not clear when country detection failed", () => {
    mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
    mockUseRegistrationCountry.mockReturnValue({
      countryCode: undefined,
      loading: false,
      trusted: false,
    })
    renderHook(() => useTransferBlockedSync())
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  describe("with the restriction cache disabled remotely", () => {
    beforeEach(() => {
      mockUseRemoteConfig.mockReturnValue({
        custodialTransferBlockedCountries: ["DE"],
        selfCustodialTransferBlockedCountries: ["FR"],
        dollarRestrictionCacheEnabled: false,
        restrictionSelfHealEnabled: true,
      })
    })

    it("does not persist even in a blocked country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("FR"))
      renderHook(() => useTransferBlockedSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("still clears a stale flag so it cannot resurface when the cache is re-enabled", () => {
      mockPersistentState = { ...baseState, stableTokenTransferBlocked: true }
      mockUseRegistrationCountry.mockReturnValue(country("AR"))
      const updates: Array<PersistentState | undefined> = []
      mockUpdateState.mockImplementation(
        (fn: (state: PersistentState | undefined) => PersistentState | undefined) => {
          updates.push(fn(mockPersistentState))
        },
      )

      renderHook(() => useTransferBlockedSync())

      expect(updates[0]?.stableTokenTransferBlocked).toBe(false)
    })
  })
})
