import { renderHook } from "@testing-library/react-native"

import {
  getStableTokenRestricted,
  withStableTokenRestricted,
} from "@app/store/persistent-state/stable-token-restriction"
import {
  getStablesatsRestricted,
  withStablesatsRestricted,
} from "@app/store/persistent-state/stablesats-restriction"
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
  useDollarBalanceRestricted,
  useDollarBalanceRestrictionSync,
} from "@app/hooks/use-dollar-balance-restricted"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const remoteConfig = {
  custodialDollarBalanceBlockedCountries: ["HK"],
  selfCustodialDollarBalanceBlockedCountries: ["FR"],
  dollarRestrictionCacheEnabled: true,
  restrictionSelfHealEnabled: true,
}

const country = (countryCode: string | undefined) => ({
  countryCode,
  loading: false,
  trusted: Boolean(countryCode),
})

const setup = (accountType: AccountType): void => {
  jest.clearAllMocks()
  mockUseRegistrationCountry.mockReturnValue({
    countryCode: undefined,
    loading: true,
    trusted: false,
  })
  mockUseRemoteConfig.mockReturnValue(remoteConfig)
  mockUseFeatureFlags.mockReturnValue({ remoteConfigLoaded: true })
  mockUseActiveWallet.mockReturnValue({ accountType })
  mockPersistentState = baseState
}

const read = () => renderHook(() => useDollarBalanceRestricted()).result.current

describe("useDollarBalanceRestricted", () => {
  describe("custodial", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("is restricted in a Stablesats-blocked country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      expect(read()).toBe(true)
    })

    it("is case-insensitive on the registration country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("hk"))
      expect(read()).toBe(true)
    })

    it("is not restricted in a country that only the stable-token list blocks", () => {
      mockUseRegistrationCountry.mockReturnValue(country("FR"))
      expect(read()).toBe(false)
    })

    it("stays restricted from the persisted custodial flag without a country", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue(country(undefined))
      expect(read()).toBe(true)
    })

    it("ignores the self-custodial persisted flag", () => {
      mockPersistentState = { ...baseState, stableTokenRestricted: true }
      mockUseRegistrationCountry.mockReturnValue(country("FR"))
      expect(read()).toBe(false)
    })
  })

  describe("self-custodial", () => {
    beforeEach(() => setup(AccountType.SelfCustodial))

    it("is restricted in a stable-token-blocked country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("FR"))
      expect(read()).toBe(true)
    })

    it("is not restricted in a country that only blocks custodial Stablesats", () => {
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      expect(read()).toBe(false)
    })

    it("stays restricted from the persisted stable-token flag", () => {
      mockPersistentState = { ...baseState, stableTokenRestricted: true }
      mockUseRegistrationCountry.mockReturnValue(country(undefined))
      expect(read()).toBe(true)
    })

    it("ignores the custodial persisted flag", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      expect(read()).toBe(false)
    })
  })

  describe("with the restriction cache disabled remotely", () => {
    beforeEach(() => {
      setup(AccountType.Custodial)
      mockUseRemoteConfig.mockReturnValue({
        ...remoteConfig,
        dollarRestrictionCacheEnabled: false,
      })
    })

    it("ignores the persisted flag so a stale restriction can be lifted", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue(country(undefined))
      expect(read()).toBe(false)
    })

    it("still restricts from the live registration country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      expect(read()).toBe(true)
    })
  })
})

