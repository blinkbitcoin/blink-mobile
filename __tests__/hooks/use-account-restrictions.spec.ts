import { renderHook } from "@testing-library/react-native"

import { useAccountRestrictions } from "@app/hooks/use-account-restrictions"
import { AccountType } from "@app/types/wallet"

const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseDeviceLocation = jest.fn()
const mockUseIpCountryLookup = jest.fn()
let mockRemoteConfigReady = true

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => ({ remoteConfigReady: mockRemoteConfigReady }),
}))

/** Reached through use-device-location, and it warns about API keys on import. */
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: jest.fn(),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
  useIpCountryLookup: (enabled: boolean) => mockUseIpCountryLookup(enabled),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

const blockedCountries = {
  custodialDollarBalanceBlockedCountries: ["HK"],
  custodialTransferBlockedCountries: ["DE"],
  selfCustodialDollarBalanceBlockedCountries: ["FR"],
  selfCustodialTransferBlockedCountries: ["PK"],
}

const setUp = ({
  accountType = AccountType.Custodial,
  accountTypeOverride,
  countryCode,
  isLocationPending = false,
  ipCountryCode,
  isIpLookupSettled = true,
  remoteConfigReady = true,
}: {
  accountType?: AccountType
  accountTypeOverride?: AccountType
  countryCode?: string
  isLocationPending?: boolean
  ipCountryCode?: string
  isIpLookupSettled?: boolean
  remoteConfigReady?: boolean
}) => {
  mockRemoteConfigReady = remoteConfigReady
  mockUseDeviceLocation.mockReturnValue({ countryCode, loading: isLocationPending })
  mockUseIpCountryLookup.mockReturnValue({
    countryCode: ipCountryCode,
    isSettled: isIpLookupSettled,
  })
  mockUseActiveWallet.mockReturnValue({ accountType })
  mockUseRemoteConfig.mockReturnValue(blockedCountries)
  return renderHook(() => useAccountRestrictions(accountTypeOverride)).result.current
}

describe("useAccountRestrictions", () => {
  beforeEach(() => jest.clearAllMocks())

  describe("whose lists answer", () => {
    it("reads the custodial lists for a custodial account", () => {
      const restrictions = setUp({ countryCode: "HK" })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(false)
    })

    it("reads the self-custodial lists for a self-custodial account", () => {
      const restrictions = setUp({
        accountType: AccountType.SelfCustodial,
        countryCode: "FR",
      })

      expect(restrictions.dollarBalance).toBe(true)
    })

    it("never answers one custody type from the other's lists", () => {
      // HK blocks the custodial dollar balance only, FR the self-custodial one only.
      expect(setUp({ countryCode: "FR" }).dollarBalance).toBe(false)
      expect(
        setUp({ accountType: AccountType.SelfCustodial, countryCode: "HK" })
          .dollarBalance,
      ).toBe(false)
    })

    it("reads each feature from its own list", () => {
      expect(setUp({ countryCode: "DE" }).transfer).toBe(true)
      expect(setUp({ countryCode: "DE" }).dollarBalance).toBe(false)
    })

    it("honors an override over the active account type", () => {
      // Migration previews the self-custodial policy from a still-custodial session.
      const restrictions = setUp({
        accountType: AccountType.Custodial,
        accountTypeOverride: AccountType.SelfCustodial,
        ipCountryCode: "FR",
      })

      expect(restrictions.dollarBalance).toBe(true)
    })

    it("restricts nothing while the country is unresolved", () => {
      const restrictions = setUp({ countryCode: undefined })

      expect(restrictions.dollarBalance).toBe(false)
      expect(restrictions.transfer).toBe(false)
    })
  })

  describe("the country it resolves", () => {
    it("reads the device's own country outside a prediction", () => {
      setUp({ countryCode: "HK" })

      // No IP lookup runs, so nobody is located who was not already known.
      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(false)
    })

    it("prefers the IP while predicting the self-custodial policy", () => {
      const restrictions = setUp({
        accountTypeOverride: AccountType.SelfCustodial,
        countryCode: "SV",
        ipCountryCode: "FR",
      })

      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(true)
      expect(restrictions.dollarBalance).toBe(true)
    })

    it("falls back to the session country when the prediction's IP is unreachable", () => {
      // Reading an unreachable IP as unrestricted would preview a dollar balance the new
      // account cannot hold, in the one step the user cannot take back.
      const restrictions = setUp({
        accountTypeOverride: AccountType.SelfCustodial,
        countryCode: "FR",
        ipCountryCode: undefined,
      })

      expect(restrictions.dollarBalance).toBe(true)
    })
  })

  describe("isSettled", () => {
    it("is false while the device location is still resolving", () => {
      expect(setUp({ countryCode: undefined, isLocationPending: true }).isSettled).toBe(
        false,
      )
    })

    it("is true once a country resolved, even while the location keeps loading", () => {
      // The prediction's IP lookup can land first, and that already settles the region.
      expect(setUp({ countryCode: "HK", isLocationPending: true }).isSettled).toBe(true)
    })

    it("holds a prediction until its IP lookup settles", () => {
      // A fast phone parse would otherwise report settled-unrestricted and then flip.
      const restrictions = setUp({
        accountTypeOverride: AccountType.SelfCustodial,
        countryCode: "SV",
        isIpLookupSettled: false,
      })

      expect(restrictions.isSettled).toBe(false)
    })

    it("is false until remote config has answered", () => {
      // An empty list mid-fetch would read as a country nothing restricts.
      const restrictions = setUp({ countryCode: "HK", remoteConfigReady: false })

      expect(restrictions.isSettled).toBe(false)
    })

    it("is true once both the region and the lists have settled", () => {
      expect(setUp({ countryCode: "SV" }).isSettled).toBe(true)
    })
  })
})
