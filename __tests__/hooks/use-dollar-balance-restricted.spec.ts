import { renderHook } from "@testing-library/react-native"

import { RestrictionVerdict, RestrictionVerdictStatus } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
let mockRemoteConfigReady = true
const mockUseActiveWallet = jest.fn()
const mockUseIpCountryLookup = jest.fn()
let mockCustodialVerdict: RestrictionVerdict = {
  status: RestrictionVerdictStatus.Pending,
}

jest.mock("@app/utils/ip-country-lookup")

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
  useIpCountryLookup: (enabled: boolean) => mockUseIpCountryLookup(enabled),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => ({ remoteConfigReady: mockRemoteConfigReady }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ loading: false }),
}))

jest.mock("@app/custodial/providers/restrictions", () => ({
  ...jest.requireActual("@app/custodial/providers/restrictions"),
  useCustodialRestrictions: () => ({
    verdict: mockCustodialVerdict,
  }),
}))

import {
  useDollarBalanceGate,
  useDollarBalanceGated,
  useDollarBalanceRestriction,
} from "@app/hooks/use-dollar-balance-restricted"

const remoteConfig = {
  selfCustodialTransferBlockedCountries: [],
  selfCustodialDollarBalanceBlockedCountries: ["FR"],
}

/** A disabled lookup reports settled, so only the tests that hold on it pass false. */
const setIpLookup = (countryCode: string | undefined, isSettled = true): void => {
  mockUseIpCountryLookup.mockReturnValue({ countryCode, isSettled })
}

/** The server's answer, which is what a custodial account is judged by. */
const serverAnswers = (dollarBalance: boolean): void => {
  mockCustodialVerdict = {
    status: RestrictionVerdictStatus.Served,
    restrictions: { dollarBalance, transfer: false },
  }
}

const serverPending = (): void => {
  mockCustodialVerdict = { status: RestrictionVerdictStatus.Pending }
}

/** Asking has stopped working: the retries failed and no answer came back. */
const serverUnreachable = (): void => {
  mockCustodialVerdict = { status: RestrictionVerdictStatus.Unknown }
}

const noAccountToAsk = (): void => {
  mockCustodialVerdict = { status: RestrictionVerdictStatus.NoAccount }
}

const setup = (accountType: AccountType): void => {
  jest.clearAllMocks()
  mockRemoteConfigReady = true
  mockIsAnonMode = false
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue(remoteConfig)
  mockUseActiveWallet.mockReturnValue({ accountType })
  setIpLookup(undefined)
  serverAnswers(false)
}

const read = () =>
  renderHook(() => useDollarBalanceRestriction()).result.current.isRestricted

const readRestriction = (accountTypeOverride?: AccountType) =>
  renderHook(() => useDollarBalanceRestriction(accountTypeOverride)).result.current

