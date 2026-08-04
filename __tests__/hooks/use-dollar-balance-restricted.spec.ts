import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseIpCountryCode = jest.fn()

/** Mocked wholesale: the real module warns at load time when no API key is configured. */
jest.mock("@app/utils/ip-country-lookup", () => ({
  DEFAULT_ADAPTERS: [],
  resolveIpCountryCode: jest.fn(async () => undefined),
  resolveIpCountryCodeCached: jest.fn(async () => undefined),
}))

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

import {
  useDollarBalanceRestricted,
  useDollarBalanceRestriction,
} from "@app/hooks/use-dollar-balance-restricted"

const remoteConfig = {
  custodialDollarBalanceBlockedCountries: ["HK"],
  selfCustodialDollarBalanceBlockedCountries: ["FR"],
}

const setup = (accountType: AccountType): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue(remoteConfig)
  mockUseActiveWallet.mockReturnValue({ accountType })
  mockUseIpCountryCode.mockReturnValue(undefined)
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
      mockUseIpCountryCode.mockReturnValue("FR")
      expect(readOverride(AccountType.SelfCustodial)).toBe(true)
    })

    it("falls back to the session country when the IP does not resolve", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      mockUseIpCountryCode.mockReturnValue(undefined)
      expect(readOverride(AccountType.SelfCustodial)).toBe(true)
    })

    it("prefers the IP over the session country when both resolve", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      mockUseIpCountryCode.mockReturnValue("HK")
      expect(readOverride(AccountType.SelfCustodial)).toBe(false)
    })

    it("uses the self-custodial blocked list, not the custodial one", () => {
      mockUseIpCountryCode.mockReturnValue("HK")
      expect(readOverride(AccountType.SelfCustodial)).toBe(false)
    })

    it("consults IP for the self-custodial prediction", () => {
      readOverride(AccountType.SelfCustodial)
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
    })

    it("never consults IP for the custodial or default evaluations", () => {
      readOverride(AccountType.Custodial)
      read()
      expect(mockUseIpCountryCode).not.toHaveBeenCalledWith(true)
      expect(mockUseIpCountryCode).toHaveBeenCalledWith(false)
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
      mockUseIpCountryCode.mockReturnValue("FR")

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
      })
    })
  })
})