describe("useDollarBalanceRestrictionSync", () => {
  describe("custodial", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("persists the custodial flag when the registration country is blocked", () => {
      mockUseRegistrationCountry.mockReturnValue(country("HK"))

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStablesatsRestricted(updater(baseState))).toBe(true)
      expect(updater(undefined)).toBeUndefined()
    })

    it("does not persist when the registration country is not blocked", () => {
      mockUseRegistrationCountry.mockReturnValue(country("SV"))
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not persist again once already flagged", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not persist while the country is still resolving", () => {
      mockUseRegistrationCountry.mockReturnValue({
        countryCode: undefined,
        loading: true,
        trusted: false,
      })
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("clears the custodial flag when the trusted country is allowed", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue(country("SV"))

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStablesatsRestricted(updater(withStablesatsRestricted(baseState)))).toBe(
        false,
      )
      expect(updater(undefined)).toBeUndefined()
      expect(mockLogRegionRestrictionCleared).toHaveBeenCalledWith({
        restriction: "dollar_balance",
        accountType: AccountType.Custodial,
        countryCode: "SV",
      })
    })

    it("logs 'unknown' defensively if trusted is ever reported without a country", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue({
        countryCode: undefined,
        loading: false,
        trusted: true,
      })

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockLogRegionRestrictionCleared).toHaveBeenCalledWith(
        expect.objectContaining({ countryCode: "unknown" }),
      )
    })

    it("does not clear when self-healing is remotely disabled", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRemoteConfig.mockReturnValue({
        ...remoteConfig,
        restrictionSelfHealEnabled: false,
      })
      mockUseRegistrationCountry.mockReturnValue(country("SV"))
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
      expect(mockLogRegionRestrictionCleared).not.toHaveBeenCalled()
    })

    it("does not clear while the country is still resolving", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue({
        countryCode: undefined,
        loading: true,
        trusted: false,
      })
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not clear while remote config has not loaded (default lists in use)", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseFeatureFlags.mockReturnValue({ remoteConfigLoaded: false })
      mockUseRegistrationCountry.mockReturnValue(country("SV"))
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("still persists while remote config has not loaded", () => {
      mockUseFeatureFlags.mockReturnValue({ remoteConfigLoaded: false })
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).toHaveBeenCalledTimes(1)
    })

    it("does not clear when country detection failed", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue({
        countryCode: undefined,
        loading: false,
        trusted: false,
      })
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not touch the self-custodial flag when clearing the custodial one", () => {
      mockPersistentState = {
        ...baseState,
        stablesatsRestrictedCustodial: true,
        stableTokenRestricted: true,
      }
      mockUseRegistrationCountry.mockReturnValue(country("SV"))

      renderHook(() => useDollarBalanceRestrictionSync())

      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStableTokenRestricted(updater(mockPersistentState))).toBe(true)
    })
  })

  describe("self-custodial", () => {
    beforeEach(() => setup(AccountType.SelfCustodial))

    it("persists the stable-token flag when the registration country is blocked", () => {
      mockUseRegistrationCountry.mockReturnValue(country("FR"))

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStableTokenRestricted(updater(baseState))).toBe(true)
      expect(updater(undefined)).toBeUndefined()
    })

    it("clears the stable-token flag when the trusted country is allowed", () => {
      mockPersistentState = { ...baseState, stableTokenRestricted: true }
      mockUseRegistrationCountry.mockReturnValue(country("SV"))

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(
        getStableTokenRestricted(updater(withStableTokenRestricted(baseState))),
      ).toBe(false)
    })
  })

  describe("with the restriction cache disabled remotely", () => {
    beforeEach(() => {
      setup(AccountType.Custodial)
      mockUseRemoteConfig.mockReturnValue({
        ...remoteConfig,
        dollarRestrictionCacheEnabled: false,
      })
    })

    it("does not persist even in a blocked country", () => {
      mockUseRegistrationCountry.mockReturnValue(country("HK"))
      renderHook(() => useDollarBalanceRestrictionSync())
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("still clears a stale flag so it cannot resurface when the cache is re-enabled", () => {
      mockPersistentState = { ...baseState, stablesatsRestrictedCustodial: true }
      mockUseRegistrationCountry.mockReturnValue(country("SV"))

      renderHook(() => useDollarBalanceRestrictionSync())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(getStablesatsRestricted(updater(withStablesatsRestricted(baseState)))).toBe(
        false,
      )
    })
  })

  it("writes the self-custodial flag too when a blocked-country user switches from custodial to self-custodial", () => {
    setup(AccountType.Custodial)
    mockUseRegistrationCountry.mockReturnValue(country("HK"))
    mockUseRemoteConfig.mockReturnValue({
      custodialDollarBalanceBlockedCountries: ["HK"],
      selfCustodialDollarBalanceBlockedCountries: ["HK"],
      dollarRestrictionCacheEnabled: true,
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

  it("clears the other flag too when an allowed-country user switches account type", () => {
    setup(AccountType.Custodial)
    mockPersistentState = {
      ...baseState,
      stablesatsRestrictedCustodial: true,
      stableTokenRestricted: true,
    }
    mockUseRegistrationCountry.mockReturnValue(country("SV"))

    const { rerender } = renderHook(() => useDollarBalanceRestrictionSync())

    const custodialUpdater = mockUpdateState.mock.calls[0][0]
    expect(getStablesatsRestricted(custodialUpdater(mockPersistentState))).toBe(false)

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    rerender({})

    expect(mockUpdateState).toHaveBeenCalledTimes(2)
    const selfCustodialUpdater = mockUpdateState.mock.calls[1][0]
    expect(getStableTokenRestricted(selfCustodialUpdater(mockPersistentState))).toBe(
      false,
    )
  })
})