describe("useDollarBalanceRestriction", () => {
  describe("custodial", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("is restricted when the server blocks the dollar balance", () => {
      serverAnswers(true)
      expect(read()).toBe(true)
    })

    it("is not restricted when the server clears it", () => {
      serverAnswers(false)
      expect(read()).toBe(false)
    })

    it("ignores the device country, which the server resolves for itself", () => {
      // The server picks phone or IP by account level, so the client never chooses.
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      serverAnswers(false)
      expect(read()).toBe(false)
    })

    it("is restricted when asking has stopped working", () => {
      // No region determined, no gated feature: UnknownRegionPolicy = FAIL_CLOSED.
      serverUnreachable()
      expect(read()).toBe(true)
    })

    it("is not restricted without an account to ask about", () => {
      noAccountToAsk()
      expect(read()).toBe(false)
    })
  })

  describe("self-custodial", () => {
    beforeEach(() => setup(AccountType.SelfCustodial))

    it("is restricted in a stable-token-blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(read()).toBe(true)
    })

    it("is case-insensitive on the device country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "fr" })
      expect(read()).toBe(true)
    })

    it("is not restricted in a country its own list does not carry", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK" })
      expect(read()).toBe(false)
    })

    it("is not restricted without a resolved country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
      expect(read()).toBe(false)
    })

    it("is unaffected by a custodial verdict the server gave", () => {
      // No server verdict covers a wallet with no Blink account behind it.
      serverAnswers(true)
      mockUseDeviceLocation.mockReturnValue({ countryCode: "HK" })
      expect(read()).toBe(false)
    })
  })

  describe("with an account-type override", () => {
    // A still-custodial session predicting the phone-less self-custodial account.
    beforeEach(() => setup(AccountType.Custodial))

    const readOverride = (accountType: AccountType) =>
      renderHook(() => useDollarBalanceRestriction(accountType)).result.current
        .isRestricted

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

    it("uses the self-custodial list, not the server's custodial verdict", () => {
      serverAnswers(true)
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

  describe("useDollarBalanceGated", () => {
    const readGated = () => renderHook(() => useDollarBalanceGated()).result.current

    beforeEach(() => setup(AccountType.SelfCustodial))

    it("gates in Anon mode with no region resolved at all", () => {
      mockIsAnonMode = true
      expect(readGated()).toBe(true)
    })

    it("gates in a blocked region outside Anon mode", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(readGated()).toBe(true)
    })

    it("does not gate when neither Anon nor the region applies", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "AR" })
      expect(readGated()).toBe(false)
    })
  })

  describe("while the verdict is still resolving", () => {
    beforeEach(() => setup(AccountType.Custodial))

    it("reports the region as pending without claiming a restriction", () => {
      serverPending()

      expect(readRestriction()).toEqual({
        isRestricted: false,
        isRegionPending: true,
        isRegionDetermined: false,
      })
    })

    it("restricts once the server answers that it is blocked", () => {
      serverAnswers(true)

      expect(readRestriction()).toEqual({
        isRestricted: true,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })

    it("settles unrestricted once the server clears it", () => {
      serverAnswers(false)

      expect(readRestriction()).toEqual({
        isRestricted: false,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })

    it("settles restricted on an unreachable server, with the region still undetermined", () => {
      serverUnreachable()

      expect(readRestriction()).toEqual({
        isRestricted: true,
        isRegionPending: false,
        isRegionDetermined: false,
      })
    })

    it("settles the self-custodial prediction on the IP even while the device keeps loading", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })
      setIpLookup("FR")

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })

    /** Anon gates on the mode alone, so no region resolves and nothing pends. */
    it("never pends in Anon mode", () => {
      mockIsAnonMode = true
      mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: false })

      expect(renderHook(() => useDollarBalanceGate()).result.current).toEqual({
        isGated: true,
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
        isRegionDetermined: true,
      })
    })

    it("settles restricted once the in-flight IP lands on a blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
      setIpLookup("FR", true)

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })

    it("settles on the session country once the lookup finishes without one", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", loading: false })
      setIpLookup(undefined, true)

      expect(readRestriction(AccountType.SelfCustodial)).toEqual({
        isRestricted: true,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })

    it("leaves the custodial evaluation settled, since it never waits on the IP", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
      setIpLookup(undefined, false)

      expect(readRestriction()).toEqual({
        isRestricted: false,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })
  })

  describe("before the self-custodial block-lists have arrived", () => {
    beforeEach(() => setup(AccountType.SelfCustodial))

    it("reports the region pending rather than a verdict off the compiled defaults", () => {
      mockRemoteConfigReady = false

      const { isRegionPending, isGated } = renderHook(() => useDollarBalanceGate()).result
        .current

      // A list still being fetched would read as a country nothing restricts, and the
      // surface would settle on it and then flip once the real list lands.
      expect(isRegionPending).toBe(true)
      expect(isGated).toBe(false)
    })

    it("leaves the custodial evaluation settled, whose lists are gone", () => {
      mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
      mockRemoteConfigReady = false

      expect(readRestriction()).toEqual({
        isRestricted: false,
        isRegionPending: false,
        isRegionDetermined: true,
      })
    })
  })
})
