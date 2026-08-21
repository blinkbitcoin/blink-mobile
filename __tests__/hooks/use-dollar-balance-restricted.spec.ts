import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseIpCountryLookup = jest.fn()

/** Mocked wholesale so these specs never reach a real geo lookup. */
jest.mock("@app/utils/ip-country-lookup", () => ({
  DEFAULT_ADAPTERS: [],
  resolveIpCountryCode: jest.fn(async () => undefined),
  resolveIpCountryCodeCached: jest.fn(async () => undefined),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
  useIpCountryLookup: (enabled: boolean) => mockUseIpCountryLookup(enabled),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

import {
  useDollarBalanceRestricted,
  useDollarBalanceRestriction,
} from "@app/hooks/use-dollar-balance-restricted"

const remoteConfig = {
  custodialDollarBalanceBlockedCountries: ["HK"],
  selfCustodialDollarBalanceBlockedCountries: ["FR"],
}

/** A disabled lookup reports settled, so only the tests that hold on it pass false. */
const setIpLookup = (countryCode: string | undefined, isSettled = true): void => {
  mockUseIpCountryLookup.mockReturnValue({ countryCode, isSettled })
}

const setup = (accountType: AccountType): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue(remoteConfig)
  mockUseActiveWallet.mockReturnValue({ accountType })
  setIpLookup(undefined)
}

const read = () => renderHook(() => useDollarBalanceRestricted()).result.current

const readRestriction = (accountTypeOverride?: AccountType) =>
  renderHook(() => useDollarBalanceRestriction(accountTypeOverride)).result.current

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

    it("is not restricted without a resolved country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
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
  })

  describe("with an account-type override", () => {
    // A still-custodial session predicting the phone-less self-custodial account.
    beforeEach(() => setup(AccountType.Custodial))

    const readOverride = (accountType: AccountType) =>
      renderHook(() => useDollarBalanceRestricted(accountType)).result.current

    it("predicts the self-custodial restriction from the IP, not the session phone", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK" })
      setIpLookup("FR")
      expect(readOverride(AccountType.SelfCustodial)).toBe(true)
    })

    it("falls back to the session country when the IP does not resolve", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      setIpLookup(undefined)
      expect(readOverride(AccountType.SelfCustodial)).toBe(true)
    })

    it("prefers the IP over the session country when both resolve", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      setIpLookup("HK")
      expect(readOverride(AccountType.SelfCustodial)).toBe(false)
    })

    it("uses the self-custodial blocked list, not the custodial one", () => {
      setIpLookup("HK")
      expect(readOverride(AccountType.SelfCustodial)).toBe(false)
    })

    it("consults IP for the self-custodial prediction", () => {
      readOverride(AccountType.SelfCustodial)
      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(true)
    })

    it("never consults IP for the custodial or default evaluations", () => {
      readOverride(AccountType.Custodial)
      read()
      expect(mockUseIpCountryLookup).not.toHaveBeenCalledWith(true)
      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(false)
    })
  })

  describe("while the region is still resolving", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("reports the region as pending without claiming a restriction", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })

      expect(readRestriction()).toEqual({ isRestricted: false, isRegionPending: true })
    })

    it("restricts once the region resolves to a blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK", loading: false })

      expect(readRestriction()).toEqual({ isRestricted: true, isRegionPending: false })
    })

    it("settles unrestricted once the region resolves to an allowed country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })

      expect(readRestriction()).toEqual({ isRestricted: false, isRegionPending: false })
    })

    it("settles on a finished lookup that produced no country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: false })

      expect(readRestriction()).toEqual({ isRestricted: false, isRegionPending: false })
    })

    it("settles the self-custodial prediction on the IP even while the device keeps loading", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })
      setIpLookup("FR")

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
      })
    })
  })

  describe("while the prediction's IP lookup is in flight", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("holds the prediction pending even though the device country already resolved", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
      setIpLookup(undefined, false)

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: false,
        isRegionPending: true,
      })
    })

    it("settles restricted once the in-flight IP lands on a blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
      setIpLookup("FR", true)

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
      })
    })

    it("settles on the session country once the lookup finishes without one", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", loading: false })
      setIpLookup(undefined, true)

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
      })
    })

    it("leaves the custodial evaluation settled, since it never waits on the IP", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
      setIpLookup(undefined, false)

      expect(readRestriction()).toEqual({ isRestricted: false, isRegionPending: false })
    })
  })
})
