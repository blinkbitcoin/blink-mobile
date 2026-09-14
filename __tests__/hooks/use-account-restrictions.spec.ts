import { act, renderHook } from "@testing-library/react-native"

import { useAccountRestrictions } from "@app/hooks/use-account-restrictions"
import { AccountType } from "@app/types/wallet"

const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockUseDeviceLocation = jest.fn()
const mockUseIpCountryLookup = jest.fn()
const mockUseCustodialRestrictionsQuery = jest.fn()
const mockRefetch = jest.fn()
let mockRemoteConfigReady = true
let mockIsAuthed = true
let mockIsRegistryHydrating = false

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => ({ remoteConfigReady: mockRemoteConfigReady }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCustodialRestrictionsQuery: (options: unknown) =>
    mockUseCustodialRestrictionsQuery(options),
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

type ServerRestrictions = { dollarBalance: boolean; transfer: boolean }

const UNRESTRICTED: ServerRestrictions = { dollarBalance: false, transfer: false }

/** null stands for "the query answered nothing", which `undefined` cannot: it would take
 *  the parameter default instead. */
const renderRestrictions = ({
  accountType = AccountType.Custodial,
  accountTypeOverride,
  countryCode,
  isLocationPending = false,
  ipCountryCode,
  isIpLookupSettled = true,
  remoteConfigReady = true,
  isAuthed = true,
  isRegistryHydrating = false,
  custodialRestrictions = UNRESTRICTED,
  isQueryLoading = false,
  queryError,
}: {
  accountType?: AccountType
  accountTypeOverride?: AccountType
  countryCode?: string
  isLocationPending?: boolean
  ipCountryCode?: string
  isIpLookupSettled?: boolean
  remoteConfigReady?: boolean
  isAuthed?: boolean
  isRegistryHydrating?: boolean
  custodialRestrictions?: ServerRestrictions | null
  isQueryLoading?: boolean
  queryError?: Error
}) => {
  mockRemoteConfigReady = remoteConfigReady
  mockIsAuthed = isAuthed
  mockIsRegistryHydrating = isRegistryHydrating
  mockUseDeviceLocation.mockReturnValue({ countryCode, loading: isLocationPending })
  mockUseIpCountryLookup.mockReturnValue({
    countryCode: ipCountryCode,
    isSettled: isIpLookupSettled,
  })
  mockUseActiveWallet.mockReturnValue({ accountType })
  mockUseRemoteConfig.mockReturnValue(blockedCountries)
  mockUseCustodialRestrictionsQuery.mockReturnValue({
    data: custodialRestrictions ? { custodialRestrictions } : undefined,
    loading: isQueryLoading,
    error: queryError,
    refetch: mockRefetch,
  })
  return renderHook(() => useAccountRestrictions(accountTypeOverride))
}

/** The reading a test asserts on. Retry tests keep the render instead, since they have to
 *  advance time and re-read. */
const setUp = (options: Parameters<typeof renderRestrictions>[0]) =>
  renderRestrictions(options).result.current

/** What the query hook was told, so the skip decision can be read directly. */
const lastQueryOptions = () => mockUseCustodialRestrictionsQuery.mock.calls.at(-1)?.[0]

describe("useAccountRestrictions", () => {
  beforeEach(() => jest.clearAllMocks())

  describe("who answers for the account", () => {
    it("takes the server's verdict for a custodial account", () => {
      const restrictions = setUp({
        custodialRestrictions: { dollarBalance: true, transfer: true },
      })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(true)
    })

    it("reads the self-custodial lists for a self-custodial account", () => {
      // A self-custodial wallet has no Blink account behind it, so no server verdict
      // covers it and its own lists answer.
      const restrictions = setUp({
        accountType: AccountType.SelfCustodial,
        countryCode: "FR",
      })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(false)
    })

    it("asks the server nothing on behalf of a self-custodial account", () => {
      setUp({ accountType: AccountType.SelfCustodial, countryCode: "FR" })

      expect(lastQueryOptions()).toMatchObject({ skip: true })
    })

    it("asks the server nothing without an account to ask about", () => {
      setUp({ isAuthed: false })

      expect(lastQueryOptions()).toMatchObject({ skip: true })
    })

    it("asks the server for an authed custodial account", () => {
      setUp({ isAuthed: true })

      expect(lastQueryOptions()).toMatchObject({ skip: false })
    })

    it("never reads a cached verdict, which would outlive the session that earned it", () => {
      setUp({})

      expect(lastQueryOptions()).toMatchObject({ fetchPolicy: "no-cache" })
    })

    it("reads each field the server answers on its own", () => {
      // A dollar-balance block does not imply a transfer block, and the reverse.
      const restrictions = setUp({
        custodialRestrictions: { dollarBalance: true, transfer: false },
      })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(false)
    })
  })

  describe("an unanswered query", () => {
    it("gates every feature when the server gave no verdict", () => {
      // No region determined, no gated feature — UnknownRegionPolicy = FAIL_CLOSED.
      const restrictions = setUp({ custodialRestrictions: null })

      expect(restrictions.dollarBalance).toBe(true)
      expect(restrictions.transfer).toBe(true)
    })

    it("still settles, so no surface waits on an answer that is not coming", () => {
      // The server enforces its own rules per request regardless, and it serves every
      // other custodial feature, so an unreachable one leaves nothing to protect.
      expect(setUp({ custodialRestrictions: null }).isSettled).toBe(true)
    })

    /** `useActiveWallet` answers Custodial while the registry hydrates, so a self-custodial
     *  device reads as custodial-unauthed for those first renders. Settling there would
     *  offer the dollar balance and then withdraw it. */
    it("stays unsettled while the registry has not named the account", () => {
      const restrictions = setUp({ isAuthed: false, isRegistryHydrating: true })

      expect(restrictions.isSettled).toBe(false)
      expect(restrictions.dollarBalance).toBe(false)
    })

    it("restricts nothing for a session with no account", () => {
      const restrictions = setUp({ isAuthed: false, custodialRestrictions: null })

      expect(restrictions.dollarBalance).toBe(false)
      expect(restrictions.transfer).toBe(false)
      expect(restrictions.isSettled).toBe(true)
    })
  })

  /**
   * A request that never arrived and a served "no verdict" are the same absence of data,
   * and the hook used to answer both with FAIL_CLOSED. One is the server speaking; the
   * other is a lost packet, and `no-cache` leaves nothing to re-read, so the failure would
   * govern the whole session until the user backgrounded the app and came back.
   */
  describe("a request that never arrived", () => {
    const transportFailure = new Error("network request failed")

    beforeEach(() => {
      jest.useFakeTimers()
      mockRefetch.mockResolvedValue({})
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("asks again instead of taking the failure for a verdict", () => {
      renderRestrictions({ custodialRestrictions: null, queryError: transportFailure })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    /** Gating on a lost packet is the latch; waiting is what a slow answer already gets. */
    it("gates nothing while a retry is still owed", () => {
      const { result } = renderRestrictions({
        custodialRestrictions: null,
        queryError: transportFailure,
      })

      expect(result.current.dollarBalance).toBe(false)
      expect(result.current.transfer).toBe(false)
      expect(result.current.isSettled).toBe(false)
    })

    it("takes the verdict a retry finally brings", () => {
      const { result, rerender } = renderRestrictions({
        custodialRestrictions: null,
        queryError: transportFailure,
      })

      mockUseCustodialRestrictionsQuery.mockReturnValue({
        data: { custodialRestrictions: { dollarBalance: false, transfer: true } },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      })
      rerender(undefined)

      expect(result.current).toEqual({
        dollarBalance: false,
        transfer: true,
        isSettled: true,
      })
    })

    /** Asking has stopped working, which is a determined absence of region rather than a
     *  moment of one, so FAIL_CLOSED governs from here. */
    it("gates every feature once the retries are spent", () => {
      const { result } = renderRestrictions({
        custodialRestrictions: null,
        queryError: transportFailure,
      })

      /** One per commit: each retry is scheduled by the render that follows the last one,
       *  and the delay doubles. */
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      act(() => {
        jest.advanceTimersByTime(4000)
      })
      act(() => {
        jest.advanceTimersByTime(60_000)
      })

      expect(mockRefetch).toHaveBeenCalledTimes(3)
      expect(result.current).toEqual({
        dollarBalance: true,
        transfer: true,
        isSettled: true,
      })
    })

    /** Every mounted consumer runs this hook, so an unbacked-off retry would turn one
     *  unreachable server into a burst of requests per screen. */
    it("backs off rather than asking again at once", () => {
      renderRestrictions({ custodialRestrictions: null, queryError: transportFailure })

      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(mockRefetch).toHaveBeenCalledTimes(1)

      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(mockRefetch).toHaveBeenCalledTimes(1)

      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(mockRefetch).toHaveBeenCalledTimes(2)
    })

    /** The server answering "no verdict" is an answer, and the PRD gates on it. */
    it("never asks again about a verdict the server actually served", () => {
      const { result } = renderRestrictions({ custodialRestrictions: null })

      act(() => {
        jest.advanceTimersByTime(60_000)
      })

      expect(mockRefetch).not.toHaveBeenCalled()
      expect(result.current).toEqual({
        dollarBalance: true,
        transfer: true,
        isSettled: true,
      })
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

    it("runs no IP lookup when no prediction was asked for", () => {
      setUp({ accountType: AccountType.SelfCustodial })

      expect(mockUseIpCountryLookup).toHaveBeenCalledWith(false)
    })

    it("takes the server's verdict when the override names the custodial type", () => {
      const restrictions = setUp({
        accountType: AccountType.SelfCustodial,
        accountTypeOverride: AccountType.Custodial,
        custodialRestrictions: { dollarBalance: true, transfer: false },
      })

      expect(restrictions.dollarBalance).toBe(true)
    })
  })

  describe("isSettled", () => {
    it("is false while the server has not answered", () => {
      expect(setUp({ isQueryLoading: true }).isSettled).toBe(false)
    })

    it("is true once the server has answered", () => {
      expect(setUp({ isQueryLoading: false }).isSettled).toBe(true)
    })

    it("is true for a session with no account, which has nothing to wait for", () => {
      expect(setUp({ isAuthed: false, isQueryLoading: true }).isSettled).toBe(true)
    })

    it("holds a self-custodial account while its device location resolves", () => {
      expect(
        setUp({
          accountType: AccountType.SelfCustodial,
          isLocationPending: true,
        }).isSettled,
      ).toBe(false)
    })

    it("settles a self-custodial account on a country, even mid-lookup", () => {
      expect(
        setUp({
          accountType: AccountType.SelfCustodial,
          countryCode: "FR",
          isLocationPending: true,
        }).isSettled,
      ).toBe(true)
    })

    it("holds a self-custodial account until its lists have been fetched", () => {
      // An empty list mid-fetch would read as a country nothing restricts.
      expect(
        setUp({
          accountType: AccountType.SelfCustodial,
          countryCode: "FR",
          remoteConfigReady: false,
        }).isSettled,
      ).toBe(false)
    })

    it("holds the prediction until the IP lookup settles", () => {
      // A fast phone parse would otherwise report settled-unrestricted and then flip.
      expect(
        setUp({
          accountTypeOverride: AccountType.SelfCustodial,
          countryCode: "FR",
          isIpLookupSettled: false,
        }).isSettled,
      ).toBe(false)
    })

    it("ignores remote config for a custodial account, whose lists are gone", () => {
      expect(setUp({ remoteConfigReady: false }).isSettled).toBe(true)
    })
  })
})
