import { renderHook } from "@testing-library/react-native"

import { useAccountRestrictions } from "@app/hooks/use-account-restrictions"
import {
  RestrictionVerdict,
  RestrictionVerdictStatus,
  Restrictions,
} from "@app/types/account"
import { AccountType } from "@app/types/wallet"

const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseDeviceLocation = jest.fn()
const mockUseIpCountryLookup = jest.fn()
let mockCustodialVerdict: RestrictionVerdict = {
  status: RestrictionVerdictStatus.Pending,
}
let mockRemoteConfigReady = true
let mockIsRegistryHydrating = false

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => ({ remoteConfigReady: mockRemoteConfigReady }),
}))

jest.mock("@app/custodial/providers/restrictions", () => ({
  ...jest.requireActual("@app/custodial/providers/restrictions"),
  useCustodialRestrictions: () => ({
    verdict: mockCustodialVerdict,
  }),
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

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ loading: mockIsRegistryHydrating }),
}))

const blockedCountries = {
  selfCustodialDollarBalanceBlockedCountries: ["FR"],
  selfCustodialTransferBlockedCountries: ["PK"],
}

const served = (restrictions: Restrictions): RestrictionVerdict => ({
  status: RestrictionVerdictStatus.Served,
  restrictions,
})

const PENDING: RestrictionVerdict = { status: RestrictionVerdictStatus.Pending }
const UNKNOWN: RestrictionVerdict = { status: RestrictionVerdictStatus.Unknown }
const NO_ACCOUNT: RestrictionVerdict = { status: RestrictionVerdictStatus.NoAccount }

const setUp = ({
  accountType = AccountType.Custodial,
  accountTypeOverride,
  countryCode,
  isLocationPending = false,
  ipCountryCode,
  isIpLookupSettled = true,
  remoteConfigReady = true,
  isRegistryHydrating = false,
  custodialVerdict = served({ dollarBalance: false, transfer: false }),
}: {
  accountType?: AccountType
  accountTypeOverride?: AccountType
  countryCode?: string
  isLocationPending?: boolean
  ipCountryCode?: string
  isIpLookupSettled?: boolean
  remoteConfigReady?: boolean
  isRegistryHydrating?: boolean
  custodialVerdict?: RestrictionVerdict
}) => {
  mockRemoteConfigReady = remoteConfigReady
  mockIsRegistryHydrating = isRegistryHydrating
  mockCustodialVerdict = custodialVerdict
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

  describe("a custodial account", () => {
    it("takes the server's verdict as a determined region", () => {
      expect(
        setUp({ custodialVerdict: served({ dollarBalance: true, transfer: true }) }),
      ).toEqual({
        dollarBalance: true,
        transfer: true,
        isSettled: true,
        isRegionDetermined: true,
      })
    })

    it("reads each field the server answers on its own", () => {
      // A dollar-balance block does not imply a transfer block, and the reverse.
      const restrictions = setUp({
        custodialVerdict: served({ dollarBalance: true, transfer: false }),
      })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(false)
    })

    it("ignores the device country, which the server resolves for itself", () => {
      const restrictions = setUp({
        countryCode: "FR",
        custodialVerdict: served({ dollarBalance: false, transfer: false }),
      })

      expect(restrictions.dollarBalance).toBe(false)
    })

    it("gates nothing and waits while the server has not answered", () => {
      expect(setUp({ custodialVerdict: PENDING })).toEqual({
        dollarBalance: false,
        transfer: false,
        isSettled: false,
        isRegionDetermined: false,
      })
    })

    it("gates every feature once asking has stopped working, without claiming a region", () => {
      // No region determined, no gated feature: UnknownRegionPolicy = FAIL_CLOSED. The
      // region is still undetermined, which is what keeps an action on the funds away.
      expect(setUp({ custodialVerdict: UNKNOWN })).toEqual({
        dollarBalance: true,
        transfer: true,
        isSettled: true,
        isRegionDetermined: false,
      })
    })

    it("restricts nothing for a session with no account", () => {
      expect(setUp({ custodialVerdict: NO_ACCOUNT })).toEqual({
        dollarBalance: false,
        transfer: false,
        isSettled: true,
        isRegionDetermined: false,
      })
    })

    /** `useActiveWallet` answers Custodial while the registry hydrates, so a self-custodial
     *  device reads as custodial-unauthed for those first renders. Settling there would
     *  offer the dollar balance and then withdraw it. */
    it("stays unsettled while the registry has not named the account", () => {
      const restrictions = setUp({
        custodialVerdict: NO_ACCOUNT,
        isRegistryHydrating: true,
      })

      expect(restrictions.isSettled).toBe(false)
      expect(restrictions.dollarBalance).toBe(false)
    })

    it("ignores remote config, whose lists are gone for custodial", () => {
      expect(setUp({ remoteConfigReady: false }).isSettled).toBe(true)
    })

    it("takes the server's verdict when the override names the custodial type", () => {
      const restrictions = setUp({
        accountType: AccountType.SelfCustodial,
        accountTypeOverride: AccountType.Custodial,
        custodialVerdict: served({ dollarBalance: true, transfer: false }),
      })

      expect(restrictions.dollarBalance).toBe(true)
    })
  })

  describe("a self-custodial account", () => {
    it("reads its own lists, never the server's verdict", () => {
      // A self-custodial wallet has no Blink account behind it, so no server verdict
      // covers it and its own lists answer.
      const restrictions = setUp({
        accountType: AccountType.SelfCustodial,
        countryCode: "FR",
        custodialVerdict: served({ dollarBalance: false, transfer: true }),
      })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(false)
    })

    it("determines the region once a country resolves", () => {
      expect(
        setUp({ accountType: AccountType.SelfCustodial, countryCode: "AR" })
          .isRegionDetermined,
      ).toBe(true)
    })

    it("leaves the region undetermined without a country", () => {
      expect(
        setUp({ accountType: AccountType.SelfCustodial, countryCode: undefined }),
      ).toEqual({
        dollarBalance: false,
        transfer: false,
        isSettled: true,
        isRegionDetermined: false,
      })
    })

    it("holds while its device location resolves", () => {
      expect(
        setUp({ accountType: AccountType.SelfCustodial, isLocationPending: true })
          .isSettled,
      ).toBe(false)
    })

    it("settles on a country, even mid-lookup", () => {
      expect(
        setUp({
          accountType: AccountType.SelfCustodial,
          countryCode: "FR",
          isLocationPending: true,
        }).isSettled,
      ).toBe(true)
    })

    it("holds until its lists have been fetched", () => {
      // An empty list mid-fetch would read as a country nothing restricts.
      expect(
        setUp({
          accountType: AccountType.SelfCustodial,
          countryCode: "FR",
          remoteConfigReady: false,
        }).isSettled,
      ).toBe(false)
    })

    it("runs no IP lookup when no prediction was asked for", () => {
      setUp({ accountType: AccountType.SelfCustodial })

      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(false)
    })
  })

  describe("the self-custodial prediction", () => {
    it("evaluates the overridden type rather than the active one", () => {
      // A still-custodial session predicting the self-custodial policy during migration.
      const restrictions = setUp({
        accountType: AccountType.Custodial,
        accountTypeOverride: AccountType.SelfCustodial,
        ipCountryCode: "FR",
      })

      expect(restrictions.dollarBalance).toBe(true)
    })

    it("resolves by IP, since the predicted account has no phone", () => {
      setUp({
        accountTypeOverride: AccountType.SelfCustodial,
        ipCountryCode: "FR",
      })

      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(true)
    })

    it("falls back to the session country when the IP does not resolve", () => {
      // A failed lookup must not read as unrestricted and preview a dollar balance the
      // account cannot hold.
      const restrictions = setUp({
        accountTypeOverride: AccountType.SelfCustodial,
        countryCode: "FR",
        ipCountryCode: undefined,
      })

      expect(restrictions.dollarBalance).toBe(true)
    })

    it("prefers the IP over the session country when both resolve", () => {
      const restrictions = setUp({
        accountTypeOverride: AccountType.SelfCustodial,
        countryCode: "FR",
        ipCountryCode: "SV",
      })

      expect(restrictions.dollarBalance).toBe(false)
    })

    it("holds until the IP lookup settles", () => {
      // A fast phone parse would otherwise report settled-unrestricted and then flip.
      expect(
        setUp({
          accountTypeOverride: AccountType.SelfCustodial,
          countryCode: "FR",
          isIpLookupSettled: false,
        }).isSettled,
      ).toBe(false)
    })
  })
})
